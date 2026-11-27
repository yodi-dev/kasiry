import { ref, computed } from 'vue'
import {
  PRINTER_DEFAULT_SETTINGS,
  buildReceiptEscPosBytes,
  buildTestPrintEscPosBytes,
  splitIntoBleChunks
} from '../utils/thermalPrinter'

const STORAGE_KEY = 'kasiry_printer_settings'

// UUID layanan GATT yang umum dipakai oleh berbagai printer thermal Bluetooth (58mm / 80mm)
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
    if (typeof localStorage === 'undefined') return { ...PRINTER_DEFAULT_SETTINGS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...PRINTER_DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      paperWidth: parsed.paperWidth === '80mm' ? '80mm' : '58mm',
      autoPrint: Boolean(parsed.autoPrint),
      footerText: typeof parsed.footerText === 'string'
        ? parsed.footerText
        : PRINTER_DEFAULT_SETTINGS.footerText,
      printerName: typeof parsed.printerName === 'string' ? parsed.printerName : ''
    }
  } catch {
    return { ...PRINTER_DEFAULT_SETTINGS }
  }
}

const printerSettings = ref(loadSavedPrinterSettings())
const isConnectingPrinter = ref(false)
const isPrinting = ref(false)
const connectedPrinterName = ref('')
const printerError = ref('')

let activeDevice = null
let activeCharacteristic = null
let disconnectListenerAttached = false

const isPrinterConnected = ref(false)

export function useThermalPrinter() {
  const isBluetoothSupported = computed(() =>
    typeof navigator !== 'undefined' && Boolean(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function')
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
      ...(partial.printerName !== undefined ? { printerName: String(partial.printerName) } : {})
    }
    persistSettings()
  }

  const resetBleConnection = () => {
    activeCharacteristic = null
    isPrinterConnected.value = false
    connectedPrinterName.value = ''
  }

  const resolveWritableCharacteristic = async (server) => {
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

  const connectGattDevice = async (device) => {
    if (!device?.gatt) {
      throw new Error('Perangkat ini tidak mendukung koneksi GATT Bluetooth.')
    }
    if (!disconnectListenerAttached) {
      device.addEventListener('gattserverdisconnected', resetBleConnection)
      disconnectListenerAttached = true
    }

    const server = device.gatt.connected ? device.gatt : await device.gatt.connect()
    const characteristic = await resolveWritableCharacteristic(server)
    activeDevice = device
    activeCharacteristic = characteristic
    connectedPrinterName.value = device.name || 'Printer Thermal BT'
    isPrinterConnected.value = true
    updatePrinterSettings({ printerName: connectedPrinterName.value })
    return connectedPrinterName.value
  }

  const connectBluetoothPrinter = async () => {
    printerError.value = ''
    if (!isBluetoothSupported.value) {
      printerError.value = 'Browser atau perangkat ini belum mendukung Web Bluetooth. Gunakan Cetak Browser/USB.'
      return false
    }

    isConnectingPrinter.value = true
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: THERMAL_PRINTER_SERVICE_UUIDS
      })
      disconnectListenerAttached = false
      await connectGattDevice(device)
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

  const disconnectBluetoothPrinter = () => {
    try {
      if (activeDevice?.gatt?.connected) {
        activeDevice.gatt.disconnect()
      }
    } catch {
      // Abaikan error saat memutus GATT
    }
    activeDevice = null
    disconnectListenerAttached = false
    resetBleConnection()
  }

  const writeEscPosBytes = async (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return false
    if (!activeCharacteristic && activeDevice) {
      await connectGattDevice(activeDevice)
    }
    if (!activeCharacteristic) {
      throw new Error('Printer Bluetooth belum terhubung.')
    }

    const sendWithSize = async (chunkSize) => {
      const chunks = splitIntoBleChunks(bytes, chunkSize)
      for (const chunk of chunks) {
        if (activeCharacteristic.properties?.writeWithoutResponse && typeof activeCharacteristic.writeValueWithoutResponse === 'function') {
          await activeCharacteristic.writeValueWithoutResponse(chunk)
        } else if (typeof activeCharacteristic.writeValueWithResponse === 'function') {
          await activeCharacteristic.writeValueWithResponse(chunk)
        } else {
          await activeCharacteristic.writeValue(chunk)
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

  const printReceiptThermal = async (receiptData, storeProfile = {}, { forceBrowser = false } = {}) => {
    printerError.value = ''
    const hasActiveBle = !forceBrowser && (isPrinterConnected.value || Boolean(activeDevice))

    if (hasActiveBle) {
      isPrinting.value = true
      try {
        const bytes = buildReceiptEscPosBytes(receiptData, storeProfile, printerSettings.value)
        await writeEscPosBytes(bytes)
        return { ok: true, method: 'bluetooth' }
      } catch (err) {
        printerError.value = err?.message || 'Gagal mencetak lewat Bluetooth, dialihkan ke dialog cetak browser.'
        resetBleConnection()
      } finally {
        isPrinting.value = false
      }
    }

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print()
      return { ok: true, method: 'browser' }
    }
    return { ok: false, method: 'none' }
  }

  const printTestThermal = async (storeProfile = {}) => {
    printerError.value = ''
    if (isPrinterConnected.value || activeDevice) {
      isPrinting.value = true
      try {
        const bytes = buildTestPrintEscPosBytes(storeProfile, printerSettings.value)
        await writeEscPosBytes(bytes)
        return { ok: true, method: 'bluetooth' }
      } catch (err) {
        printerError.value = err?.message || 'Gagal tes cetak via Bluetooth.'
        resetBleConnection()
        return { ok: false, method: 'bluetooth', error: printerError.value }
      } finally {
        isPrinting.value = false
      }
    }

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print()
      return { ok: true, method: 'browser' }
    }
    return { ok: false, method: 'none' }
  }

  return {
    printerSettings,
    updatePrinterSettings,
    isBluetoothSupported,
    isPrinterConnected,
    isConnectingPrinter,
    isPrinting,
    connectedPrinterName,
    printerError,
    connectBluetoothPrinter,
    disconnectBluetoothPrinter,
    printReceiptThermal,
    printTestThermal
  }
}
