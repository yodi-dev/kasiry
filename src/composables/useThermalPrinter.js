import { ref, computed } from 'vue'
import {
  PRINTER_DEFAULT_SETTINGS,
  buildReceiptEscPosBytes,
  buildTestPrintEscPosBytes,
  buildReceiptPrintHtml,
  buildTestPrintHtml,
  splitIntoBleChunks
} from '../utils/thermalPrinter'

const STORAGE_KEY = 'kasiry_printer_settings'

// UUID layanan GATT yang umum dipakai oleh berbagai printer thermal Bluetooth BLE (58mm / 80mm)
const THERMAL_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb'
]

function loadSavedPrinterSettings() {
  try {
    if (typeof localStorage === 'undefined') return { ...PRINTER_DEFAULT_SETTINGS, preferredTransport: '', serialBaudRate: 9600 }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...PRINTER_DEFAULT_SETTINGS, preferredTransport: '', serialBaudRate: 9600 }
    const parsed = JSON.parse(raw)
    return {
      paperWidth: parsed.paperWidth === '80mm' ? '80mm' : '58mm',
      autoPrint: Boolean(parsed.autoPrint),
      footerText: typeof parsed.footerText === 'string'
        ? parsed.footerText
        : PRINTER_DEFAULT_SETTINGS.footerText,
      printerName: typeof parsed.printerName === 'string' ? parsed.printerName : '',
      preferredTransport: ['bluetooth', 'usb', 'serial'].includes(parsed.preferredTransport)
        ? parsed.preferredTransport
        : '',
      serialBaudRate: [9600, 19200, 38400, 57600, 115200].includes(Number(parsed.serialBaudRate))
        ? Number(parsed.serialBaudRate)
        : 9600
    }
  } catch {
    return { ...PRINTER_DEFAULT_SETTINGS, preferredTransport: '', serialBaudRate: 9600 }
  }
}

const printerSettings = ref(loadSavedPrinterSettings())
const connectionType = ref('none') // 'none' | 'bluetooth' | 'usb' | 'serial'
const isConnectingPrinter = ref(false)
const isPrinting = ref(false)
const connectedPrinterName = ref('')
const printerError = ref('')

// Active hardware handles (singleton across App, ReceiptModal, SettingsModal)
let activeBleDevice = null
let activeBleCharacteristic = null
let bleDisconnectListenerAttached = false

let activeUsbDevice = null
let activeUsbInterfaceNumber = 0
let activeUsbEndpointOut = 1
let usbDisconnectListenerAttached = false

let activeSerialPort = null
let serialDisconnectListenerAttached = false

const isPrinterConnected = computed(() => connectionType.value !== 'none')

function printHtmlViaBrowserFallback(html = '') {
  if (typeof window === 'undefined') return false

  // Gunakan iframe terisolasi jika HTML & browser print iframe tersedia (menghindari CSS modal/backdrop-blur)
  const isTestDomShim = typeof navigator !== 'undefined' && /HappyDOM|jsdom/i.test(navigator.userAgent || '')
  if (!isTestDomShim && html && typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
    try {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:0;'
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(html)
        doc.close()

        const cleanup = () => {
          try {
            iframe.remove()
          } catch {
            // Abaikan error saat membersihkan iframe
          }
        }

        if (typeof iframe.contentWindow?.print === 'function') {
          try {
            iframe.contentWindow.addEventListener?.('afterprint', cleanup, { once: true })
          } catch {
            // Abaikan bila event listener afterprint tidak tersedia
          }
          iframe.contentWindow.focus?.()
          iframe.contentWindow.print()
          setTimeout(cleanup, 60000)
          return true
        }
        cleanup()
      } else {
        iframe.remove()
      }
    } catch {
      // Fallback ke window.print() bila iframe print terblokir sandbox
    }
  }

  if (typeof window.print === 'function') {
    window.print()
    return true
  }
  return false
}

function mapUsbClaimErrorMessage(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  const name = String(err?.name || '')
  if (
    name === 'SecurityError' ||
    name === 'NetworkError' ||
    msg.includes('unable to claim interface') ||
    msg.includes('access denied') ||
    msg.includes('protected interface')
  ) {
    return 'Port USB printer sedang dipakai driver Windows (Print Spooler). Untuk cetak dari Windows lewat jalur USB ini, ubah driver USB-nya ke WinUSB (via Zadig), atau install driver POS-58 + pakai Cetak Browser.'
  }
  return err?.message || 'Gagal menghubungkan ke printer USB.'
}

