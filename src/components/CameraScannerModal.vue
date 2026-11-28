<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { X, Camera, SwitchCamera, Zap, ZoomIn, AlertCircle, RefreshCw } from '@lucide/vue'
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
const isZoomed = ref(false)
const hasHardwareZoom = ref(false)
const facingMode = ref('environment') // Kamera belakang secara default

const STANDBY_IDLE_TIMEOUT_MS = 180000 // 3 menit siaga agar izin kamera cukup sekali per sesi
const CAMERA_ACQUIRE_TIMEOUT_MS = 8000 // Cegah getUserMedia menggantung selamanya di PWA iOS
const VIDEO_PLAY_TIMEOUT_MS = 2500 // Cegah video.play() menggantung di WebKit standalone

// Di iOS/iPadOS atau mode PWA standalone, menahan track siaga (enabled=false)
// sering membuat AVCaptureSession WebKit macet/loading terus saat dibuka ulang.
const isAppleMobileOrStandalone = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleTouch =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    navigator.standalone === true ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  return isAppleTouch || isStandalone
}

let stream = null
let standbyStream = null
let standbyFacing = null
let standbyIdleTimer = null
const grantedDeviceIds = {}
let scanTimerId = null
let nativeDetector = null
let zxingReader = null
let scanCanvas = null
let scanCtx = null
let frameCounter = 0
let cameraSessionId = 0
let hwZoomRange = { min: 1, max: 1 }

const scannerHintText = computed(() => {
  return facingMode.value === 'user'
    ? 'Kamera depan • Jaga jarak ±25–35 cm agar fokus'
    : 'Posisikan barcode di dalam kotak'
})

const videoTransformStyle = computed(() => {
  const zoomScale = isZoomed.value && !hasHardwareZoom.value ? 1.65 : 1
  const flipX = facingMode.value === 'user' ? -1 : 1
  return {
    transform: `scale(${flipX * zoomScale}, ${zoomScale})`
  }
})

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

// Audio Beep saat barcode berhasil terdeteksi
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
  pauseCameraToStandby()
  emit('scan', cleanCode)
}

// Tingkatkan kontras luminansi untuk barcode soft-focus / pantulan cahaya kamera depan
const boostBarcodeContrast = (ctx, w, h) => {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  let minLuma = 255
  let maxLuma = 0

  for (let i = 0; i < data.length; i += 8) {
    const luma = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
    if (luma < minLuma) minLuma = luma
    if (luma > maxLuma) maxLuma = luma
  }

  const range = maxLuma - minLuma
  if (range < 12 || range > 210) return

  const scale = 255 / range
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
    const stretched = Math.max(0, Math.min(255, Math.round((luma - minLuma) * scale)))
    data[i] = stretched
    data[i + 1] = stretched
    data[i + 2] = stretched
  }
  ctx.putImageData(imageData, 0, 0)
}

// Gambar frame video ke kanvas dengan variasi crop, mirror kamera depan, rotasi 90°, & boost kontras
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
  const mode = frameCounter % 5
  const isFront = facingMode.value === 'user'

  // Saat mode Zoom 2x digital (tanpa hardware zoom) atau pass fokus rapat, persempit crop tengah
  const tightZoom = isZoomed.value || mode === 1 || mode === 3
  const fullFrame = !isZoomed.value && mode === 4 && !isFront

  const cropRatioW = fullFrame ? 1 : tightZoom ? 0.58 : 0.84
  const cropRatioH = fullFrame ? 1 : tightZoom ? 0.42 : 0.62

  const sw = Math.max(1, Math.round(vw * cropRatioW))
  const sh = Math.max(1, Math.round(vh * cropRatioH))
  const sx = Math.round((vw - sw) / 2)
  const sy = Math.round((vh - sh) / 2)

  // Rotasi 90° berkala untuk menangkap barcode yang dipegang vertikal
  const rotate90 = mode === 4 && isFront
  const maxTarget = 840
  const maxDim = Math.max(sw, sh)
  const scale = maxDim > maxTarget ? maxTarget / maxDim : 1
  const rw = Math.max(1, Math.round(sw * scale))
  const rh = Math.max(1, Math.round(sh * scale))

  const dw = rotate90 ? rh : rw
  const dh = rotate90 ? rw : rh

  if (scanCanvas.width !== dw || scanCanvas.height !== dh) {
    scanCanvas.width = dw
    scanCanvas.height = dh
  }

  scanCtx.save()
  scanCtx.setTransform(1, 0, 0, 1, 0, 0)

  const flipHorizontally = isFront && (mode === 2 || mode === 3)
  if (rotate90) {
    scanCtx.translate(dw / 2, dh / 2)
    scanCtx.rotate(Math.PI / 2)
    if (flipHorizontally) scanCtx.scale(-1, 1)
    scanCtx.drawImage(video, sx, sy, sw, sh, -rw / 2, -rh / 2, rw, rh)
  } else {
    if (flipHorizontally) {
      scanCtx.translate(dw, 0)
      scanCtx.scale(-1, 1)
    }
    scanCtx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
  }
  scanCtx.restore()

  // Pada kamera depan / kondisi blur close-up, tingkatkan kontras hitam-putih pada pass tertentu
  if (mode === 3 || (isFront && mode === 1)) {
    boostBarcodeContrast(scanCtx, dw, dh)
  }

  return true
}

