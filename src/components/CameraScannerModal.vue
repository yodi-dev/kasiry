<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { X, Camera, SwitchCamera, Zap, AlertCircle, RefreshCw } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'scan', 'simulateScan'])

const videoRef = ref(null)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const isScanning = ref(false)
const isTorchOn = ref(false)
const isTorchSupported = ref(false)
const isBarcodeDetectorSupported = ref(true)
const facingMode = ref('environment') // Kamera belakang secara default

let stream = null
let scanAnimationId = null
let barcodeDetector = null

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
  } catch (e) {
    // Ignore audio error
  }
}

// Loop pemindaian barcode dengan BarcodeDetector API
const scanLoop = async () => {
  if (!isScanning.value || !videoRef.value || !barcodeDetector) return

  if (videoRef.value.readyState >= 2) {
    try {
      const barcodes = await barcodeDetector.detect(videoRef.value)
      if (barcodes && barcodes.length > 0) {
        const rawCode = barcodes[0].rawValue
        if (rawCode) {
          isScanning.value = false
          playBeep()
          stopCamera()
          emit('scan', rawCode)
          emit('simulateScan', rawCode)
          return
        }
      }
    } catch (err) {
      // Lanjutkan loop frame berikutnya
    }
  }

  if (isScanning.value) {
    scanAnimationId = requestAnimationFrame(scanLoop)
  }
}

const startCamera = async () => {
  hasError.value = false
  errorMessage.value = ''
  isLoading.value = true
  isTorchOn.value = false

  try {
    const constraints = {
      video: {
        facingMode: { ideal: facingMode.value },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints)
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play()
    }

    // Periksa dukungan senter (torch)
    const track = stream.getVideoTracks()[0]
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities()
      isTorchSupported.value = !!capabilities.torch
    }

    isLoading.value = false
    isScanning.value = true

    // Inisialisasi BarcodeDetector API bawaan peramban
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
        })
      } catch (e) {
        barcodeDetector = new window.BarcodeDetector()
      }
      scanAnimationId = requestAnimationFrame(scanLoop)
    } else {
      isBarcodeDetectorSupported.value = false
    }
  } catch (err) {
    isLoading.value = false
    hasError.value = true
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage.value = 'Izin kamera ditolak. Silakan berikan izin akses kamera pada peramban Anda.'
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage.value = 'Perangkat kamera tidak ditemukan di perangkat ini.'
    } else {
      errorMessage.value = 'Tidak dapat membuka kamera: ' + (err.message || 'Terjadi kesalahan')
    }
  }
}

const stopCamera = () => {
  isScanning.value = false
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId)
    scanAnimationId = null
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
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
      isTorchOn.value = !isTorchOn.value
      await track.applyConstraints({
        advanced: [{ torch: isTorchOn.value }]
      })
    } catch (e) {
      // Torch gagal
    }
  }
}

const toggleCamera = () => {
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  stopCamera()
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
          @click="emit('close')"
          class="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Kamera Viewfinder (Live Video Stream) -->
      <div class="relative bg-black h-80 flex flex-col items-center justify-center overflow-hidden">
        <!-- Video Stream -->
        <video 
          ref="videoRef"
          autoplay 
          playsinline 
          muted 
          class="w-full h-full object-cover"
        ></video>

        <!-- Loading Indicator -->
        <div 
          v-if="isLoading" 
          class="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2.5 z-10"
        >
          <RefreshCw class="w-6 h-6 text-sky-400 animate-spin" />
          <p class="text-xs text-slate-300 font-medium">Membuka kamera...</p>
        </div>

        <!-- Error State -->
        <div 
          v-if="hasError" 
          class="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-10"
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

        <!-- Frame Bidik & Garis Laser Scanner (Muncul Saat Kamera Aktif) -->
        <template v-if="!isLoading && !hasError">
          <!-- Laser Scan Line -->
          <div class="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse z-10 pointer-events-none"></div>

          <!-- Frame Bidik Kaca -->
          <div class="w-52 h-40 border-2 border-sky-400/90 rounded-2xl relative flex items-center justify-center z-10 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <span class="text-[10px] font-bold text-sky-400 bg-slate-950/90 px-2.5 py-0.5 rounded-full absolute -top-3 shadow-sm tracking-wide">
              Arahkan Barcode ke Sini
            </span>
          </div>

          <!-- Petunjuk Pindai -->
          <div class="absolute bottom-3 inset-x-4 text-center z-10 pointer-events-none">
            <p class="text-[11px] text-white/90 font-medium bg-black/50 backdrop-blur-xs py-1 px-3 rounded-full inline-block">
              Posisikan barcode EAN-13 / Code-128 di tengah kotak
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
            @click="toggleTorch"
            class="h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="isTorchOn ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            title="Senter"
          >
            <Zap class="w-3.5 h-3.5" :class="isTorchOn ? 'fill-amber-400' : ''" />
            <span>{{ isTorchOn ? 'Senter Aktif' : 'Senter' }}</span>
          </button>

          <!-- Tombol Balik Kamera (Depan / Belakang) -->
          <button 
            @click="toggleCamera"
            class="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Ganti Kamera"
          >
            <SwitchCamera class="w-3.5 h-3.5 text-sky-400" />
            <span>Balik</span>
          </button>
        </div>

        <button 
          @click="emit('close')"
          class="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl cursor-pointer transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