export function useThermalPrinter() {
  const isBluetoothSupported = computed(() =>
    typeof navigator !== 'undefined' && Boolean(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function')
  )
  const isUsbSupported = computed(() =>
    typeof navigator !== 'undefined' && Boolean(navigator.usb && typeof navigator.usb.requestDevice === 'function')
  )
  const isSerialSupported = computed(() =>
    typeof navigator !== 'undefined' && Boolean(navigator.serial && typeof navigator.serial.requestPort === 'function')
  )

  const persistSettings = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(printerSettings.value))
      }
    } catch {
      // Abaikan jika penyimpanan browser penuh / mode privat
    }
  }

  const updatePrinterSettings = (partial = {}) => {
    printerSettings.value = {
      ...printerSettings.value,
      ...(partial.paperWidth !== undefined
        ? { paperWidth: partial.paperWidth === '80mm' ? '80mm' : '58mm' }
        : {}),
      ...(partial.autoPrint !== undefined ? { autoPrint: Boolean(partial.autoPrint) } : {}),
      ...(partial.footerText !== undefined ? { footerText: String(partial.footerText).slice(0, 120) } : {}),
      ...(partial.printerName !== undefined ? { printerName: String(partial.printerName) } : {}),
      ...(partial.preferredTransport !== undefined
        ? { preferredTransport: ['bluetooth', 'usb', 'serial', ''].includes(partial.preferredTransport) ? partial.preferredTransport : '' }
        : {}),
      ...(partial.serialBaudRate !== undefined && [9600, 19200, 38400, 57600, 115200].includes(Number(partial.serialBaudRate))
        ? { serialBaudRate: Number(partial.serialBaudRate) }
        : {})
    }
    persistSettings()
  }

  const clearConnectionState = (targetType = null) => {
    if (targetType && connectionType.value !== targetType) return
    connectionType.value = 'none'
    connectedPrinterName.value = ''
  }

  const closeCurrentHandles = async ({ forgetDevice = false } = {}) => {
    try {
      if (activeBleDevice?.gatt?.connected) {
        activeBleDevice.gatt.disconnect()
      }
    } catch {
      // Abaikan
    }
    activeBleCharacteristic = null
    if (forgetDevice) {
      activeBleDevice = null
      bleDisconnectListenerAttached = false
    }

    try {
      if (activeUsbDevice?.opened) {
        await activeUsbDevice.close()
      }
    } catch {
      // Abaikan
    }
    if (forgetDevice) {
      activeUsbDevice = null
    }

    try {
      if (activeSerialPort) {
        await activeSerialPort.close()
      }
    } catch {
      // Abaikan
    }
    if (forgetDevice) {
      activeSerialPort = null
    }

    clearConnectionState()
  }

  // -------------------- 1. WEB BLUETOOTH (BLE GATT) --------------------
  const resolveWritableBleCharacteristic = async (server) => {
    const services = await server.getPrimaryServices()
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics()
        const writable = chars.find(
          c => c.properties?.writeWithoutResponse || c.properties?.write
        )
        if (writable) return writable
      } catch {
        // Lewati service yang membatasi akses karakteristik
      }
    }
    throw new Error('Karakteristik cetak tidak ditemukan di perangkat Bluetooth ini.')
  }

  const connectBleGattDevice = async (device) => {
    if (!device?.gatt) {
      throw new Error('Perangkat ini tidak mendukung koneksi GATT Bluetooth.')
    }
    if (!bleDisconnectListenerAttached) {
      device.addEventListener('gattserverdisconnected', () => {
        activeBleCharacteristic = null
        clearConnectionState('bluetooth')
      })
      bleDisconnectListenerAttached = true
    }

    const server = device.gatt.connected ? device.gatt : await device.gatt.connect()
    const characteristic = await resolveWritableBleCharacteristic(server)
    activeBleDevice = device
    activeBleCharacteristic = characteristic
    connectionType.value = 'bluetooth'
    connectedPrinterName.value = device.name || 'Printer Thermal BT'
    updatePrinterSettings({ printerName: connectedPrinterName.value, preferredTransport: 'bluetooth' })
    return connectedPrinterName.value
  }

  const connectBluetoothPrinter = async () => {
    printerError.value = ''
    if (!isBluetoothSupported.value) {
      printerError.value = 'Browser atau perangkat ini belum mendukung Web Bluetooth. Gunakan Kabel USB / Cetak Browser.'
      return false
    }

    isConnectingPrinter.value = true
    try {
      await closeCurrentHandles({ forgetDevice: true })
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: THERMAL_PRINTER_SERVICE_UUIDS
      })
      bleDisconnectListenerAttached = false
      await connectBleGattDevice(device)
      return true
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        printerError.value = err?.message || 'Gagal menghubungkan ke printer Bluetooth.'
      }
      return false
    } finally {
      isConnectingPrinter.value = false
    }
  }

  // -------------------- 2. WEBUSB (KABEL USB / ANDROID OTG) --------------------
  const resolveUsbPrinterEndpoint = (device) => {
    const interfaces = device?.configuration?.interfaces || []
    // Prioritaskan USB Printer Class (interfaceClass === 7) lalu fallback ke endpoint OUT bulk manapun
    const sorted = [...interfaces].sort((a, b) => {
      const aIsPrinter = a.alternates?.some(alt => alt.interfaceClass === 7) ? 0 : 1
      const bIsPrinter = b.alternates?.some(alt => alt.interfaceClass === 7) ? 0 : 1
      return aIsPrinter - bIsPrinter
    })

    for (const iface of sorted) {
      for (const alt of (iface.alternates || [])) {
        const outEp = (alt.endpoints || []).find(
          ep => ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')
        )
        if (outEp) {
          return {
            interfaceNumber: iface.interfaceNumber,
            alternateSetting: alt.alternateSetting ?? 0,
            endpointNumber: outEp.endpointNumber
          }
        }
      }
    }
    throw new Error('Endpoint cetak OUT tidak ditemukan pada perangkat USB ini.')
  }

  const openAndClaimUsbDevice = async (device) => {
    if (!device) throw new Error('Perangkat USB tidak valid.')
    if (!device.opened) {
      await device.open()
    }
    if (!device.configuration && device.configurations?.length) {
      await device.selectConfiguration(device.configurations[0].configurationValue ?? 1)
    } else if (!device.configuration) {
      await device.selectConfiguration(1)
    }

    const { interfaceNumber, alternateSetting, endpointNumber } = resolveUsbPrinterEndpoint(device)
    await device.claimInterface(interfaceNumber)
    if (alternateSetting && typeof device.selectAlternateInterface === 'function') {
      await device.selectAlternateInterface(interfaceNumber, alternateSetting)
    }

    if (!usbDisconnectListenerAttached && typeof navigator !== 'undefined' && navigator.usb?.addEventListener) {
      navigator.usb.addEventListener('disconnect', (ev) => {
        if (ev?.device && ev.device === activeUsbDevice) {
          activeUsbDevice = null
          clearConnectionState('usb')
        }
      })
      usbDisconnectListenerAttached = true
    }

    activeUsbDevice = device
    activeUsbInterfaceNumber = interfaceNumber
    activeUsbEndpointOut = endpointNumber
    connectionType.value = 'usb'
    connectedPrinterName.value = device.productName || device.manufacturerName || 'Printer USB Thermal'
    updatePrinterSettings({ printerName: connectedPrinterName.value, preferredTransport: 'usb' })
    return connectedPrinterName.value
  }

  const connectUsbPrinter = async () => {
    printerError.value = ''
    if (!isUsbSupported.value) {
      printerError.value = 'Browser ini belum mendukung WebUSB. Gunakan Chrome/Edge di Desktop atau Android OTG.'
      return false
    }

    isConnectingPrinter.value = true
    try {
      await closeCurrentHandles({ forgetDevice: true })
      const device = await navigator.usb.requestDevice({ filters: [] })
      await openAndClaimUsbDevice(device)
      return true
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        printerError.value = mapUsbClaimErrorMessage(err)
      }
      await closeCurrentHandles({ forgetDevice: true })
      return false
    } finally {
      isConnectingPrinter.value = false
    }
  }

  // -------------------- 3. WEB SERIAL (PORT COM / BLUETOOTH SPP) --------------------
  const openSerialPortDevice = async (port) => {
    if (!port) throw new Error('Port Serial tidak valid.')
    if (!port.writable) {
      await port.open({ baudRate: Number(printerSettings.value.serialBaudRate) || 9600 })
    }

    if (!serialDisconnectListenerAttached && typeof navigator !== 'undefined' && navigator.serial?.addEventListener) {
      navigator.serial.addEventListener('disconnect', (ev) => {
        if (ev?.target === activeSerialPort || ev?.port === activeSerialPort) {
          activeSerialPort = null
          clearConnectionState('serial')
        }
      })
      serialDisconnectListenerAttached = true
    }

    const info = typeof port.getInfo === 'function' ? port.getInfo() : {}
    activeSerialPort = port
    connectionType.value = 'serial'
    connectedPrinterName.value = info?.usbVendorId
      ? `Serial Printer (${info.usbVendorId.toString(16).toUpperCase()})`
      : 'Printer Serial / COM'
    updatePrinterSettings({ printerName: connectedPrinterName.value, preferredTransport: 'serial' })
    return connectedPrinterName.value
  }

  const connectSerialPrinter = async () => {
    printerError.value = ''
    if (!isSerialSupported.value) {
      printerError.value = 'Browser ini belum mendukung Web Serial (tersedia di Chrome/Edge Desktop).'
      return false
    }

    isConnectingPrinter.value = true
    try {
      await closeCurrentHandles({ forgetDevice: true })
      const port = await navigator.serial.requestPort()
      await openSerialPortDevice(port)
      return true
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        printerError.value = err?.message || 'Gagal membuka port Serial/COM printer.'
      }
      await closeCurrentHandles({ forgetDevice: true })
      return false
    } finally {
      isConnectingPrinter.value = false
    }
  }

  const disconnectPrinter = async () => {
    await closeCurrentHandles({ forgetDevice: true })
    updatePrinterSettings({ preferredTransport: '' })
  }

  // Alias kompatibilitas dengan pemanggil lama
  const disconnectBluetoothPrinter = disconnectPrinter

  /**
   * Sambung ulang otomatis ke printer USB / Serial yang sebelumnya sudah diizinkan browser.
   */
  const autoReconnectPrinter = async () => {
    if (isPrinterConnected.value) return true
    const pref = printerSettings.value.preferredTransport
    try {
      if (pref === 'usb' && isUsbSupported.value && typeof navigator.usb.getDevices === 'function') {
        const devices = await navigator.usb.getDevices()
        if (devices?.length) {
          await openAndClaimUsbDevice(devices[0])
          return true
        }
      }
      if (pref === 'serial' && isSerialSupported.value && typeof navigator.serial.getPorts === 'function') {
        const ports = await navigator.serial.getPorts()
        if (ports?.length) {
          await openSerialPortDevice(ports[0])
          return true
        }
      }
    } catch {
      // Abaikan jika printer sedang tercabut atau interface dipakai driver OS
    }
    return false
  }

  // -------------------- PENGIRIMAN PAYLOAD ESC/POS --------------------
  const writeBleBytes = async (bytes) => {
    if (!activeBleCharacteristic && activeBleDevice) {
      await connectBleGattDevice(activeBleDevice)
    }
    if (!activeBleCharacteristic) {
      throw new Error('Printer Bluetooth belum terhubung.')
    }

    const sendWithSize = async (chunkSize) => {
      const chunks = splitIntoBleChunks(bytes, chunkSize)
      for (const chunk of chunks) {
        if (activeBleCharacteristic.properties?.writeWithoutResponse && typeof activeBleCharacteristic.writeValueWithoutResponse === 'function') {
          await activeBleCharacteristic.writeValueWithoutResponse(chunk)
        } else if (typeof activeBleCharacteristic.writeValueWithResponse === 'function') {
          await activeBleCharacteristic.writeValueWithResponse(chunk)
        } else {
          await activeBleCharacteristic.writeValue(chunk)
        }
      }
    }

    try {
      await sendWithSize(80)
    } catch {
      // Fallback aman ke MTU minimum BLE 20 byte untuk printer lama
      await sendWithSize(20)
    }
    return true
  }

  const writeUsbBytes = async (bytes) => {
    if (!activeUsbDevice) throw new Error('Printer USB belum terhubung.')
    if (!activeUsbDevice.opened) {
      await openAndClaimUsbDevice(activeUsbDevice)
    }
    const result = await activeUsbDevice.transferOut(activeUsbEndpointOut, bytes)
    if (result?.status && result.status !== 'ok') {
      throw new Error(`Transfer USB gagal (${result.status}).`)
    }
    return true
  }

  const writeSerialBytes = async (bytes) => {
    if (!activeSerialPort) throw new Error('Port Serial printer belum terhubung.')
    if (!activeSerialPort.writable) {
      await openSerialPortDevice(activeSerialPort)
    }
    const writer = activeSerialPort.writable.getWriter()
    try {
      for (const chunk of splitIntoBleChunks(bytes, 256)) {
        await writer.write(chunk)
      }
    } finally {
      writer.releaseLock()
    }
    return true
  }

  const resolveActiveEscPosTransport = () => {
    if (connectionType.value === 'usb' && activeUsbDevice) return 'usb'
    if (connectionType.value === 'serial' && activeSerialPort) return 'serial'
    if ((connectionType.value === 'bluetooth' || activeBleDevice) && (activeBleCharacteristic || activeBleDevice)) return 'bluetooth'
    return 'none'
  }

  const writeActiveTransportBytes = async (transport, bytes) => {
    if (transport === 'usb') return writeUsbBytes(bytes)
    if (transport === 'serial') return writeSerialBytes(bytes)
    if (transport === 'bluetooth') return writeBleBytes(bytes)
    return false
  }

  const dispatchPrint = async ({
    buildEscPos,
    buildHtml,
    forceBrowser = false,
    fallbackToBrowserOnError = true
  }) => {
    printerError.value = ''
    const activeTransport = forceBrowser ? 'none' : resolveActiveEscPosTransport()

    if (activeTransport !== 'none') {
      isPrinting.value = true
      try {
        const bytes = buildEscPos()
        if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
          return { ok: false, method: 'none' }
        }
        await writeActiveTransportBytes(activeTransport, bytes)
        return { ok: true, method: activeTransport }
      } catch (err) {
        printerError.value = activeTransport === 'usb'
          ? mapUsbClaimErrorMessage(err)
          : (err?.message || `Gagal mencetak lewat ${activeTransport}.`)
        await closeCurrentHandles({ forgetDevice: false })
        if (!fallbackToBrowserOnError) {
          return { ok: false, method: activeTransport, error: printerError.value }
        }
      } finally {
        isPrinting.value = false
      }
    }

    const html = buildHtml()
    if (printHtmlViaBrowserFallback(html)) {
      return { ok: true, method: 'browser' }
    }
    return { ok: false, method: 'none', error: printerError.value || 'Cetak browser tidak tersedia.' }
  }

  const printReceiptThermal = async (receiptData, storeProfile = {}, { forceBrowser = false } = {}) => {
    return dispatchPrint({
      buildEscPos: () => buildReceiptEscPosBytes(receiptData, storeProfile, printerSettings.value),
      buildHtml: () => buildReceiptPrintHtml(receiptData, storeProfile, printerSettings.value),
      forceBrowser,
      fallbackToBrowserOnError: true
    })
  }

  const printTestThermal = async (storeProfile = {}) => {
    return dispatchPrint({
      buildEscPos: () => buildTestPrintEscPosBytes(storeProfile, printerSettings.value),
      buildHtml: () => buildTestPrintHtml(storeProfile, printerSettings.value),
      forceBrowser: false,
      fallbackToBrowserOnError: false
    })
  }

  return {
    printerSettings,
    updatePrinterSettings,
    connectionType,
    isBluetoothSupported,
    isUsbSupported,
    isSerialSupported,
    isPrinterConnected,
    isConnectingPrinter,
    isPrinting,
    connectedPrinterName,
    printerError,
    connectBluetoothPrinter,
    connectUsbPrinter,
    connectSerialPrinter,
    disconnectPrinter,
    disconnectBluetoothPrinter,
    autoReconnectPrinter,
    printReceiptThermal,
    printTestThermal
  }
}
