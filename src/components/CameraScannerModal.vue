<script setup>
import { X, Camera, Zap } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'simulateScan'])

const sampleBarcodes = [
  { code: '8998866200224', label: 'Indomie Goreng (Katalog Ada)' },
  { code: '8991389221148', label: 'Le Minerale 600ml (Katalog Ada)' },
  { code: '8999999712345', label: 'Sunlight 210ml (Katalog Ada)' },
  { code: '8993005123999', label: 'Biskuit Baru (Belum Terdaftar)' }
]

const handlePickSample = (code) => {
  emit('simulateScan', code)
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-slate-900 text-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Camera class="w-4 h-4 text-sky-400" />
          <h3 class="font-bold text-sm text-white">Scanner Barcode Kamera</h3>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Kamera Viewfinder -->
      <div class="relative bg-black h-56 flex flex-col items-center justify-center overflow-hidden">
        <!-- Laser Scan -->
        <div class="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>

        <!-- Frame Bidik -->
        <div class="w-44 h-32 border-2 border-emerald-400/80 rounded-xl relative flex items-center justify-center">
          <span class="text-[10px] font-medium text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded-full absolute -top-2.5">
            Arahkan Barcode ke Sini
          </span>
          <p class="text-xs text-slate-400 text-center px-2 font-normal">
            Kamera otomatis memindai barcode EAN-13
          </p>
        </div>
      </div>

      <!-- Simulator Barcode -->
      <div class="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2">
        <p class="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Zap class="w-3.5 h-3.5 text-amber-400" /> Simulasi Tembak Barcode:
        </p>
        <div class="grid grid-cols-1 gap-1.5">
          <button 
            v-for="s in sampleBarcodes" 
            :key="s.code"
            @click="handlePickSample(s.code)"
            class="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-left cursor-pointer transition-colors flex items-center justify-between"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-white">{{ s.label }}</p>
              <p class="text-[10px] font-mono text-slate-400">{{ s.code }}</p>
            </div>
            <span class="text-[10px] font-semibold bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded">
              Pindai
            </span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
        <button 
          @click="emit('close')"
          class="h-8 px-3.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-lg cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