const decodeWithZxing = (reader, luminance, useHistogramFirst) => {
  const tryBinarizer = (BinarizerClass) => {
    try {
      const result = reader.decodeWithState(new BinaryBitmap(new BinarizerClass(luminance)))
      return result?.getText?.() || null
    } catch {
      return null
    }
  }

  if (useHistogramFirst) {
    return tryBinarizer(GlobalHistogramBinarizer) || tryBinarizer(HybridBinarizer)
  }
  return tryBinarizer(HybridBinarizer) || tryBinarizer(GlobalHistogramBinarizer)
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
        nativeDetector = null
      }
    }

    // 2. Decode via @zxing/library (coba GlobalHistogram + Hybrid pada kamera depan untuk tahan blur)
    const reader = getZxingReader()
    const luminance = new HTMLCanvasElementLuminanceSource(scanCanvas)
    const decoded = decodeWithZxing(reader, luminance, facingMode.value === 'user' || frameCounter % 2 === 0)
    if (decoded) {
      handleDetectedCode(decoded)
      return
    }
  }

  if (isScanning.value && props.isOpen) {
    scanTimerId = window.setTimeout(scanFrame, 105)
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

const clearStandbyIdleTimer = () => {
  if (standbyIdleTimer) {
    clearTimeout(standbyIdleTimer)
    standbyIdleTimer = null
  }
}

const releaseStandbyStream = () => {
  clearStandbyIdleTimer()
  if (standbyStream) {
    releaseStream(standbyStream)
    standbyStream = null
    standbyFacing = null
  }
}

const acquireCameraWithTimeout = async (constraints) => {
  let timerId = null
  let timedOut = false
  const streamPromise = navigator.mediaDevices.getUserMedia(constraints).then((resolvedStream) => {
    if (timedOut) {
      releaseStream(resolvedStream)
      return null
    }
    return resolvedStream
  })

  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      timedOut = true
      const err = new Error('Waktu tunggu pembukaan kamera habis.')
      err.name = 'CameraTimeoutError'
      reject(err)
    }, CAMERA_ACQUIRE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([streamPromise, timeoutPromise])
  } finally {
    if (timerId !== null) clearTimeout(timerId)
  }
}

const playVideoSafely = async (video, mediaStream) => {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('muted', '')
  video.srcObject = mediaStream

  let timerId = null
  try {
    const playPromise = video.play()
    if (playPromise && typeof playPromise.then === 'function') {
      await Promise.race([
        playPromise,
        new Promise((resolve) => {
          timerId = window.setTimeout(resolve, VIDEO_PLAY_TIMEOUT_MS)
        })
      ])
    }
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      const playErr = new Error('Pemutaran pratinjau kamera diblokir oleh mode PWA.')
      playErr.name = 'VideoPlayNotAllowedError'
      throw playErr
    }
    throw err
  } finally {
    if (timerId !== null) clearTimeout(timerId)
  }
}

