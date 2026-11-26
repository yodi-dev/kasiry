<script setup>
import { computed } from 'vue'
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from '@lucide/vue'

const props = defineProps({
  cartItems: {
    type: Array,
    default: () => []
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  totalCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['increaseQty', 'decreaseQty', 'removeItem', 'clearCart', 'openPayment'])

const totalItemCount = computed(() => {
  return props.totalCount || props.cartItems.reduce((acc, item) => acc + item.qty, 0)
})
</script>

<template>
  <div class="cart-pane-container bg-white/90 backdrop-blur-md rounded-3xl border border-white/90 shadow-sm overflow-hidden transition-all md:h-full md:flex md:flex-col md:min-h-0">
    <!-- Header Keranjang -->
    <div class="px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60 shrink-0">
          <ShoppingBag aria-hidden="true" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <h3 class="font-bold text-[#0a193d] text-sm leading-tight">
            Struk Belanjaan
          </h3>
          <p class="text-[11px] text-slate-500 font-medium tabular-nums">
            {{ cartItems.length }} jenis • {{ totalItemCount }} pcs
          </p>
        </div>
      </div>

      <button 
        v-if="cartItems.length > 0"
        type="button"
        @click="emit('clearCart')"
        class="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-red-50 shrink-0"
      >
        Kosongkan
      </button>
    </div>

    <!-- Daftar Barang Belanjaan (Mobile: Max 30dvh | Tablet & Desktop: Mengisi Sisa Tinggi Panel) -->
    <div class="kasiry-scroll-pane divide-y divide-slate-100/80 p-2 sm:p-2.5 min-h-[104px] max-h-[30dvh] md:min-h-0 md:max-h-none md:flex-1 overflow-y-auto">
      <!-- Jika Keranjang Kosong -->
      <div 
        v-if="cartItems.length === 0" 
        class="h-24 md:h-full md:min-h-[180px] px-4 flex flex-col items-center justify-center text-center text-slate-400"
      >
        <div class="hidden md:flex size-12 rounded-2xl bg-sky-50 border border-sky-100 text-[#0284c7] items-center justify-center mb-3">
          <ShoppingBag aria-hidden="true" class="size-5" />
        </div>
        <p class="font-bold text-[#0a193d] text-sm">Keranjang Masih Kosong</p>
        <p class="text-xs text-slate-400 mt-1 max-w-[230px]">
          <span class="md:hidden">Ketuk barang cepat di bawah atau scan barcode.</span>
          <span class="hidden md:inline">Ketuk produk di sebelah kanan atau scan barcode untuk mulai transaksi.</span>
        </p>
      </div>

      <!-- Item Row (Adaptif Container: 2 Baris Rapi di Layar Sempit, 1 Baris di Panel Lebar) -->
      <div 
        v-for="item in cartItems" 
        :key="item.id"
        class="cart-item-row py-2.5 px-2.5 sm:px-3 hover:bg-sky-50/40 rounded-2xl transition-colors group"
      >
        <!-- Info Barang -->
        <div class="cart-item-info">
          <p class="font-semibold text-[#0a193d] text-[13px] sm:text-sm leading-snug break-words">
            {{ item.name }}
          </p>
          <p class="cart-wide-unit text-xs text-slate-500 font-medium mt-0.5 tabular-nums">
            Rp {{ item.sellPrice.toLocaleString('id-ID') }}
          </p>
        </div>

        <!-- Harga Satuan (Khusus mode container sempit di bawah nama) -->
        <p class="cart-item-unit text-xs text-slate-500 font-medium tabular-nums">
          @ Rp {{ item.sellPrice.toLocaleString('id-ID') }}
        </p>

        <!-- Stepper Kuantitas & Tombol Hapus (untuk mode sempit ikut sebaris di kanan bawah) -->
        <div class="cart-item-controls">
          <div class="flex items-center gap-1 shrink-0 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
            <button 
              type="button"
              @click="emit('decreaseQty', item.id)"
              class="touch-hit-target w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              :aria-label="`Kurangi ${item.name}`"
              title="Kurangi"
            >
              <Minus aria-hidden="true" class="w-3.5 h-3.5" />
            </button>

            <span class="w-7 text-center font-bold text-[#0a193d] text-xs sm:text-sm tabular-nums">
              {{ item.qty }}
            </span>

            <button 
              type="button"
              @click="emit('increaseQty', item.id)"
              class="touch-hit-target w-8 h-8 rounded-lg bg-[#0a193d] hover:bg-[#102b66] text-white active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
              :aria-label="`Tambah ${item.name}`"
              title="Tambah"
            >
              <Plus aria-hidden="true" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Tombol Hapus Khusus Mode Container Sempit -->
          <button 
            type="button"
            @click="emit('removeItem', item.id)"
            class="touch-hit-target cart-narrow-remove w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center cursor-pointer transition-colors"
            :aria-label="`Hapus ${item.name}`"
            title="Hapus"
          >
            <Trash2 aria-hidden="true" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Subtotal Item & Hapus (Mode Container Lebar) -->
        <div class="cart-item-subtotal shrink-0">
          <p class="font-bold text-sky-800 text-[13px] sm:text-sm tabular-nums">
            Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}
          </p>
          <button 
            type="button"
            @click="emit('removeItem', item.id)"
            class="cart-wide-remove text-[11px] font-medium text-slate-400 hover:text-red-500 mt-0.5 cursor-pointer items-center gap-0.5 transition-colors"
          >
            <Trash2 aria-hidden="true" class="w-3 h-3" /> Hapus
          </button>
        </div>
      </div>
    </div>

    <!-- Dock Pembayaran Terintegrasi (Khusus Tablet & Desktop) -->
    <div class="hidden md:flex flex-col shrink-0 border-t border-slate-200/70 bg-slate-50/85 px-4 lg:px-5 py-3.5 lg:py-4 gap-3">
      <div class="flex items-end justify-between gap-2">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Tagihan</p>
          <p class="text-xs text-slate-400 tabular-nums mt-0.5">{{ totalItemCount }} barang di struk</p>
        </div>
        <p class="text-2xl font-black text-[#0a193d] tracking-tight tabular-nums leading-none">
          Rp {{ totalAmount.toLocaleString('id-ID') }}
        </p>
      </div>

      <button
        type="button"
        :disabled="cartItems.length === 0"
        @click="emit('openPayment')"
        class="h-12 px-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer disabled:bg-slate-200/80 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
        :class="cartItems.length > 0
          ? 'bg-linear-to-r from-[#0a193d] via-[#102b66] to-[#0284c7] hover:brightness-110 active:scale-98 text-white shadow-lg shadow-sky-900/15'
          : ''"
      >
        <span class="flex items-center gap-2">
          <span>{{ cartItems.length > 0 ? 'Proses Pembayaran' : 'Pilih atau Scan Barang' }}</span>
        </span>
        <span v-if="cartItems.length > 0" class="flex items-center gap-2">
          <kbd class="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-white/15 text-sky-100 rounded-md border border-white/20">F2</kbd>
          <ArrowRight aria-hidden="true" class="size-4 stroke-[2.5]" />
        </span>
      </button>
    </div>
  </div>
</template>
