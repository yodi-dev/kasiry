// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PRINTER_DEFAULT_SETTINGS,
  getColumnsForPaper,
  sanitizeEscPosText,
  formatWrapText,
  formatTwoColumnLine,
  buildReceiptEscPosBytes,
  buildTestPrintEscPosBytes,
  buildReceiptPrintHtml,
  buildTestPrintHtml,
  splitIntoBleChunks
} from '../src/utils/thermalPrinter'
import { useThermalPrinter } from '../src/composables/useThermalPrinter'

const decodeAscii = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

describe('ESC/POS Thermal Printer Formatter & Encoder', () => {
  it('calculates columns, sanitizes text, wraps lines, and aligns two-column rows', () => {
    expect(getColumnsForPaper('58mm')).toBe(32)
    expect(getColumnsForPaper('80mm')).toBe(48)

    expect(sanitizeEscPosText('Halo\r\nWarung ★ Kasiry')).toBe('Halo\nWarung   Kasiry')
    expect(formatWrapText('Minyak Goreng Bimoli Pouch 2 Liter', 16)).toEqual([
      'Minyak Goreng',
      'Bimoli Pouch 2',
      'Liter'
    ])

    const row32 = formatTwoColumnLine('TOTAL', 'Rp 25.000', 32)
    expect(row32.length).toBe(32)
    expect(row32.startsWith('TOTAL')).toBe(true)
    expect(row32.endsWith('Rp 25.000')).toBe(true)
  })

  it('builds ESC/POS receipt bytes and isolated HTML print documents for 58mm and 80mm', () => {
    const sampleReceipt = {
      invoiceNumber: 'KSR-2026',
      time: '12:30',
      totalAmount: 35000,
      paymentMethod: 'TUNAI',
      cashGiven: 50000,
      changeAmount: 15000,
      customer: { name: 'Umum' },
      items: [
        { id: 1, name: 'Gula Pasir 1Kg', sellPrice: 17500, qty: 2, priceTier: 'grosir', priceLabel: 'Grosir' }
      ]
    }

    const bytes58 = buildReceiptEscPosBytes(
      sampleReceipt,
      { name: 'Warung Kasiry', phone: '' },
      { paperWidth: '58mm', footerText: 'Barang yg dibeli tidak bisa ditukar' }
    )
    expect(bytes58).toBeInstanceOf(Uint8Array)
    expect(bytes58[0]).toBe(0x1B)
    expect(bytes58[1]).toBe(0x40)

    const text58 = decodeAscii(bytes58)
    expect(text58).toContain('WARUNG KASIRY')
    expect(text58).not.toContain('WA:')
    expect(text58).toContain('-'.repeat(32))
    expect(text58).toContain('='.repeat(32))
    expect(text58).toContain('KSR-2026')
    expect(text58).toContain('(Grosir)')
    expect(text58).toContain('Tunai')
    expect(text58).toContain('Kembali')
    expect(text58).toContain('Barang yg dibeli tidak bisa')
    expect(text58).toContain('Kasiry by Awanbeo')

    const html58 = buildReceiptPrintHtml(
      sampleReceipt,
      { name: 'Warung <Kasiry>', phone: '' },
      { paperWidth: '58mm', footerText: 'Makasih!' }
    )
    expect(html58).toContain('@page')
    expect(html58).toContain('size: 58mm auto;')
    expect(html58).toContain('Warung &lt;Kasiry&gt;')
    expect(html58).not.toContain('WA:')
    expect(html58).toContain('Makasih!')
    expect(html58).toContain('Kasiry by Awanbeo')

    const bytes80Qris = buildReceiptEscPosBytes(
      { ...sampleReceipt, paymentMethod: 'QRIS' },
      { name: 'Toko Maju', phone: '08123456789' },
      { paperWidth: '80mm', footerText: 'Simpan struk ini' }
    )
    const text80 = decodeAscii(bytes80Qris)
    expect(text80).toContain('WA: 08123456789')
    expect(text80).toContain('-'.repeat(48))
    expect(text80).toContain('LUNAS (QRIS)')
    expect(text80).toContain('Simpan struk ini')

    const bytesDebt = buildReceiptEscPosBytes(
      { ...sampleReceipt, paymentMethod: 'UTANG / BON', customer: { name: 'Bu Tejo' } },
      { name: 'Toko Maju', phone: '' },
      { paperWidth: '58mm', footerText: '' }
    )
    expect(decodeAscii(bytesDebt)).toContain('DICATAT DI BUKU UTANG')
  })

  it('builds test print bytes/HTML and splits payloads into BLE MTU chunks', () => {
    const testBytes = buildTestPrintEscPosBytes({ name: 'Warung Tes' }, { paperWidth: '80mm', footerText: 'Mantap!' })
    const decoded = decodeAscii(testBytes)
    expect(decoded).toContain('TES CETAK KASIRY POS')
    expect(decoded).toContain('WARUNG TES')
    expect(decoded).toContain('80mm (48 kol)')
    expect(decoded).toContain('Mantap!')
    expect(decoded).toContain('Printer Thermal Terhubung OK!')
    expect(decoded).toContain('Kasiry by Awanbeo')

    const testHtml = buildTestPrintHtml({ name: 'Warung Tes' }, { paperWidth: '80mm', footerText: 'Mantap!' })
    expect(testHtml).toContain('size: 80mm auto;')
    expect(testHtml).toContain('TES CETAK KASIRY POS')
    expect(testHtml).toContain('80mm (48 kol)')
    expect(testHtml).toContain('Kasiry by Awanbeo')

    const samplePayload = new Uint8Array(190).fill(0x41)
    const chunks80 = splitIntoBleChunks(samplePayload, 80)
    expect(chunks80.map((c) => c.length)).toEqual([80, 80, 30])

    const chunks20 = splitIntoBleChunks(samplePayload, 10) // Dipaksa minimal 20 byte
    expect(chunks20[0].length).toBe(20)
  })
})

