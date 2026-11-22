<script setup>
import { ArrowRight } from '@lucide/vue'

const props = defineProps({
  totalAmount: {
    type: Number,
    default: 0
  },
  itemCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['openPayment'])
</script>

<template>
  <div class="fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 max-w-4xl mx-auto z-30">
    <div class="bg-[#0a193d]/95 backdrop-blur-xl border border-white/10 text-white rounded-[24px] sm:rounded-[28px] p-3 sm:p-3.5 shadow-2xl shadow-sky-950/30 flex items-center justify-between gap-3">
      <!-- Total Tagihan -->
      <div class="pl-2 sm:pl-3 min-w-0">
        <p class="text-[11px] font-semibold text-sky-200/70 uppercase tracking-wide">
          Total Tagihan ({{ itemCount }} Pcs)
        </p>
        <p class="font-black text-white text-xl sm:text-2xl tracking-tight leading-none mt-0.5">
          Rp {{ totalAmount.toLocaleString('id-ID') }}
        </p>
      </div>

      <!-- Tombol Bayar Sekarang (Vibrant Sky Blue Button) -->
      <button 
        :disabled="totalAmount === 0"
        @click="emit('openPayment')"
        class="h-11 sm:h-12 px-5 sm:px-8 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 active:scale-95 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-sky-500/30 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
      >
        <span>Bayar Sekarang</span>
        <ArrowRight class="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  </div>
</template>
