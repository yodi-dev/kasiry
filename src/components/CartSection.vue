<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, Pen, Check, X } from '@lucide/vue'
import { PRICE_TIERS } from '../utils/pricing'

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
  },
  cartPriceTier: {
    type: String,
    default: 'ecer'
  },
  selectedCustomerName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'increaseQty',
  'decreaseQty',
  'removeItem',
  'clearCart',
  'openPayment',
  'changePriceTier',
  'updateItemPrice'
])

const totalItemCount = computed(() => {
  return props.totalCount || props.cartItems.reduce((acc, item) => acc + item.qty, 0)
})

// State editor harga manual / tier per baris keranjang
const editingItemId = ref(null)
const manualPriceInput = ref('')
const saveTargetCatalogTier = ref('none') // 'none' | 'ecer' | 'grosir' | 'agen'

watch(
  () => props.cartItems.length,
  (len) => {
    if (len === 0) {
      editingItemId.value = null
    }
  }
)

const togglePriceEditor = (item) => {
  if (editingItemId.value === item.id) {
    editingItemId.value = null
    return
  }
  editingItemId.value = item.id
  manualPriceInput.value = String(item.sellPrice || item.baseSellPrice || '')
  saveTargetCatalogTier.value = 'none'
}

const selectItemTierMode = (item, mode) => {
  emit('updateItemPrice', {
    productId: item.id,
    priceMode: mode,
    customPrice: null,
    saveToCatalogTier: 'none'
  })
  editingItemId.value = null
}

const parsedManualPrice = computed(() => {
  const digits = String(manualPriceInput.value ?? '').replace(/\D/g, '')
  const val = parseInt(digits || '0', 10)
  return Number.isFinite(val) ? val : 0
})

const applyManualPrice = (item) => {
  if (parsedManualPrice.value <= 0) return
  emit('updateItemPrice', {
    productId: item.id,
    priceMode: 'manual',
    customPrice: parsedManualPrice.value,
    saveToCatalogTier: saveTargetCatalogTier.value
  })
  editingItemId.value = null
}

const tierPillBadgeClass = (tier) => {
  if (tier === 'agen') return 'bg-sky-50 text-[#0284c7] border-sky-200/80'
  if (tier === 'grosir') return 'bg-amber-50 text-amber-800 border-amber-200/80'
  if (tier === 'manual') return 'bg-purple-50 text-purple-800 border-purple-200/80'
  return 'bg-slate-100 text-slate-600 border-slate-200/80'
}
</script>