const acquireCameraStream = async (targetFacing) => {
  const useSavedDeviceId = !isAppleMobileOrStandalone()
  const savedDeviceId = useSavedDeviceId ? grantedDeviceIds[targetFacing] : null
  const attempts = []
  if (savedDeviceId) {
    attempts.push({
      audio: false,
      video: {
        deviceId: { exact: savedDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    })
  }
  attempts.push(
    {
      audio: false,
      video: {
        facingMode: { exact: targetFacing },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    },
    {
      audio: false,
      video: {
        facingMode: { ideal: targetFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    {
      audio: false,
      video: { facingMode: targetFacing }
    }
  )

  let lastErr = null
  for (let i = 0; i < attempts.length; i++) {
    const constraints = attempts[i]
    try {
      return await acquireCameraWithTimeout(constraints)
    } catch (err) {
      lastErr = err
      const isConstraintIssue = err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError'
      const isSavedDeviceMissing = savedDeviceId && i === 0 && err?.name === 'NotFoundError'
      if (isSavedDeviceMissing) {
        delete grantedDeviceIds[targetFacing]
      }
      if (!isConstraintIssue && !isSavedDeviceMissing) throw err
    }
  }
  throw lastErr
}

const applyZoomConstraint = async (zoomEnabled) => {
  if (!stream || !hasHardwareZoom.value) return
  const track = stream.getVideoTracks()[0]
  if (!track || typeof track.applyConstraints !== 'function') return
  const target = zoomEnabled
    ? Math.min(hwZoomRange.max, Math.max(hwZoomRange.min, hwZoomRange.min + (hwZoomRange.max - hwZoomRange.min) * 0.35, 1.8))
    : hwZoomRange.min
  try {
    await track.applyConstraints({ advanced: [{ zoom: target }] })
  } catch {
    // Jatuh kembali ke zoom digital crop jika constraint ditolak driver
    hasHardwareZoom.value = false
  }
}

const startCamera = async (delayMs = 0) => {
  isScanning.value = false
  if (scanTimerId) {
    clearTimeout(scanTimerId)
    scanTimerId = null
  }
  if (stream) {
    releaseStream(stream)
    stream = null
  }
  const session = ++cameraSessionId
  hasError.value = false
  errorMessage.value = ''
  isLoading.value = true
  isTorchOn.value = false
  isTorchSupported.value = false
  isZoomed.value = false
  hasHardwareZoom.value = false
  hwZoomRange = { min: 1, max: 1 }
  frameCounter = 0

  const canReuseStandby =
    !!standbyStream &&
    standbyFacing === facingMode.value &&
    standbyStream.getVideoTracks().some(track => track.readyState === 'live' && !track.muted)

  if (!canReuseStandby) {
    releaseStandbyStream()
  }

  if (delayMs > 0) {
    await new Promise(resolve => window.setTimeout(resolve, delayMs))
    if (session !== cameraSessionId || !props.isOpen) return
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    isLoading.value = false
    hasError.value = true
    errorMessage.value = 'Kamera tidak tersedia. Pastikan aplikasi dibuka lewat koneksi HTTPS yang aman dan izin kamera aktif.'
    return
  }

  try {
    let acquiredStream = null
    if (canReuseStandby && standbyStream) {
      clearStandbyIdleTimer()
      acquiredStream = standbyStream
      standbyStream = null
      standbyFacing = null
      acquiredStream.getVideoTracks().forEach(track => {
        track.enabled = true
      })
    } else {
      acquiredStream = await acquireCameraStream(facingMode.value)
    }

    // Jika modal ditutup atau kamera diganti lagi saat izin/stream menunggu, langsung matikan stream
    if (!props.isOpen || session !== cameraSessionId) {
      releaseStream(acquiredStream)
      return
    }

    stream = acquiredStream
    const video = videoRef.value
    if (video) {
      await playVideoSafely(video, stream)
      await waitForVideoReady(video)
    }

    if (!props.isOpen || session !== cameraSessionId) {
      stopCamera()
      return
    }

    // Simpan deviceId & periksa dukungan senter, zoom optik/digital, serta autofokus kontinu
    const track = stream.getVideoTracks()[0]
    const detectedDeviceId = track && typeof track.getSettings === 'function' ? track.getSettings()?.deviceId : null
    if (detectedDeviceId) {
      grantedDeviceIds[facingMode.value] = detectedDeviceId
    }
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities()
      isTorchSupported.value = !!capabilities.torch
      if (capabilities.zoom && typeof capabilities.zoom.max === 'number' && capabilities.zoom.max > 1) {
        hasHardwareZoom.value = true
        hwZoomRange = {
          min: capabilities.zoom.min || 1,
          max: capabilities.zoom.max
        }
      }
      if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
      }
    }

    nativeDetector = await initNativeDetector()
    getZxingReader()

    if (!props.isOpen || session !== cameraSessionId) {
      stopCamera()
      return
    }

    isLoading.value = false
    isScanning.value = true
    scanTimerId = window.setTimeout(scanFrame, 120)
  } catch (err) {
    if (session !== cameraSessionId) return
    if (stream) {
      releaseStream(stream)
      stream = null
    }
    isLoading.value = false
    hasError.value = true
    if (err.name === 'CameraTimeoutError') {
      errorMessage.value = 'Kamera tidak merespons. Di PWA iOS, pastikan izin kamera aktif di Pengaturan → Safari → Kamera, lalu ketuk "Coba Lagi" atau tutup & buka ulang aplikasi PWA.'
    } else if (err.name === 'VideoPlayNotAllowedError') {
      errorMessage.value = 'Mode PWA menahan pemutaran pratinjau kamera otomatis. Ketuk "Coba Lagi" untuk menyalakan kamera.'
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage.value = "Izin kamera ditolak. Silakan berikan izin akses kamera pada peramban Anda (pilih 'Izinkan saat mengunjungi situs' agar tidak ditanya ulang)."
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage.value = 'Perangkat kamera yang dipilih tidak ditemukan di perangkat ini.'
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage.value = 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.'
    } else {
      errorMessage.value = 'Tidak dapat membuka kamera: ' + (err.message || 'Terjadi kesalahan')
    }
  }
}

const pauseCameraToStandby = () => {
  isScanning.value = false
  if (scanTimerId) {
    clearTimeout(scanTimerId)
    scanTimerId = null
  }
  if (stream) {
    const tracks = stream.getVideoTracks()
    const activeTrack = tracks[0]
    if (isTorchOn.value && activeTrack && typeof activeTrack.applyConstraints === 'function') {
      activeTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {})
    }
    isTorchOn.value = false

    const hasLiveTrack = tracks.some(track => track.readyState === 'live')
    if (hasLiveTrack && !isAppleMobileOrStandalone()) {
      tracks.forEach(track => {
        track.enabled = false
      })
      clearStandbyIdleTimer()
      standbyStream = stream
      standbyFacing = facingMode.value
      stream = null
      standbyIdleTimer = window.setTimeout(releaseStandbyStream, STANDBY_IDLE_TIMEOUT_MS)
    } else {
      releaseStream(stream)
      stream = null
    }
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

const stopCamera = () => {
  isScanning.value = false
  isTorchOn.value = false
  if (scanTimerId) {
    clearTimeout(scanTimerId)
    scanTimerId = null
  }
  if (stream) {
    releaseStream(stream)
    stream = null
  }
  releaseStandbyStream()
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

const toggleZoom = async () => {
  isZoomed.value = !isZoomed.value
  if (hasHardwareZoom.value) {
    await applyZoomConstraint(isZoomed.value)
  }
}

const toggleCamera = () => {
  releaseStandbyStream()
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  startCamera(150)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', releaseStandbyStream)
  window.addEventListener('beforeunload', releaseStandbyStream)
}

watch(() => props.isOpen, (newVal, oldVal) => {
  if (newVal) {
    nextTick(() => {
      startCamera()
    })
  } else if (oldVal) {
    cameraSessionId += 1
    pauseCameraToStandby()
  }
}, { immediate: true })

onUnmounted(() => {
  cameraSessionId += 1
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', releaseStandbyStream)
    window.removeEventListener('beforeunload', releaseStandbyStream)
  }
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
        <!-- Video Stream: Cermin otomatis di kamera depan & support zoom optik/digital -->
        <video 
          ref="videoRef"
          autoplay 
          playsinline 
          muted 
          :style="videoTransformStyle"
          class="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-200"
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
            @click="() => startCamera()" 
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
              {{ scannerHintText }}
            </p>
          </div>
        </template>
      </div>

      <!-- Kamera Control Toolbar (Senter, Zoom, & Putar Kamera) -->
      <div class="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- Tombol Senter (Torch) -->
          <button 
            v-if="isTorchSupported"
            type="button"
            @click="toggleTorch"
            :aria-pressed="isTorchOn"
            class="h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="isTorchOn ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            title="Senter"
          >
            <Zap aria-hidden="true" class="w-3.5 h-3.5" :class="isTorchOn ? 'fill-amber-400' : ''" />
            <span>{{ isTorchOn ? 'Senter Aktif' : 'Senter' }}</span>
          </button>

          <!-- Tombol Zoom 1x / 2x (Membantu kamera depan fokus dari jarak ~25-35 cm) -->
          <button
            v-if="!isLoading && !hasError"
            type="button"
            @click="toggleZoom"
            :aria-pressed="isZoomed"
            class="h-10 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="isZoomed ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            title="Perbesar area bidik"
          >
            <ZoomIn aria-hidden="true" class="w-3.5 h-3.5 text-sky-400" />
            <span>{{ isZoomed ? '2×' : '1×' }}</span>
          </button>

          <!-- Tombol Balik Kamera (Depan / Belakang) -->
          <button 
            type="button"
            @click="toggleCamera"
            class="h-10 px-2.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            :title="facingMode === 'user' ? 'Pindah ke Kamera Belakang' : 'Pindah ke Kamera Depan'"
          >
            <SwitchCamera aria-hidden="true" class="w-3.5 h-3.5 text-sky-400" />
            <span>{{ facingMode === 'user' ? 'Belakang' : 'Depan' }}</span>
          </button>
        </div>

        <button 
          type="button"
          @click="emit('close')"
          class="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl cursor-pointer transition-colors shrink-0"
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
