<script setup>
import { ref, computed } from 'vue'
import { 
  ChevronUp, 
  ChevronDown, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight,
  MoreHorizontal
} from '@lucide/vue'

const props = defineProps({
  cartItems: {
    type: Array,
    default: () => []
  },
  totalAmount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'increaseQty', 
  'decreaseQty', 
  'removeItem', 
  'clearCart', 
  'openPayment'
])

// State: Expand / Collapse Bottom Sheet
const isExpanded = ref(true)

const totalItemCount = computed(() => {
  return props.cartItems.reduce((acc, item) => acc + item.qty, 0)
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none">
    <div 
      class="w-full max-w-5xl bg-[#0a193d] text-white rounded-t-[32px] sm:rounded-t-[36px] shadow-2xl border-t border-sky-800/40 pointer-events-auto transition-all duration-300 ease-out flex flex-col overflow-hidden"
      :class="isExpanded ? 'max-h-[75vh] sm:max-h-[60vh]' : 'max-h-24'"
    >
      <!-- Top Drag Handle & Peek Bar (matches curved header in reference) -->
      <div 
        @click="toggleExpand"
        class="px-5 pt-3 pb-2 flex flex-col items-center cursor-pointer select-none hover:bg-white/5 transition-colors"
      >
        <!-- Small Chevron Handle -->
        <div class="w-8 h-4 flex items-center justify-center text-sky-400">
          <ChevronDown v-if="isExpanded" class="w-5 h-5" />
          <ChevronUp v-else class="w-5 h-5" />
        </div>

        <!-- Summary Bar When Collapsed or Expanded -->
        <div class="w-full flex items-center justify-between mt-1">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <ShoppingBag class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm sm:text-base font-bold text-white leading-tight">
                Keranjang Belanja
              </h4>
              <p class="text-[11px] text-sky-200/70 font-medium">
                {{ cartItems.length }} jenis • {{ totalItemCount }} pcs
              </p>
            </div>
          </div>

          <!-- Total Belanja & Bayar CTA -->
          <div class="flex items-center gap-2.5 sm:gap-4">
            <div class="text-right">
              <span class="text-[10px] text-sky-300 uppercase tracking-wider block font-semibold">Total</span>
              <span class="text-base sm:text-xl font-black text-sky-400">
                Rp {{ totalAmount.toLocaleString('id-ID') }}
              </span>
            </div>

            <!-- Quick Checkout Button -->
            <button 
              :disabled="totalAmount === 0"
              @click.stop="emit('openPayment')"
              class="h-10 sm:h-11 px-4 sm:px-6 bg-sky-500 hover:bg-sky-400 active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-sky-500/25 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              <span>Bayar</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Expanded Items List (matches transaction rows in reference) -->
      <div v-if="isExpanded" class="flex-1 overflow-y-auto px-4 sm:px-6 py-2 divide-y divide-sky-900/40">
        <!-- If Empty -->
        <div v-if="cartItems.length === 0" class="py-8 text-center text-slate-400">
          <p class="text-sm font-semibold text-slate-300">Keranjang Masih Kosong</p>
          <p class="text-xs text-slate-400 mt-1">Pilih barang dari katalog di atas untuk transaksi.</p>
        </div>

        <!-- Items Rows -->
        <div 
          v-for="item in cartItems" 
          :key="item.id"
          class="py-3 flex items-center justify-between gap-3"
        >
          <!-- Left: Squircle Icon & Name -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
              <ShoppingBag class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-white text-sm leading-snug truncate">
                {{ item.name }}
              </p>
              <p class="text-xs text-sky-200/70 font-medium mt-0.5">
                Rp {{ item.sellPrice.toLocaleString('id-ID') }}
              </p>
            </div>
          </div>

          <!-- Middle: Quantity Controls -->
          <div class="flex items-center gap-1 shrink-0 bg-white/10 p-1 rounded-xl border border-white/10">
            <button 
              @click="emit('decreaseQty', item.id)"
              class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white active:scale-95 flex items-center justify-center cursor-pointer transition-colors"
              title="Kurangi"
            >
              <Minus class="w-3.5 h-3.5" />
            </button>

            <span class="w-7 text-center font-bold text-white text-xs sm:text-sm">
              {{ item.qty }}
            </span>

            <button 
              @click="emit('increaseQty', item.id)"
              class="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-400 text-white active:scale-95 flex items-center justify-center cursor-pointer transition-colors"
              title="Tambah"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Right: Subtotal & Delete -->
          <div class="text-right shrink-0 min-w-[70px]">
            <p class="font-bold text-white text-sm">
              Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}
            </p>
            <button 
              @click="emit('removeItem', item.id)"
              class="text-[10px] text-slate-400 hover:text-red-400 mt-0.5 cursor-pointer inline-flex items-center gap-0.5"
            >
              <Trash2 class="w-3 h-3" /> Hapus
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Action Inside Sheet -->
      <div v-if="isExpanded && cartItems.length > 0" class="p-3 px-6 bg-black/20 border-t border-sky-900/50 flex items-center justify-between text-xs text-sky-200">
        <button 
          @click="emit('clearCart')"
          class="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
        >
          Kosongkan Keranjang
        </button>
        <span class="font-medium text-[11px] text-slate-400">
          Kasiry
        </span>
      </div>
    </div>
  </div>
</template>
