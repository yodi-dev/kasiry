<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { X, Camera, SwitchCamera, Zap, AlertCircle, RefreshCw } from '@lucide/vue'
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader
} from '@zxing/library'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'scan'])

const videoRef = ref(null)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const isScanning = ref(false)
const isTorchOn = ref(false)
const isTorchSupported = ref(false)
const facingMode = ref('environment') // Kamera belakang secara default
const scannerEngineLabel = ref('Siap memindai')

let stream = null
let scanTimerId = null
let nativeDetector = null
let zxingReader = null
let scanCanvas = null
let scanCtx = null
let frameCounter = 0

// Buat instance ZXing MultiFormatReader sekali saja untuk performa pemindaian kontinyu
const getZxingReader = () => {
  if (!zxingReader) {
    const reader = new MultiFormatReader()
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)
    reader.setHints(hints)
    zxingReader = reader
  }
  return zxingReader
}

// Periksa apakah native BarcodeDetector tersedia DAN mendukung format barcode ritel
const initNativeDetector = async () => {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null
  try {
    const desired = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']
    if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      const validFormats = desired.filter(fmt => supported.includes(fmt))
      if (validFormats.length === 0) return null
      return new window.BarcodeDetector({ formats: validFormats })
    }
    return new window.BarcodeDetector()
  } catch {
    return null
  }
}

// Audio Beep saat barcode berhasil terdeteksi (seperti kasir supermarket)
const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // Abaikan jika audio diblokir browser
  }
}

const handleDetectedCode = (rawCode) => {
  const cleanCode = String(rawCode || '').trim()
  if (!cleanCode || !isScanning.value) return
  isScanning.value = false
  playBeep()
  stopCamera()
  emit('scan', cleanCode)
}

// Gambar frame video ke kanvas tersembunyi (fokus area tengah atau penuh secara bergantian)
const captureFrameToCanvas = (video) => {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  if (!scanCanvas) {
    scanCanvas = document.createElement('canvas')
    scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })
  }
  if (!scanCtx) return false

  frameCounter += 1
  const useFullFrame = frameCounter % 4 === 0
  const cropRatioW = useFullFrame ? 1 : 0.82
  const cropRatioH = useFullFrame ? 1 : 0.62

  const sw = Math.max(1, Math.round(vw * cropRatioW))
  const sh = Math.max(1, Math.round(vh * cropRatioH))
  const sx = Math.round((vw - sw) / 2)
  const sy = Math.round((vh - sh) / 2)

  // Skala sisi terpanjang maksimal 760px agar decode ZXing tetap cepat di orientasi portrait & landscape
  const maxDim = Math.max(sw, sh)
  const scale = maxDim > 760 ? 760 / maxDim : 1
  const dw = Math.max(1, Math.round(sw * scale))
  const dh = Math.max(1, Math.round(sh * scale))

  if (scanCanvas.width !== dw || scanCanvas.height !== dh) {
    scanCanvas.width = dw
    scanCanvas.height = dh
  }

  scanCtx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
  return true
}

// Loop pemindaian hybrid: coba native BarcodeDetector (jika ada), lalu fallback ke ZXing JS
const scanFrame = async () => {
  if (!isScanning.value || !props.isOpen) return

  const video = videoRef.value
  if (video && video.readyState >= 2 && captureFrameToCanvas(video)) {
    // 1. Coba native BarcodeDetector terlebih dahulu jika didukung browser
    if (nativeDetector) {
      try {
        const barcodes = await nativeDetector.detect(scanCanvas)
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleDetectedCode(barcodes[0].rawValue)
          return
        }
      } catch {
        // Jika gagal saat runtime, nonaktifkan native agar langsung memakai ZXing
        nativeDetector = null
      }
    }

    // 2. Fallback universal via @zxing/library (jalan di iOS Safari, Android Chrome/WebView, Firefox, Desktop)
    try {
      const reader = getZxingReader()
      const luminance = new HTMLCanvasElementLuminanceSource(scanCanvas)
      const useHistogram = frameCounter % 2 === 0
      const binarizer = useHistogram
        ? new GlobalHistogramBinarizer(luminance)
        : new HybridBinarizer(luminance)
      const bitmap = new BinaryBitmap(binarizer)
      const result = reader.decodeWithState(bitmap)
      const text = result?.getText?.()
      if (text) {
        handleDetectedCode(text)
        return
      }
    } catch {
      // NotFoundException normal saat frame belum memuat barcode
    }
  }

  if (isScanning.value && props.isOpen) {
    scanTimerId = window.setTimeout(scanFrame, 110)
  }
}