describe('useThermalPrinter Composable (Bluetooth, WebUSB, Web Serial & Fallback)', () => {
  const originalBluetooth = Object.getOwnPropertyDescriptor(navigator, 'bluetooth')
  const originalUsb = Object.getOwnPropertyDescriptor(navigator, 'usb')
  const originalSerial = Object.getOwnPropertyDescriptor(navigator, 'serial')
  const originalPrint = window.print

  beforeEach(async () => {
    localStorage.clear()
    const { disconnectPrinter, updatePrinterSettings } = useThermalPrinter()
    await disconnectPrinter()
    updatePrinterSettings({ ...PRINTER_DEFAULT_SETTINGS, preferredTransport: '', serialBaudRate: 9600 })
  })

  afterEach(async () => {
    const { disconnectPrinter } = useThermalPrinter()
    await disconnectPrinter()
    if (originalBluetooth) Object.defineProperty(navigator, 'bluetooth', originalBluetooth)
    else delete navigator.bluetooth
    if (originalUsb) Object.defineProperty(navigator, 'usb', originalUsb)
    else delete navigator.usb
    if (originalSerial) Object.defineProperty(navigator, 'serial', originalSerial)
    else delete navigator.serial
    window.print = originalPrint
    vi.restoreAllMocks()
  })

  it('persists printer preferences and falls back to clean browser print when disconnected', async () => {
    const printSpy = vi.fn()
    window.print = printSpy

    const {
      printerSettings,
      updatePrinterSettings,
      printReceiptThermal,
      printTestThermal
    } = useThermalPrinter()

    updatePrinterSettings({
      paperWidth: '80mm',
      autoPrint: true,
      footerText: 'Hatur nuhun!',
      serialBaudRate: 115200
    })

    expect(printerSettings.value).toMatchObject({
      paperWidth: '80mm',
      autoPrint: true,
      footerText: 'Hatur nuhun!',
      serialBaudRate: 115200
    })
    expect(JSON.parse(localStorage.getItem('kasiry_printer_settings'))).toMatchObject({
      paperWidth: '80mm',
      autoPrint: true,
      footerText: 'Hatur nuhun!',
      serialBaudRate: 115200
    })

    const receiptResult = await printReceiptThermal(
      { invoiceNumber: 'INV-1', totalAmount: 10000, paymentMethod: 'TUNAI', items: [] },
      { name: 'Warung Kasiry' }
    )
    expect(receiptResult).toEqual({ ok: true, method: 'browser' })

    const testResult = await printTestThermal({ name: 'Warung Kasiry' })
    expect(testResult).toEqual({ ok: true, method: 'browser' })
  })

  it('connects via Web Bluetooth GATT, prints ESC/POS chunks, and retries with 20-byte MTU on write failure', async () => {
    const printSpy = vi.fn()
    window.print = printSpy

    const writeWithoutResponse = vi.fn().mockResolvedValue(undefined)
    const mockCharacteristic = {
      properties: { writeWithoutResponse: true, write: false },
      writeValueWithoutResponse: writeWithoutResponse
    }
    const mockDevice = {
      name: 'RPP02N-Thermal',
      addEventListener: vi.fn(),
      gatt: {
        connected: false,
        connect: vi.fn().mockResolvedValue({
          getPrimaryServices: vi.fn().mockResolvedValue([
            {
              getCharacteristics: vi.fn().mockResolvedValue([mockCharacteristic])
            }
          ])
        }),
        disconnect: vi.fn()
      }
    }

    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {
        requestDevice: vi.fn().mockResolvedValue(mockDevice)
      }
    })

    const {
      connectionType,
      isBluetoothSupported,
      isPrinterConnected,
      connectedPrinterName,
      connectBluetoothPrinter,
      printReceiptThermal,
      disconnectPrinter
    } = useThermalPrinter()

    expect(isBluetoothSupported.value).toBe(true)
    const connected = await connectBluetoothPrinter()
    expect(connected).toBe(true)
    expect(connectionType.value).toBe('bluetooth')
    expect(isPrinterConnected.value).toBe(true)
    expect(connectedPrinterName.value).toBe('RPP02N-Thermal')

    const res = await printReceiptThermal(
      {
        invoiceNumber: 'INV-BT-1',
        time: '09:00',
        totalAmount: 15000,
        paymentMethod: 'TUNAI',
        cashGiven: 20000,
        changeAmount: 5000,
        items: [{ id: 1, name: 'Kopi Kapal Api', sellPrice: 15000, qty: 1 }]
      },
      { name: 'Warung BT' }
    )
    expect(res).toEqual({ ok: true, method: 'bluetooth' })
    expect(writeWithoutResponse).toHaveBeenCalled()
    expect(printSpy).not.toHaveBeenCalled()

    writeWithoutResponse.mockReset()
    writeWithoutResponse
      .mockRejectedValueOnce(new Error('GATT write exceeds MTU'))
      .mockResolvedValue(undefined)

    const retryRes = await printReceiptThermal(
      { invoiceNumber: 'INV-BT-2', totalAmount: 5000, paymentMethod: 'QRIS', items: [] },
      { name: 'Warung BT' }
    )
    expect(retryRes).toEqual({ ok: true, method: 'bluetooth' })
    const retriedLengths = writeWithoutResponse.mock.calls.slice(1).map((c) => c[0].length)
    expect(retriedLengths.length).toBeGreaterThan(2)
    expect(Math.max(...retriedLengths)).toBeLessThanOrEqual(20)

    await disconnectPrinter()
    expect(isPrinterConnected.value).toBe(false)
    expect(connectionType.value).toBe('none')
    expect(connectedPrinterName.value).toBe('')
  })

  it('connects via WebUSB (Android OTG & Desktop), prints ESC/POS, auto-reconnects, and surfaces clear Windows WinUSB guidance on SecurityError', async () => {
    const transferOut = vi.fn().mockResolvedValue({ status: 'ok', bytesWritten: 64 })
    const claimInterface = vi.fn().mockResolvedValue(undefined)
    const open = vi.fn(async () => {
      mockUsbDevice.opened = true
    })
    const close = vi.fn(async () => {
      mockUsbDevice.opened = false
    })

    const mockUsbDevice = {
      productName: 'POS-58 Thermal USB',
      opened: false,
      open,
      close,
      selectConfiguration: vi.fn(),
      claimInterface,
      transferOut,
      configuration: {
        interfaces: [
          {
            interfaceNumber: 0,
            alternates: [
              {
                interfaceClass: 7,
                alternateSetting: 0,
                endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 2 }]
              }
            ]
          }
        ]
      }
    }

    const requestDevice = vi.fn().mockResolvedValue(mockUsbDevice)
    const getDevices = vi.fn().mockResolvedValue([mockUsbDevice])
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: { requestDevice, getDevices, addEventListener: vi.fn() }
    })

    const {
      isUsbSupported,
      connectionType,
      isPrinterConnected,
      connectedPrinterName,
      printerError,
      connectUsbPrinter,
      printReceiptThermal,
      printTestThermal,
      autoReconnectPrinter,
      disconnectPrinter
    } = useThermalPrinter()

    expect(isUsbSupported.value).toBe(true)
    const ok = await connectUsbPrinter()
    expect(ok).toBe(true)
    expect(connectionType.value).toBe('usb')
    expect(connectedPrinterName.value).toBe('POS-58 Thermal USB')
    expect(claimInterface).toHaveBeenCalledWith(0)

    const receiptRes = await printReceiptThermal(
      { invoiceNumber: 'USB-01', totalAmount: 20000, paymentMethod: 'QRIS', items: [{ id: 1, name: 'Beras', sellPrice: 20000, qty: 1 }] },
      { name: 'Warung OTG' }
    )
    expect(receiptRes).toEqual({ ok: true, method: 'usb' })
    expect(transferOut).toHaveBeenCalledWith(2, expect.any(Uint8Array))

    const testRes = await printTestThermal({ name: 'Warung OTG' })
    expect(testRes).toEqual({ ok: true, method: 'usb' })

    // Uji auto-reconnect USB yang sebelumnya diizinkan (tanpa putus preferensi)
    mockUsbDevice.opened = false
    await disconnectPrinter()
    expect(isPrinterConnected.value).toBe(false)

    // Simulasikan user punya preferensi 'usb' tersimpan saat app dibuka lagi
    const { updatePrinterSettings } = useThermalPrinter()
    updatePrinterSettings({ preferredTransport: 'usb' })
    const reconnected = await autoReconnectPrinter()
    expect(reconnected).toBe(true)
    expect(connectionType.value).toBe('usb')

    // Simulasikan Windows Print Spooler memblokir interface USB (SecurityError / Access Denied)
    await disconnectPrinter()
    claimInterface.mockRejectedValueOnce(Object.assign(new Error('Unable to claim interface.'), { name: 'SecurityError' }))
    const failedWindowsUsb = await connectUsbPrinter()
    expect(failedWindowsUsb).toBe(false)
    expect(printerError.value).toContain('WinUSB (via Zadig)')
    expect(printerError.value).toContain('POS-58')
  })

  it('connects via Web Serial COM port and writes ESC/POS bytes cleanly', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const releaseLock = vi.fn()
    const portClose = vi.fn(async () => {
      mockPort.writable = null
    })
    const mockPort = {
      writable: null,
      open: vi.fn(async () => {
        mockPort.writable = {
          getWriter: () => ({ write, releaseLock })
        }
      }),
      close: portClose,
      getInfo: () => ({ usbVendorId: 0x0483 })
    }

    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: {
        requestPort: vi.fn().mockResolvedValue(mockPort),
        getPorts: vi.fn().mockResolvedValue([mockPort]),
        addEventListener: vi.fn()
      }
    })

    const {
      isSerialSupported,
      connectionType,
      connectedPrinterName,
      connectSerialPrinter,
      printReceiptThermal,
      disconnectPrinter
    } = useThermalPrinter()

    expect(isSerialSupported.value).toBe(true)
    const ok = await connectSerialPrinter()
    expect(ok).toBe(true)
    expect(connectionType.value).toBe('serial')
    expect(connectedPrinterName.value).toContain('Serial Printer')
    expect(mockPort.open).toHaveBeenCalledWith({ baudRate: 9600 })

    const res = await printReceiptThermal(
      { invoiceNumber: 'COM-1', totalAmount: 5000, paymentMethod: 'TUNAI', cashGiven: 5000, changeAmount: 0, items: [] },
      { name: 'Warung Desktop' }
    )
    expect(res).toEqual({ ok: true, method: 'serial' })
    expect(write).toHaveBeenCalled()
    expect(releaseLock).toHaveBeenCalled()

    await disconnectPrinter()
    expect(portClose).toHaveBeenCalled()
    expect(connectionType.value).toBe('none')
  })
})
