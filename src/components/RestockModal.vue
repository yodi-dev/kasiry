<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  PackagePlus,
  Search,
  Plus,
  Minus,
  Trash2,
  TrendingUp,
  CheckCircle,
  Wallet,
  CreditCard,
  UserCheck,
  Clock,
  Check,
  Package
} from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  products: {
    type: Array,
    default: () => []
  },
  restocks: {
    type: Array,
    default: () => []
  },
  activeShift: {
    type: Object,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({
      todayCashDrawer: 0,
      todayNetCashDrawer: 0,
      todayExpensesCash: 0
    })
  }
})

const emit = defineEmits(['close', 'recordRestock', 'deleteRestock'])

const activeTab = ref('form')
const selectedSource = ref('TUNAI_LACI')
const supplierInput = ref('')
const noteInput = ref('')
const searchQuery = ref('')
const draftItems = ref([])
const savedBanner = ref(false)
const confirmingDeleteId = ref(null)

const sourceOptions = [
  {
    id: 'TUNAI_LACI',
    label: 'Tunai Laci',
    hint: 'Potong laci & buat kas keluar',
    icon: Wallet
  },
  {
    id: 'KAS',
    label: 'Uang Kas',
    hint: 'Potong saldo Uang Kas toko',
    icon: Package
  },
  {
    id: 'NON_TUNAI',
    label: 'QRIS / Rek',
    hint: 'Potong rekening & buat kas keluar',
    icon: CreditCard
  },
  {
    id: 'DANA_LUAR',
    label: 'Dana Luar',
    hint: 'Uang pribadi owner',
    icon: UserCheck
  }
]

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'form'
    selectedSource.value = 'TUNAI_LACI'
    supplierInput.value = ''
    noteInput.value = ''
    searchQuery.value = ''
    draftItems.value = []
    savedBanner.value = false
    confirmingDeleteId.value = null
  }
}, { immediate: true })

const netDrawerDisplay = computed(() => {
  if (props.stats?.isShiftScoped) {
    return Number(props.stats.expectedCashDrawer ?? ((props.stats.openingCash || 0) + (props.stats.todayNetCashDrawer || 0)))
  }
  if (props.stats?.todayNetCashDrawer !== undefined) {
    return props.stats.todayNetCashDrawer
  }
  return (props.stats?.todayCashDrawer || 0) - (props.stats?.todayExpensesCash || 0)
})

const activeProducts = computed(() => (props.products || []).filter(p => p && !p.deleted))

const filteredSearchProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = activeProducts.value
  if (!q) {
    // Prioritaskan barang dengan stok terendah (termasuk 0) atau terlaris agar cepat dipilih
    return [...list]
      .sort((a, b) => {
        const sa = a.stock !== null && a.stock !== undefined ? Number(a.stock) : 999999
        const sb = b.stock !== null && b.stock !== undefined ? Number(b.stock) : 999999
        if (sa !== sb) return sa - sb
        return (b.isMacro ? 1 : 0) - (a.isMacro ? 1 : 0)
      })
      .slice(0, 8)
  }
  return list
    .filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
      (p.category || '').toLowerCase().includes(q)
    )
    .slice(0, 10)
})

const draftItemMap = computed(() => {
  const map = {}
  for (const item of draftItems.value) {
    map[item.productId] = item.qty
  }
  return map
})

const addProductToRestock = (prod) => {
  const existing = draftItems.value.find(it => it.productId === prod.id)
  if (existing) {
    existing.qty = Number(existing.qty || 0) + 1
    return
  }

  draftItems.value.push({
    productId: prod.id,
    productName: prod.name,
    qty: 1,
    unitBuyPrice: Math.max(0, Number(prod.buyPrice || 0)),
    prevBuyPrice: Math.max(0, Number(prod.buyPrice || 0)),
    currentSellPrice: Math.max(0, Number(prod.sellPrice || 0)),
    newSellPrice: '',
    currentStock: prod.stock !== null && prod.stock !== undefined && Number.isFinite(Number(prod.stock))
      ? Math.max(0, Math.round(Number(prod.stock)))
      : null,
    trackStock: true
  })
}