const waitForVideoReady = (video) => {
  return new Promise((resolve) => {
    if (video.videoWidth > 0 && video.readyState >= 2) {
      resolve()
      return
    }
    const onReady = () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('canplay', onReady)
      resolve()
    }
    video.addEventListener('loadedmetadata', onReady, { once: true })
    video.addEventListener('canplay', onReady, { once: true })
    window.setTimeout(onReady, 1500)
  })
}

const releaseStream = (targetStream) => {
  if (!targetStream) return
  targetStream.getTracks().forEach(track => track.stop())
}

const startCamera = async () => {
  stopCamera()
  hasError.value = false
  errorMessage.value = ''
  isLoading.value = true
  isTorchOn.value = false
  isTorchSupported.value = false
  frameCounter = 0

  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    isLoading.value = false
    hasError.value = true
    errorMessage.value = 'Kamera tidak tersedia. Pastikan aplikasi dibuka lewat koneksi HTTPS yang aman dan izin kamera aktif.'
    return
  }

  try {
    let acquiredStream = null
    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode.value },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
    } catch (constraintErr) {
      if (constraintErr?.name === 'OverconstrainedError' || constraintErr?.name === 'ConstraintNotSatisfiedError') {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: facingMode.value }
        })
      } else {
        throw constraintErr
      }
    }

    // Jika modal keburu ditutup saat izin kamera baru selesai diberikan, langsung matikan stream
    if (!props.isOpen) {
      releaseStream(acquiredStream)
      return
    }

    stream = acquiredStream
    const video = videoRef.value
    if (video) {
      video.setAttribute('playsinline', 'true')
      video.srcObject = stream
      await video.play()
      await waitForVideoReady(video)
    }

    // Periksa dukungan senter (torch) & autofokus kontinu pada lensa HP
    const track = stream.getVideoTracks()[0]
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities()
      isTorchSupported.value = !!capabilities.torch
      if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
      }
    }

    nativeDetector = await initNativeDetector()
    getZxingReader()
    scannerEngineLabel.value = nativeDetector ? 'Pindai otomatis aktif (Hybrid)' : 'Pindai otomatis aktif'

    isLoading.value = false
    isScanning.value = true
    scanTimerId = window.setTimeout(scanFrame, 120)
  } catch (err) {
    isLoading.value = false
    hasError.value = true
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage.value = 'Izin kamera ditolak. Silakan berikan izin akses kamera pada peramban Anda.'
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage.value = 'Perangkat kamera tidak ditemukan di perangkat ini.'
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage.value = 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.'
    } else {
      errorMessage.value = 'Tidak dapat membuka kamera: ' + (err.message || 'Terjadi kesalahan')
    }
  }
}

const stopCamera = () => {
  isScanning.value = false
  if (scanTimerId) {
    clearTimeout(scanTimerId)
    scanTimerId = null
  }
  if (stream) {
    releaseStream(stream)
    stream = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

const toggleTorch = async () => {
  if (!stream) return
  const track = stream.getVideoTracks()[0]
  if (track && 'applyConstraints' in track) {
    try {
      const nextState = !isTorchOn.value
      await track.applyConstraints({
        advanced: [{ torch: nextState }]
      })
      isTorchOn.value = nextState
    } catch {
      // Torch tidak didukung pada kondisi ini
    }
  }
}

const toggleCamera = () => {
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  startCamera()
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      startCamera()
    })
  } else {
    stopCamera()
  }
})

