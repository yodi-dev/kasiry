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

  it('builds ESC/POS receipt bytes for 58mm and 80mm, hiding blank WA phone and showing custom footer', () => {
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

  it('builds test print bytes and splits payloads into BLE MTU chunks', () => {
    const testBytes = buildTestPrintEscPosBytes({ name: 'Warung Tes' }, { paperWidth: '80mm', footerText: 'Mantap!' })
    const decoded = decodeAscii(testBytes)
    expect(decoded).toContain('TES CETAK KASIRY POS')
    expect(decoded).toContain('WARUNG TES')
    expect(decoded).toContain('80mm (48 kol)')
    expect(decoded).toContain('Mantap!')

    const samplePayload = new Uint8Array(190).fill(0x41)
    const chunks80 = splitIntoBleChunks(samplePayload, 80)
    expect(chunks80.map((c) => c.length)).toEqual([80, 80, 30])

    const chunks20 = splitIntoBleChunks(samplePayload, 10) // Dipaksa minimal 20 byte
    expect(chunks20[0].length).toBe(20)
  })
})

describe('useThermalPrinter Composable (Settings Persistence, Web Bluetooth & Fallback)', () => {
  const originalBluetooth = Object.getOwnPropertyDescriptor(navigator, 'bluetooth')
  const originalPrint = window.print

  beforeEach(() => {
    localStorage.clear()
    const { disconnectBluetoothPrinter, updatePrinterSettings } = useThermalPrinter()
    disconnectBluetoothPrinter()
    updatePrinterSettings({ ...PRINTER_DEFAULT_SETTINGS })
  })

  afterEach(() => {
    const { disconnectBluetoothPrinter } = useThermalPrinter()
    disconnectBluetoothPrinter()
    if (originalBluetooth) {
      Object.defineProperty(navigator, 'bluetooth', originalBluetooth)
    } else {
      delete navigator.bluetooth
    }
    window.print = originalPrint
    vi.restoreAllMocks()
  })

  it('persists printer preferences and falls back to window.print() when Bluetooth is disconnected', async () => {
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
      footerText: 'Hatur nuhun!'
    })

    expect(printerSettings.value).toMatchObject({
      paperWidth: '80mm',
      autoPrint: true,
      footerText: 'Hatur nuhun!'
    })
    expect(JSON.parse(localStorage.getItem('kasiry_printer_settings'))).toMatchObject({
      paperWidth: '80mm',
      autoPrint: true,
      footerText: 'Hatur nuhun!'
    })

    const receiptResult = await printReceiptThermal(
      { invoiceNumber: 'INV-1', totalAmount: 10000, paymentMethod: 'TUNAI', items: [] },
      { name: 'Warung Kasiry' }
    )
    expect(receiptResult).toEqual({ ok: true, method: 'browser' })

    const testResult = await printTestThermal({ name: 'Warung Kasiry' })
    expect(testResult).toEqual({ ok: true, method: 'browser' })
    expect(printSpy).toHaveBeenCalledTimes(2)
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
      isBluetoothSupported,
      isPrinterConnected,
      connectedPrinterName,
      connectBluetoothPrinter,
      printReceiptThermal,
      disconnectBluetoothPrinter
    } = useThermalPrinter()

    expect(isBluetoothSupported.value).toBe(true)
    const connected = await connectBluetoothPrinter()
    expect(connected).toBe(true)
    expect(isPrinterConnected.value).toBe(true)
    expect(connectedPrinterName.value).toBe('RPP02N-Thermal')

    // 1. Cetak langsung via Bluetooth (tidak memanggil window.print)
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

    // 2. Uji fallback MTU 20 byte jika paket 80 byte pertama gagal
    writeWithoutResponse.mockReset()
    writeWithoutResponse
      .mockRejectedValueOnce(new Error('GATT write exceeds MTU'))
      .mockResolvedValue(undefined)

    const retryRes = await printReceiptThermal(
      { invoiceNumber: 'INV-BT-2', totalAmount: 5000, paymentMethod: 'QRIS', items: [] },
      { name: 'Warung BT' }
    )
    expect(retryRes).toEqual({ ok: true, method: 'bluetooth' })
    // Paket pertama (80B) gagal, lalu retry pakai 20-byte chunks sehingga setiap chunk <= 20B
    const retriedLengths = writeWithoutResponse.mock.calls.slice(1).map((c) => c[0].length)
    expect(retriedLengths.length).toBeGreaterThan(2)
    expect(Math.max(...retriedLengths)).toBeLessThanOrEqual(20)

    disconnectBluetoothPrinter()
    expect(isPrinterConnected.value).toBe(false)
    expect(connectedPrinterName.value).toBe('')
  })
})