<template>
  <div class="cart-pane-container bg-white/90 backdrop-blur-md rounded-3xl border border-white/90 shadow-sm overflow-hidden transition-all md:h-full md:flex md:flex-col md:min-h-0">
    <!-- Header Keranjang -->
    <div class="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 space-y-2 shrink-0">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60 shrink-0">
            <ShoppingBag aria-hidden="true" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h3 class="font-bold text-[#0a193d] text-sm leading-tight">
              Struk Belanjaan
            </h3>
            <p class="text-[11px] text-slate-500 font-medium tabular-nums truncate">
              {{ cartItems.length }} jenis • {{ totalItemCount }} pcs
              <span v-if="selectedCustomerName && selectedCustomerName.toLowerCase() !== 'umum'" class="text-[#0284c7] font-semibold">
                • {{ selectedCustomerName }}
              </span>
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

      <!-- Saklar Cepat Multi Harga Struk (Ecer / Grosir / Agen) -->
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          Harga Nota:
        </span>
        <div class="p-0.5 bg-slate-100 rounded-xl grid grid-cols-3 gap-0.5 flex-1 max-w-[230px]" role="group" aria-label="Level Harga Keranjang">
          <button
            v-for="tier in PRICE_TIERS"
            :key="tier.id"
            type="button"
            @click="emit('changePriceTier', tier.id)"
            :aria-pressed="cartPriceTier === tier.id"
            :class="[
              'h-7 px-2 rounded-lg text-[11px] font-bold cursor-pointer transition-all',
              cartPriceTier === tier.id
                ? (tier.id === 'agen'
                    ? 'bg-[#0284c7] text-white shadow-2xs'
                    : tier.id === 'grosir'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-[#0a193d] text-white shadow-2xs')
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            {{ tier.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Daftar Barang Belanjaan (Mobile: Max 32dvh | Tablet & Desktop: Mengisi Sisa Tinggi Panel) -->
    <div class="kasiry-scroll-pane divide-y divide-slate-100/80 p-2 sm:p-2.5 min-h-[104px] max-h-[32dvh] md:min-h-0 md:max-h-none md:flex-1 overflow-y-auto">
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

      <!-- Item Row + Inline Multi-Harga Editor -->
      <div
        v-for="item in cartItems"
        :key="item.id"
        class="py-2 px-2 sm:px-2.5 hover:bg-sky-50/40 rounded-2xl transition-colors group"
      >
        <div class="cart-item-row">
          <!-- Info Barang -->
          <div class="cart-item-info">
            <p class="font-semibold text-[#0a193d] text-[13px] sm:text-sm leading-snug break-words">
              {{ item.name }}
            </p>
            <!-- Harga Satuan Klikable (Container Lebar) -->
            <div class="cart-wide-unit mt-0.5 flex flex-wrap items-center gap-1">
              <button
                type="button"
                @click.stop="togglePriceEditor(item)"
                class="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-[#0284c7] font-medium cursor-pointer transition-colors"
                :title="`Ubah harga atau pilih Ecer/Grosir/Agen untuk ${item.name}`"
              >
                <span class="tabular-nums underline decoration-dashed decoration-slate-300 underline-offset-2">
                  Rp {{ item.sellPrice.toLocaleString('id-ID') }}
                </span>
                <span
                  :class="[
                    'text-[10px] font-bold px-1.5 py-0.2 rounded-full border leading-tight',
                    tierPillBadgeClass(item.appliedTier)
                  ]"
                >
                  {{ item.tierLabel || 'Ecer' }}
                </span>
                <Pen aria-hidden="true" class="w-2.5 h-2.5 text-slate-400" />
              </button>
              <span
                v-if="item.wholesalePrice > 0 && item.wholesaleMinQty >= 2 && item.appliedTier === 'ecer' && item.priceMode === 'auto'"
                class="text-[10px] text-amber-700 font-medium"
              >
                (≥{{ item.wholesaleMinQty }}: Rp {{ item.wholesalePrice.toLocaleString('id-ID') }})
              </span>
            </div>
          </div>

          <!-- Harga Satuan Klikable (Container Sempit Mobile) -->
          <div class="cart-item-unit flex flex-wrap items-center gap-1">
            <button
              type="button"
              @click.stop="togglePriceEditor(item)"
              class="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-[#0284c7] font-medium cursor-pointer"
            >
              <span class="tabular-nums underline decoration-dashed decoration-slate-300 underline-offset-2">
                @ Rp {{ item.sellPrice.toLocaleString('id-ID') }}
              </span>
              <span
                :class="[
                  'text-[10px] font-bold px-1.5 py-0.2 rounded-full border leading-tight',
                  tierPillBadgeClass(item.appliedTier)
                ]"
              >
                {{ item.tierLabel || 'Ecer' }}
              </span>
              <Pen aria-hidden="true" class="w-2.5 h-2.5 text-slate-400" />
            </button>
          </div>

          <!-- Stepper Kuantitas & Tombol Hapus -->
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

          <!-- Subtotal Item & Hapus (Container Lebar) -->
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

        <!-- Inline Popover Editor Harga Per Item (Switch Tier atau Ketik Harga Manual) -->
        <div
          v-if="editingItemId === item.id"
          @click.stop
          class="mt-2 p-2.5 rounded-2xl bg-slate-50 border border-sky-200/80 space-y-2 animate-in fade-in duration-100"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-bold text-[#0a193d]">
              Atur Harga: {{ item.name }}
            </span>
            <button
              type="button"
              @click="editingItemId = null"
              class="w-6 h-6 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              aria-label="Tutup pengatur harga"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 1-Tap Pilih Mode / Tier Harga Barang -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1">
            <button
              type="button"
              @click="selectItemTierMode(item, 'auto')"
              :class="[
                'px-2 py-1.5 rounded-xl text-[10px] font-bold border text-center cursor-pointer transition-colors',
                item.priceMode === 'auto'
                  ? 'bg-[#0a193d] text-white border-[#0a193d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              ]"
            >
              Auto Nota
            </button>

            <button
              type="button"
              @click="selectItemTierMode(item, 'ecer')"
              :class="[
                'px-2 py-1.5 rounded-xl text-[10px] font-bold border text-center cursor-pointer transition-colors',
                item.priceMode === 'ecer'
                  ? 'bg-[#0a193d] text-white border-[#0a193d]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              ]"
            >
              Ecer Rp {{ (item.baseSellPrice ?? item.sellPrice).toLocaleString('id-ID') }}
            </button>

            <button
              type="button"
              :disabled="!(item.wholesalePrice > 0)"
              @click="selectItemTierMode(item, 'grosir')"
              :class="[
                'px-2 py-1.5 rounded-xl text-[10px] font-bold border text-center transition-colors',
                !(item.wholesalePrice > 0)
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : item.priceMode === 'grosir'
                  ? 'bg-amber-600 text-white border-amber-600 cursor-pointer'
                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50 cursor-pointer'
              ]"
            >
              {{ item.wholesalePrice > 0 ? `Grosir Rp ${item.wholesalePrice.toLocaleString('id-ID')}` : 'Grosir (Kosong)' }}
            </button>

            <button
              type="button"
              :disabled="!(item.agentPrice > 0)"
              @click="selectItemTierMode(item, 'agen')"
              :class="[
                'px-2 py-1.5 rounded-xl text-[10px] font-bold border text-center transition-colors',
                !(item.agentPrice > 0)
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : item.priceMode === 'agen'
                  ? 'bg-[#0284c7] text-white border-[#0284c7] cursor-pointer'
                  : 'bg-white text-[#0284c7] border-sky-200 hover:bg-sky-50 cursor-pointer'
              ]"
            >
              {{ item.agentPrice > 0 ? `Agen Rp ${item.agentPrice.toLocaleString('id-ID')}` : 'Agen (Kosong)' }}
            </button>
          </div>

          <!-- Input Ubah Harga Manual + Opsi Simpan ke Katalog -->
          <div class="flex items-center gap-1.5">
            <div class="relative flex-1 min-w-0">
              <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[11px] font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputmode="numeric"
                v-model="manualPriceInput"
                @keydown.enter.prevent="applyManualPrice(item)"
                placeholder="Harga manual..."
                aria-label="Harga manual satuan"
                class="w-full h-9 pl-8 pr-2.5 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-bold font-mono text-[#0a193d] outline-hidden"
              />
            </div>
            <button
              type="button"
              :disabled="parsedManualPrice <= 0"
              @click="applyManualPrice(item)"
              class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              <Check class="w-3.5 h-3.5 text-sky-400" />
              <span>Pakai</span>
            </button>
          </div>

          <div class="flex items-center gap-1 flex-wrap text-[10px]">
            <span class="text-slate-500 font-semibold mr-0.5">Simpan ke barang:</span>
            <button
              v-for="opt in [
                { id: 'none', label: 'Nota ini saja' },
                { id: 'ecer', label: 'Jadi Ecer' },
                { id: 'grosir', label: 'Jadi Grosir' },
                { id: 'agen', label: 'Jadi Agen' }
              ]"
              :key="opt.id"
              type="button"
              @click="saveTargetCatalogTier = opt.id"
              :class="[
                'px-2 py-0.5 rounded-full font-bold border cursor-pointer transition-colors',
                saveTargetCatalogTier === opt.id
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              ]"
            >
              {{ opt.label }}
            </button>
          </div>
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