const incrementDraftQty = (idx) => {
  const item = draftItems.value[idx]
  if (item) item.qty = Math.max(1, Number(item.qty || 0) + 1)
}

const decrementDraftQty = (idx) => {
  const item = draftItems.value[idx]
  if (!item) return
  if (Number(item.qty || 1) <= 1) {
    draftItems.value.splice(idx, 1)
  } else {
    item.qty = Number(item.qty) - 1
  }
}

const removeDraftItem = (idx) => {
  draftItems.value.splice(idx, 1)
}

const totalNotaCost = computed(() =>
  draftItems.value.reduce((sum, it) => {
    const q = Math.max(0, Math.round(Number(it.qty || 0)))
    const p = Math.max(0, Math.round(Number(it.unitBuyPrice || 0)))
    return sum + q * p
  }, 0)
)

const totalNotaQty = computed(() =>
  draftItems.value.reduce((sum, it) => sum + Math.max(0, Math.round(Number(it.qty || 0))), 0)
)

const canSubmit = computed(() =>
  draftItems.value.length > 0 && draftItems.value.every(it => Math.round(Number(it.qty || 0)) > 0)
)

const submitRestock = () => {
  if (!canSubmit.value) return

  emit('recordRestock', {
    supplierName: supplierInput.value.trim(),
    source: selectedSource.value,
    note: noteInput.value.trim(),
    items: draftItems.value.map(it => ({
      productId: it.productId,
      productName: it.productName,
      qty: Math.max(1, Math.round(Number(it.qty || 1))),
      unitBuyPrice: Math.max(0, Math.round(Number(it.unitBuyPrice || 0))),
      trackStock: it.trackStock !== false,
      newSellPrice: it.newSellPrice !== '' && it.newSellPrice !== null && it.newSellPrice !== undefined
        ? Math.max(0, Math.round(Number(it.newSellPrice)))
        : null
    }))
  })

  draftItems.value = []
  supplierInput.value = ''
  noteInput.value = ''
  searchQuery.value = ''
  savedBanner.value = true
  setTimeout(() => {
    savedBanner.value = false
  }, 2400)
}

const sortedRestocks = computed(() =>
  (props.restocks || [])
    .filter(r => r && !r.deleted)
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
)

const formatDateTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getSourceBadge = (src) => {
  if (src === 'KAS') {
    return { label: 'Uang Kas', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' }
  }
  if (src === 'NON_TUNAI') {
    return { label: 'QRIS / Rek', badgeClass: 'bg-sky-50 text-[#0284c7] border-sky-200/80' }
  }
  if (src === 'DANA_LUAR') {
    return { label: 'Dana Luar', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
  return { label: 'Tunai Laci', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80' }
}

const confirmDelete = (id) => {
  emit('deleteRestock', id)
  confirmingDeleteId.value = null
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-2xl lg:max-w-4xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <PackagePlus class="w-5 h-5 text-emerald-400" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Kulakan &amp; Belanja Stok</h3>
            <p class="text-xs text-slate-500 font-medium leading-snug truncate">
              Catat nota kulakan, update harga beli/modal, dan tambah stok opsional warung
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 2. Tab Bar -->
      <div class="px-5 pt-2.5 pb-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="activeTab = 'form'"
            :class="[
              'h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'form'
                ? 'bg-[#0a193d] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            ]"
          >
            Catat Kulakan
          </button>
          <button
            type="button"
            @click="activeTab = 'history'"
            :class="[
              'h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'history'
                ? 'bg-[#0a193d] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            ]"
          >
            <span>Riwayat Kulakan</span>
            <span
              class="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
              :class="activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'"
            >
              {{ sortedRestocks.length }}
            </span>
          </button>
        </div>

        <div class="text-xs font-semibold text-slate-500 flex items-center gap-2">
          <span>Sisa Tunai Laci:</span>
          <span
            class="font-bold font-mono"
            :class="netDrawerDisplay < 0 ? 'text-rose-700' : 'text-[#0a193d]'"
          >
            Rp {{ netDrawerDisplay.toLocaleString('id-ID') }}
          </span>
        </div>
      </div>

      <!-- TAB 1: CATAT KULAKAN -->
      <template v-if="activeTab === 'form'">
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div
            v-if="savedBanner"
            class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2"
          >
            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Nota kulakan tersimpan! Harga beli, stok, dan catatan kas diperbarui.</span>
          </div>

          <!-- Sumber Pembayaran + Info Supplier -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            <div class="lg:col-span-7 space-y-2">
              <span class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Sumber Dana Pembayaran
              </span>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="src in sourceOptions"
                  :key="src.id"
                  type="button"
                  @click="selectedSource = src.id"
                  :class="[
                    'p-2.5 rounded-2xl border text-left transition-all cursor-pointer',
                    selectedSource === src.id
                      ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                      : 'bg-slate-50/80 hover:bg-white text-slate-700 border-slate-200'
                  ]"
                >
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <component :is="src.icon" class="w-3.5 h-3.5 shrink-0" />
                    <span class="text-xs font-bold truncate">{{ src.label }}</span>
                  </div>
                  <p
                    class="text-[10px] leading-snug line-clamp-2"
                    :class="selectedSource === src.id ? 'text-slate-200' : 'text-slate-500'"
                  >
                    {{ src.hint }}
                  </p>
                </button>
              </div>
            </div>

            <div class="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Supplier / Agen (Opsional)
                </label>
                <input
                  v-model="supplierInput"
                  type="text"
                  placeholder="Misal: Agen Sembako Jaya"
                  class="w-full h-9 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-semibold text-[#0a193d] outline-hidden transition-all"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Catatan Nota (Opsional)
                </label>
                <input
                  v-model="noteInput"
                  type="text"
                  placeholder="No. faktur atau keterangan..."
                  class="w-full h-9 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-semibold text-[#0a193d] outline-hidden transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Split Layout Kiri (Pilih Barang) & Kanan (Draft Nota) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <!-- Kiri: Pencarian Katalog -->
            <div class="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 space-y-2.5">
              <div class="relative">
                <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Cari nama atau barcode barang..."
                  class="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-semibold text-[#0a193d] outline-hidden transition-all"
                />
              </div>

              <div class="text-[11px] font-bold text-slate-500 flex items-center justify-between px-0.5">
                <span>{{ searchQuery.trim() ? 'Hasil Pencarian' : 'Pilih Barang Cepat' }}</span>
                <span>Klik untuk tambah</span>
              </div>

              <div class="space-y-1.5 max-h-[260px] lg:max-h-[340px] overflow-y-auto pr-0.5">
                <button
                  v-for="prod in filteredSearchProducts"
                  :key="prod.id"
                  type="button"
                  @click="addProductToRestock(prod)"
                  class="w-full p-2.5 bg-white hover:bg-sky-50/60 border border-slate-200/80 hover:border-sky-300 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-all group"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-[#0a193d] truncate">{{ prod.name }}</p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
                      <span class="font-mono text-slate-500">
                        Modal: Rp {{ Number(prod.buyPrice || 0).toLocaleString('id-ID') }}
                      </span>
                      <span
                        v-if="prod.stock !== null && prod.stock !== undefined"
                        :class="[
                          'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                          Number(prod.stock) === 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                            : Number(prod.stock) <= 5
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                        ]"
                      >
                        Stok: {{ prod.stock }}
                      </span>
                      <span v-else class="text-[10px] text-slate-400">Tanpa lacak stok</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span
                      v-if="draftItemMap[prod.id]"
                      class="px-1.5 py-0.5 rounded-full bg-[#0a193d] text-white text-[10px] font-bold"
                    >
                      {{ draftItemMap[prod.id] }}×
                    </span>
                    <div class="w-7 h-7 rounded-lg bg-sky-50 group-hover:bg-[#0a193d] text-[#0284c7] group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus class="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>

                <div
                  v-if="filteredSearchProducts.length === 0"
                  class="py-8 text-center text-xs text-slate-400 font-medium"
                >
                  Tidak ada barang yang cocok di katalog.
                </div>
              </div>
            </div>

            <!-- Kanan: Draft Item Nota Kulakan -->
            <div class="lg:col-span-7 space-y-2.5">
              <div class="flex items-center justify-between px-0.5">
                <span class="text-xs font-bold text-[#0a193d] uppercase tracking-wider">
                  Daftar Belanja Nota ({{ draftItems.length }} Item)
                </span>
                <button
                  v-if="draftItems.length > 0"
                  type="button"
                  @click="draftItems = []"
                  class="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>

              <div
                v-if="draftItems.length === 0"
                class="py-12 px-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200"
              >
                <Package class="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p class="text-xs font-bold text-slate-600">Belum ada barang di daftar kulakan</p>
                <p class="text-[11px] text-slate-400 mt-1">
                  Pilih barang di kolom sebelah kiri untuk mulai mencatat nota kulakan.
                </p>
              </div>

              <div v-else class="space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                <div
                  v-for="(item, idx) in draftItems"
                  :key="item.productId"
                  class="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-2.5"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <h5 class="text-xs sm:text-sm font-bold text-[#0a193d] truncate">
                        {{ item.productName }}
                      </h5>
                      <div class="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
                        <span class="text-slate-500">
                          Jual Skrg: <strong class="text-[#0a193d] font-mono">Rp {{ item.currentSellPrice.toLocaleString('id-ID') }}</strong>
                        </span>
                        <span
                          v-if="item.unitBuyPrice > item.prevBuyPrice"
                          class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]"
                        >
                          <TrendingUp class="w-3 h-3" /> Modal naik +Rp {{ (item.unitBuyPrice - item.prevBuyPrice).toLocaleString('id-ID') }}
                        </span>
                        <span
                          v-else-if="item.unitBuyPrice < item.prevBuyPrice"
                          class="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[10px]"
                        >
                          Modal turun -Rp {{ (item.prevBuyPrice - item.unitBuyPrice).toLocaleString('id-ID') }}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      @click="removeDraftItem(idx)"
                      class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                      title="Hapus dari daftar"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div class="grid grid-cols-12 gap-2 items-end">
                    <!-- Qty Stepper -->
                    <div class="col-span-5 sm:col-span-4">
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Qty Beli
                      </label>
                      <div class="flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          @click="decrementDraftQty(idx)"
                          class="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                        >
                          <Minus class="w-3.5 h-3.5" />
                        </button>
                        <input
                          v-model.number="item.qty"
                          type="number"
                          min="1"
                          inputmode="numeric"
                          class="w-full h-full bg-transparent text-center text-xs font-bold text-[#0a193d] font-mono outline-hidden"
                        />
                        <button
                          type="button"
                          @click="incrementDraftQty(idx)"
                          class="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                        >
                          <Plus class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <!-- Harga Beli / Unit -->
                    <div class="col-span-7 sm:col-span-5">
                      <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Harga Beli / Unit (Rp)
                      </label>
                      <input
                        v-model.number="item.unitBuyPrice"
                        type="number"
                        min="0"
                        inputmode="numeric"
                        class="w-full h-9 px-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-bold font-mono text-right text-[#0a193d] outline-hidden"
                      />
                    </div>

                    <!-- Subtotal -->
                    <div class="col-span-12 sm:col-span-3 text-right">
                      <span class="block text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                      <p class="text-xs font-bold font-mono text-[#0284c7]">
                        Rp {{ (Math.max(0, Number(item.qty || 0)) * Math.max(0, Number(item.unitBuyPrice || 0))).toLocaleString('id-ID') }}
                      </p>
                    </div>
                  </div>

                  <!-- Kontrol Update Stok & Harga Jual Opsional -->
                  <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <label class="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        v-model="item.trackStock"
                        type="checkbox"
                        class="w-4 h-4 rounded accent-[#0a193d] cursor-pointer"
                      />
                      <span>
                        Update Stok
                        <template v-if="item.trackStock">
                          ({{ item.currentStock !== null ? `${item.currentStock} → ${item.currentStock + Math.max(0, Math.round(Number(item.qty || 0)))}` : `Mulai lacak: ${Math.max(0, Math.round(Number(item.qty || 0)))}` }})
                        </template>
                        <template v-else>
                          (Harga beli saja)
                        </template>
                      </span>
                    </label>

                    <div
                      v-if="item.unitBuyPrice > item.prevBuyPrice || item.unitBuyPrice >= item.currentSellPrice || item.newSellPrice !== ''"
                      class="flex items-center gap-1.5"
                    >
                      <span class="text-[10px] font-bold text-amber-800">Ubah Jual:</span>
                      <input
                        v-model="item.newSellPrice"
                        type="number"
                        min="0"
                        inputmode="numeric"
                        :placeholder="String(item.currentSellPrice)"
                        class="w-24 h-7 px-2 bg-amber-50/70 border border-amber-200 focus:border-[#0284c7] rounded-lg text-xs font-bold font-mono text-right text-[#0a193d] outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Footer Form -->
        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div class="min-w-0">
            <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Kulakan ({{ draftItems.length }} Macam • {{ totalNotaQty }} Pcs)
            </span>
            <p class="text-lg font-extrabold font-mono text-[#0a193d] leading-tight">
              Rp {{ totalNotaCost.toLocaleString('id-ID') }}
            </p>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <button
              type="button"
              @click="emit('close')"
              class="h-10 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              :disabled="!canSubmit"
              @click="submitRestock"
              class="h-10 px-5 rounded-2xl bg-[#0a193d] hover:bg-[#132b63] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Check class="w-4 h-4" />
              <span>Simpan Nota Kulakan</span>
            </button>
          </div>
        </div>
      </template>

      <!-- TAB 2: RIWAYAT KULAKAN -->
      <template v-else>
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          <div
            v-if="sortedRestocks.length === 0"
            class="py-12 px-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200"
          >
            <Clock class="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p class="text-xs font-bold text-slate-600">Belum ada riwayat kulakan tercatat</p>
            <p class="text-[11px] text-slate-400 mt-1">
              Nota kulakan yang disimpan akan tampil di sini beserta rincian barang &amp; modalnya.
            </p>
          </div>

          <div
            v-for="rec in sortedRestocks"
            :key="rec.id"
            class="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-bold text-[#0a193d]">
                    {{ rec.supplierName || 'Kulakan Mandiri' }}
                  </span>
                  <span class="text-[10px] font-mono text-slate-400">
                    {{ rec.restockNumber || `#${rec.id}` }}
                  </span>
                  <span
                    :class="[
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      getSourceBadge(rec.source).badgeClass
                    ]"
                  >
                    {{ getSourceBadge(rec.source).label }}
                  </span>
                  <span
                    v-if="rec.shiftCode"
                    class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                  >
                    {{ rec.shiftCode }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  {{ formatDateTime(rec.createdAt) }}
                  <template v-if="rec.note"> • {{ rec.note }}</template>
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <p class="text-sm font-bold font-mono text-[#0a193d]">
                  Rp {{ Number(rec.totalCost || 0).toLocaleString('id-ID') }}
                </p>

                <button
                  v-if="confirmingDeleteId !== rec.id"
                  type="button"
                  @click="confirmingDeleteId = rec.id"
                  class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
                  title="Batalkan / Hapus Nota Kulakan"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
                <div v-else class="flex items-center gap-1">
                  <button
                    type="button"
                    @click="confirmDelete(rec.id)"
                    class="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    @click="confirmingDeleteId = null"
                    class="h-7 px-2 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
              <span
                v-for="(it, i) in (rec.items || [])"
                :key="i"
                class="text-[11px] px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700 font-medium"
              >
                {{ it.productName }} <strong class="font-mono">{{ it.qty }}×</strong> @Rp {{ Number(it.unitBuyPrice || 0).toLocaleString('id-ID') }}
              </span>
            </div>
          </div>
        </div>

        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            @click="emit('close')"
            class="h-10 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
