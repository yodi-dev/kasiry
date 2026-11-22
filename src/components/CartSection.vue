<script setup>
import { computed } from 'vue'
import { Plus, Minus, Trash2, ShoppingBag } from '@lucide/vue'

const props = defineProps({
  cartItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['increaseQty', 'decreaseQty', 'removeItem', 'clearCart'])

const totalItemCount = computed(() => {
  return props.cartItems.reduce((acc, item) => acc + item.qty, 0)
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-md rounded-3xl border border-white/90 shadow-sm overflow-hidden transition-all">
    <!-- Header Keranjang (Live Struk / Pandangan Mata di Atas) -->
    <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60">
          <ShoppingBag class="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 class="font-bold text-[#0a193d] text-sm leading-tight">
            Struk Belanjaan
          </h3>
          <p class="text-[11px] text-slate-500 font-medium">
            {{ cartItems.length }} jenis • {{ totalItemCount }} pcs
          </p>
        </div>
      </div>

      <button 
        v-if="cartItems.length > 0"
        @click="emit('clearCart')"
        class="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-red-50"
      >
        Kosongkan
      </button>
    </div>

    <!-- Daftar Barang Belanjaan (Scrollable Ringan di Area Pandang Atas) -->
    <div class="divide-y divide-slate-100/80 p-2 sm:p-3 min-h-[140px] max-h-[30vh] sm:max-h-[35vh] overflow-y-auto">
      <!-- Jika Keranjang Kosong -->
      <div 
        v-if="cartItems.length === 0" 
        class="h-32 flex flex-col items-center justify-center text-center text-slate-400"
      >
        <p class="font-bold text-[#0a193d] text-sm">Keranjang Masih Kosong</p>
        <p class="text-xs text-slate-400 mt-0.5">
          Ketuk barang cepat di bawah atau tembak barcode.
        </p>
      </div>

      <!-- Item Row (Sleek, Refined Stepper, Crisp Typography) -->
      <div 
        v-for="item in cartItems" 
        :key="item.id"
        class="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-sky-50/30 rounded-2xl transition-colors group"
      >
        <!-- Info Barang -->
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-[#0a193d] text-sm leading-snug truncate">
            {{ item.name }}
          </p>
          <p class="text-xs text-slate-500 font-medium mt-0.5">
            Rp {{ item.sellPrice.toLocaleString('id-ID') }}
          </p>
        </div>

        <!-- Stepper Kuantitas -->
        <div class="flex items-center gap-1 shrink-0 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
          <button 
            @click="emit('decreaseQty', item.id)"
            class="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            title="Kurangi"
          >
            <Minus class="w-3.5 h-3.5" />
          </button>

          <span class="w-7 text-center font-bold text-[#0a193d] text-xs sm:text-sm">
            {{ item.qty }}
          </span>

          <button 
            @click="emit('increaseQty', item.id)"
            class="w-7 h-7 rounded-lg bg-[#0a193d] hover:bg-[#102b66] text-white active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            title="Tambah"
          >
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Subtotal Item & Hapus -->
        <div class="text-right shrink-0 min-w-[75px]">
          <p class="font-bold text-sky-800 text-sm">
            Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}
          </p>
          <button 
            @click="emit('removeItem', item.id)"
            class="text-[11px] font-medium text-slate-400 hover:text-red-500 mt-0.5 cursor-pointer inline-flex items-center gap-0.5 transition-colors"
          >
            <Trash2 class="w-3 h-3" /> Hapus
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
