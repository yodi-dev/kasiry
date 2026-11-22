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
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-3 scale-98"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-3 scale-98"
  >
    <!-- Hanya muncul jika ada data di keranjang (itemCount > 0) -->
    <div 
      v-if="itemCount > 0"
      class="w-full bg-[#0a193d]/95 backdrop-blur-xl border border-white/10 text-white rounded-[24px] sm:rounded-[28px] p-3 sm:p-3.5 shadow-2xl shadow-sky-950/30 flex items-center justify-between gap-3"
    >
      <!-- Total Tagihan -->
      <div class="pl-2 sm:pl-3 min-w-0">
        <p class="text-[11px] font-semibold text-sky-200/70 uppercase tracking-wide">
          Total Tagihan ({{ itemCount }} Pcs)
        </p>
        <p class="font-black text-white text-xl sm:text-2xl tracking-tight leading-none mt-0.5">
          Rp {{ totalAmount.toLocaleString('id-ID') }}
        </p>
      </div>

      <!-- Tombol Pembayaran (Teks baru: Pembayaran) -->
      <button 
        @click="emit('openPayment')"
        class="h-11 sm:h-12 px-5 sm:px-8 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 active:scale-95 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-sky-500/30 flex items-center gap-2 cursor-pointer transition-all"
      >
        <span>Pembayaran</span>
        <ArrowRight class="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  </Transition>
</template>
