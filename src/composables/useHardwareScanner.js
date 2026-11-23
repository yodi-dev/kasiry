import { onMounted, onUnmounted } from 'vue'

/**
 * Composable untuk menangkap input Hardware Barcode Scanner (HID Keyboard Emulation)
 * Mendukung USB Barcode Scanner, Bluetooth Barcode Scanner, maupun Wireless 2.4Ghz Dongle.
 * 
 * Karakteristik Hardware Scanner:
 * - Menembakkan deretan karakter ASCII dengan kecepatan sangat tinggi (<50ms per karakter).
 * - Diakhiri dengan karakter 'Enter'.
 * 
 * @param {Object} options
 * @param {Function} options.onScan Callback saat barcode berhasil terdeteksi (code: string)
 * @param {number} [options.maxInterval=55] Batas waktu ms antar tombol untuk dianggap scanner
 * @param {number} [options.minBarcodeLength=3] Panjang minimal karakter barcode
 */
export function useHardwareScanner(options = {}) {
  const {
    onScan,
    maxInterval = 55,
    minBarcodeLength = 3
  } = options

  let buffer = ''
  let lastTime = 0
  let isScanning = false

  const handleKeyDown = (event) => {
    // Abaikan tombol modifier (Ctrl, Alt, Meta)
    if (event.ctrlKey || event.altKey || event.metaKey) return

    const now = Date.now()
    const diff = now - lastTime

    // Jika jeda antar karakter terlalu lama (> maxInterval), reset buffer karena ini ketikan manual manusia
    if (lastTime > 0 && diff > maxInterval) {
      buffer = ''
      isScanning = false
    }

    if (event.key === 'Enter') {
      const code = buffer.trim()
      // Jika buffer memenuhi syarat panjang dan diketik dalam mode burst scanner
      if (code.length >= minBarcodeLength && isScanning) {
        event.preventDefault()
        event.stopPropagation()
        if (typeof onScan === 'function') {
          onScan(code)
        }
      }
      buffer = ''
      lastTime = 0
      isScanning = false
      return
    }

    // Tangkap karakter cetak tunggal (angka, huruf, tanda hubung)
    if (event.key && event.key.length === 1) {
      if (buffer.length === 0) {
        buffer = event.key
        lastTime = now
        isScanning = false
      } else {
        if (diff <= maxInterval) {
          isScanning = true
        }
        buffer += event.key
        lastTime = now
      }
    }
  }

  onMounted(() => {
    // Pasang di capture phase (true) agar mendahului input biasa jika ada burst scanner
    window.addEventListener('keydown', handleKeyDown, true)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
  })

  return {
    resetBuffer: () => {
      buffer = ''
      lastTime = 0
      isScanning = false
    }
  }
}