onUnmounted(() => {
  stopCamera()
  zxingReader = null
  nativeDetector = null
})
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-slate-900 text-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <Camera class="w-4 h-4 text-sky-400" />
          <h3 class="font-bold text-sm text-white">Scanner Barcode Kamera</h3>
        </div>
        <button 
          type="button"
          @click="emit('close')"
          aria-label="Tutup scanner kamera"
          class="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="Tutup"
        >
          <X aria-hidden="true" class="w-4 h-4" />
        </button>
      </div>

      <!-- Kamera Viewfinder (Live Video Stream) -->
      <div class="relative bg-black h-84 overflow-hidden flex items-center justify-center">
        <!-- Video Stream: Menempati seluruh area latar belakang secara penuh -->
        <video 
          ref="videoRef"
          autoplay 
          playsinline 
          muted 
          class="absolute inset-0 w-full h-full object-cover z-0"
        ></video>

        <!-- Loading Indicator -->
        <div 
          v-if="isLoading" 
          class="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-2.5 z-30"
        >
          <RefreshCw class="w-6 h-6 text-sky-400 animate-spin" />
          <p class="text-xs text-slate-300 font-medium">Membuka kamera...</p>
        </div>

        <!-- Error State -->
        <div 
          v-if="hasError" 
          class="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-30"
        >
          <AlertCircle class="w-8 h-8 text-rose-500" />
          <p class="text-xs text-slate-300 font-medium leading-relaxed">{{ errorMessage }}</p>
          <button 
            @click="startCamera" 
            class="mt-2 h-9 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Coba Lagi
          </button>
        </div>

        <!-- Frame Bidik & Vignette Overlay (Muncul Saat Kamera Aktif) -->
        <template v-if="!isLoading && !hasError">
          <!-- Vignette 3-Baris: Menggelapkan tepi luar, kotak tengah 100% tembus pandang ke kamera -->
          <div class="absolute inset-0 pointer-events-none flex flex-col z-10">
            <!-- Area Atas (Redup) -->
            <div class="flex-1 bg-black/40"></div>

            <!-- Baris Tengah: Samping Kiri Redup - Kotak Transparan - Samping Kanan Redup -->
            <div class="flex h-44 shrink-0">
              <div class="flex-1 bg-black/40"></div>
              
              <!-- Kotak Bidik Utama (100% Jelas Menampilkan Kamera) -->
              <div class="w-60 h-44 relative border-2 border-sky-400/90 rounded-2xl overflow-hidden shadow-sm">
                <!-- Laser Scan Line Animasi Naik Turun -->
                <div class="absolute inset-x-0 h-0.5 bg-sky-400 shadow-[0_0_10px_#38bdf8] animate-scan-line"></div>

                <!-- 4 Aksen Sudut L-Bracket Scanner -->
                <div class="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-sky-300 rounded-tl-md"></div>
                <div class="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-sky-300 rounded-tr-md"></div>
                <div class="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-sky-300 rounded-bl-md"></div>
                <div class="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-sky-300 rounded-br-md"></div>
              </div>

              <div class="flex-1 bg-black/40"></div>
            </div>

            <!-- Area Bawah (Redup) -->
            <div class="flex-1 bg-black/40"></div>
          </div>

          <!-- Petunjuk Pindai -->
          <div class="absolute bottom-3 inset-x-4 text-center z-20 pointer-events-none">
            <p class="text-[11px] text-white/95 font-medium bg-black/60 backdrop-blur-xs py-1 px-3.5 rounded-full inline-block border border-white/10 shadow-sm">
              Posisikan barcode di dalam kotak • {{ scannerEngineLabel }}
            </p>
          </div>
        </template>
      </div>

      <!-- Kamera Control Toolbar (Senter & Putar Kamera) -->
      <div class="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <!-- Tombol Senter (Torch) -->
          <button 
            v-if="isTorchSupported"
            type="button"
            @click="toggleTorch"
            class="h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="isTorchOn ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            title="Senter"
          >
            <Zap aria-hidden="true" class="w-3.5 h-3.5" :class="isTorchOn ? 'fill-amber-400' : ''" />
            <span>{{ isTorchOn ? 'Senter Aktif' : 'Senter' }}</span>
          </button>

          <!-- Tombol Balik Kamera (Depan / Belakang) -->
          <button 
            type="button"
            @click="toggleCamera"
            class="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Ganti Kamera"
          >
            <SwitchCamera aria-hidden="true" class="w-3.5 h-3.5 text-sky-400" />
            <span>Balik</span>
          </button>
        </div>

        <button 
          type="button"
          @click="emit('close')"
          class="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl cursor-pointer transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scanline {
  0% {
    transform: translateY(0);
    opacity: 0.6;
  }
  50% {
    transform: translateY(168px);
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 0.6;
  }
}

.animate-scan-line {
  animation: scanline 2.2s ease-in-out infinite;
}
</style>
