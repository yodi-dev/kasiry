<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  Package, 
  Barcode, 
  Tag, 
  ArrowLeft, 
  TrendingUp,
  Info,
  Sparkles,
  CheckSquare,
  Square
} from '@lucide/vue'
import { sanitizeOptionalPrice, sanitizeMinQty } from '../utils/pricing'
import { buildProductUsageMap } from '../utils/productUsage'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  products: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => ['Sembako', 'Makanan', 'Minuman', 'Jajanan & Kopi', 'Bumbu Dapur', 'Kebersihan', 'Rokok', 'Curah', 'Obat & Lainnya']
  },
  getProductUsageStats: {
    type: Function,
    default: null
  }
})

const emit = defineEmits([
  'close', 
  'saveProduct', 
  'deleteProduct', 
  'deleteProductsBulk',
  'addCategory', 
  'deleteCategory'
])

const defaultCategories = ['Sembako', 'Makanan', 'Minuman', 'Jajanan & Kopi', 'Bumbu Dapur', 'Kebersihan', 'Rokok', 'Curah', 'Obat & Lainnya']

// currentView: 'list' | 'form' | 'categories'
const currentView = ref('list')

const handleClose = () => {
  currentView.value = 'list'
  isAddingCategoryInline.value = false
  confirmBulkDelete.value = false
  emit('close')
}

const searchQuery = ref('')
const selectedCategory = ref('Semua')
// statusFilter: 'all' | 'unpriced' | 'neverSold' | 'slowMoving'
const statusFilter = ref('all')
const newCategoryInput = ref('')
const isAddingCategoryInline = ref(false)
const displayLimit = ref(60)
const selectedIds = ref([])
const confirmBulkDelete = ref(false)
const inlineEditId = ref(null)
const quickPriceDrafts = ref({})
const usageStats = ref({
  byId: {},
  unpricedCount: 0,
  neverSoldCount: 0,
  slowMovingCount: 0
})

const refreshUsageStats = async () => {
  if (typeof props.getProductUsageStats === 'function') {
    try {
      const res = await props.getProductUsageStats(30)
      if (res && res.byId) {
        usageStats.value = res
        return
      }
    } catch {
      // Fallback ke kalkulasi lokal jika query async gagal
    }
  }
  usageStats.value = buildProductUsageMap(props.products, [])
}

// Selalu reset ke tampilan list saat modal dibuka kembali & muat statistik terjual lintas histori
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentView.value = 'list'
    searchQuery.value = ''
    statusFilter.value = 'all'
    selectedCategory.value = 'Semua'
    isAddingCategoryInline.value = false
    displayLimit.value = 60
    selectedIds.value = []
    confirmBulkDelete.value = false
    inlineEditId.value = null
    quickPriceDrafts.value = {}
    refreshUsageStats()
  }
}, { immediate: true })

watch(() => props.products, () => {
  if (props.isOpen) {
    refreshUsageStats()
  }
})

watch([searchQuery, selectedCategory, statusFilter], () => {
  displayLimit.value = 60
  confirmBulkDelete.value = false
})

const currentProduct = ref({
  id: null,
  name: '',
  sellPrice: '',
  buyPrice: '',
  wholesalePrice: '',
  wholesaleMinQty: '',
  agentPrice: '',
  stock: '',
  barcode: '',
  category: 'Sembako',
  isMacro: false
})

const availableCategories = computed(() => {
  if (props.categories && props.categories.length > 0) {
    return props.categories
  }
  return defaultCategories
})

const filterCategories = computed(() => {
  return ['Semua', ...availableCategories.value]
})

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const usageMap = usageStats.value?.byId || {}
  const base = props.products.filter(p => {
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.includes(q))
    const matchesCategory = selectedCategory.value === 'Semua' || p.category === selectedCategory.value
    if (!matchesSearch || !matchesCategory) return false

    const u = usageMap[p.id]
    if (statusFilter.value === 'unpriced') {
      return !(Number(p.sellPrice || 0) > 0)
    }
    if (statusFilter.value === 'neverSold') {
      return u ? u.isNeverSold : true
    }
    if (statusFilter.value === 'slowMoving') {
      return Boolean(u && u.isSlowMoving)
    }
    return true
  })

  // Prioritaskan barang bertarif > 0 yang belum terjual di filter Belum Terjual (dead priced stock)
  if (statusFilter.value === 'neverSold') {
    return base.slice().sort((a, b) => (b.sellPrice > 0 ? 1 : 0) - (a.sellPrice > 0 ? 1 : 0))
  }
  return base
})

const visibleProducts = computed(() => filteredProducts.value.slice(0, displayLimit.value))

const selectedIdSet = computed(() => new Set(selectedIds.value))

const toggleSelectProduct = (id) => {
  confirmBulkDelete.value = false
  if (selectedIdSet.value.has(id)) {
    selectedIds.value = selectedIds.value.filter(x => x !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

const toggleSelectAllFiltered = () => {
  confirmBulkDelete.value = false
  const targetIds = filteredProducts.value.map(p => p.id)
  if (targetIds.length > 0 && targetIds.every(id => selectedIdSet.value.has(id))) {
    selectedIds.value = []
  } else {
    selectedIds.value = targetIds
  }
}

const executeBulkDelete = () => {
  if (selectedIds.value.length === 0) return
  const idsToRemove = [...selectedIds.value]
  emit('deleteProductsBulk', idsToRemove)
  selectedIds.value = []
  confirmBulkDelete.value = false
}

const startInlineQuickPrice = (p) => {
  inlineEditId.value = inlineEditId.value === p.id ? null : p.id
  if (quickPriceDrafts.value[p.id] === undefined) {
    quickPriceDrafts.value[p.id] = p.sellPrice > 0 ? String(p.sellPrice) : ''
  }
}

const saveInlineQuickPrice = (p) => {
  const digits = String(quickPriceDrafts.value[p.id] ?? '').replace(/\D/g, '')
  const nextSell = parseInt(digits || '0', 10)
  if (!Number.isFinite(nextSell) || nextSell <= 0) return

  emit('saveProduct', {
    ...p,
    sellPrice: nextSell,
    buyPrice: p.buyPrice > 0 ? p.buyPrice : Math.round(nextSell * 0.8)
  })
  inlineEditId.value = null
  delete quickPriceDrafts.value[p.id]
}

const getProductCountByCategory = (cat) => {
  return props.products.filter(p => p.category === cat).length
}

// Hitung estimasi keuntungan saat mengisi form
const estimatedProfit = computed(() => {
  const sell = parseInt(String(currentProduct.value.sellPrice).replace(/\D/g, '') || '0', 10)
  const buy = parseInt(String(currentProduct.value.buyPrice).replace(/\D/g, '') || '0', 10)
  if (sell > 0 && buy > 0) {
    return sell - buy
  }
  return 0
})

const isLikelyBarcode = (raw = '') => {
  const clean = String(raw || '').trim()
  return /^\d{4,}$/.test(clean) || (!/\s/.test(clean) && /\d/.test(clean) && /^[A-Za-z0-9_-]{6,}$/.test(clean))
}

const openAddForm = (prefillQuery = '') => {
  const cleanPrefill = typeof prefillQuery === 'string' ? prefillQuery.trim() : ''
  const asBarcode = cleanPrefill ? isLikelyBarcode(cleanPrefill) : false
  currentProduct.value = {
    id: null,
    name: cleanPrefill && !asBarcode ? cleanPrefill : '',
    sellPrice: '',
    buyPrice: '',
    wholesalePrice: '',
    wholesaleMinQty: '',
    agentPrice: '',
    stock: '',
    barcode: asBarcode ? cleanPrefill : '',
    category: selectedCategory.value !== 'Semua' ? selectedCategory.value : (availableCategories.value[0] || 'Sembako'),
    isMacro: false
  }
  isAddingCategoryInline.value = false
  currentView.value = 'form'
}

const handleSearchEnter = (e) => {
  if (e?.isComposing || e?.keyCode === 229) return
  const q = searchQuery.value.trim()
  if (!q) return
  if (filteredProducts.value.length === 0) {
    e?.preventDefault()
    openAddForm(q)
  }
}

const openEditForm = (p) => {
  currentProduct.value = {
    id: p.id,
    name: p.name,
    sellPrice: p.sellPrice > 0 ? String(p.sellPrice) : '',
    buyPrice: p.buyPrice > 0 ? String(p.buyPrice) : '',
    wholesalePrice: p.wholesalePrice > 0 ? String(p.wholesalePrice) : '',
    wholesaleMinQty: p.wholesaleMinQty >= 2 ? String(p.wholesaleMinQty) : '',
    agentPrice: p.agentPrice > 0 ? String(p.agentPrice) : '',
    stock: (p.stock !== null && p.stock !== undefined && Number.isFinite(Number(p.stock))) ? String(p.stock) : '',
    barcode: p.barcode || '',
    category: p.category || (availableCategories.value[0] || 'Sembako'),
    isMacro: !!p.isMacro
  }
  isAddingCategoryInline.value = false
  currentView.value = 'form'
}

const handleSave = () => {
  const sell = parseInt(String(currentProduct.value.sellPrice).replace(/\D/g, '') || '0', 10)
  const buy = parseInt(String(currentProduct.value.buyPrice).replace(/\D/g, '') || '0', 10)
  if (!currentProduct.value.name.trim()) return

  const rawStock = String(currentProduct.value.stock ?? '').trim()
  const parsedStock = rawStock === '' ? null : Math.max(0, Math.round(Number(rawStock)))

  emit('saveProduct', {
    id: currentProduct.value.id || Date.now(),
    name: currentProduct.value.name.trim(),
    sellPrice: sell > 0 ? sell : 0,
    buyPrice: buy > 0 ? buy : (sell > 0 ? Math.round(sell * 0.8) : 0),
    wholesalePrice: sanitizeOptionalPrice(currentProduct.value.wholesalePrice),
    wholesaleMinQty: sanitizeMinQty(currentProduct.value.wholesaleMinQty),
    agentPrice: sanitizeOptionalPrice(currentProduct.value.agentPrice),
    stock: parsedStock !== null && Number.isFinite(parsedStock) ? parsedStock : null,
    barcode: currentProduct.value.barcode.trim(),
    category: currentProduct.value.category,
    isMacro: currentProduct.value.isMacro || false
  })

  currentView.value = 'list'
}

const handleDelete = (id, name) => {
  if (confirm(`Hapus barang "${name}" dari daftar?`)) {
    emit('deleteProduct', id)
  }
}

// Manajemen Kategori
const handleCreateCategory = () => {
  const trimmed = newCategoryInput.value.trim()
  if (!trimmed) return
  emit('addCategory', trimmed)
  
  if (currentView.value === 'form') {
    currentProduct.value.category = trimmed
    isAddingCategoryInline.value = false
  }
  
  newCategoryInput.value = ''
}

const handleDeleteCategory = (cat) => {
  const count = getProductCountByCategory(cat)
  if (count > 0) {
    alert(`Kategori "${cat}" tidak dapat dihapus karena masih digunakan oleh ${count} barang.\n\nSilakan ganti kategori barang terkait terlebih dahulu.`)
    return
  }

  if (confirm(`Hapus kategori "${cat}" dari daftar?`)) {
    emit('deleteCategory', cat)
    if (selectedCategory.value === cat) {
      selectedCategory.value = 'Semua'
    }
    if (currentProduct.value.category === cat) {
      currentProduct.value.category = availableCategories.value[0] || 'Sembako'
    }
  }
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <!-- Tombol Kembali saat di sub-view (Form Tambah/Edit atau Kelola Kategori) -->
          <button 
            v-if="currentView !== 'list'"
            @click="currentView = 'list'"
            class="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Kembali ke Daftar Barang"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>

          <div v-else class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Tag v-if="currentView === 'categories'" class="w-5 h-5 text-sky-400" />
            <Package v-else class="w-5 h-5 text-sky-400" />
          </div>

          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              {{ currentView === 'categories' ? 'Kelola Kategori Barang' : currentView === 'form' ? (currentProduct.id ? 'Edit Data Barang' : 'Tambah Barang Baru') : 'Kelola Barang Toko' }}
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ currentView === 'categories' ? `Total ${availableCategories.length} kategori terdaftar` : currentView === 'form' ? 'Lengkapi detail data barang' : `Total ${products.length} produk terdaftar` }}
            </p>
          </div>
        </div>

        <!-- Tombol X: Jika di sub-view kembali ke list; jika di list tutup modal -->
        <button 
          @click="currentView !== 'list' ? currentView = 'list' : handleClose()"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          :title="currentView !== 'list' ? 'Kembali ke Daftar Barang' : 'Tutup'"
          aria-label="Tutup atau Kembali"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- VIEW 1: DAFTAR BARANG (LIST VIEW) -->
      <div v-if="currentView === 'list'" class="flex flex-col flex-1 min-h-0">
        <!-- Control Bar (Search & Tambah) -->
        <div class="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <Search class="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                v-model="searchQuery"
                @keydown.enter="handleSearchEnter"
                placeholder="Cari nama barang atau scan barcode..."
                class="w-full h-11 pl-10 pr-8 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs sm:text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
              />
              <button 
                v-if="searchQuery" 
                @click="searchQuery = ''"
                class="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <button 
              @click="openAddForm()"
              class="h-11 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Plus class="w-4 h-4 text-sky-400" />
              <span class="hidden sm:inline">Tambah Barang</span>
              <span class="sm:hidden">Tambah</span>
            </button>
          </div>

          <!-- Status Filter Chips (Semua | Belum Harga | Belum Terjual | Sepi >=30 Hr) -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              @click="statusFilter = 'all'"
              :class="[
                'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border',
                statusFilter === 'all'
                  ? 'bg-[#0a193d] text-white border-[#0a193d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              ]"
            >
              Semua ({{ products.length }})
            </button>
            <button
              type="button"
              @click="statusFilter = 'unpriced'"
              :class="[
                'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border',
                statusFilter === 'unpriced'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : usageStats.unpricedCount > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              ]"
            >
              Belum Harga ({{ usageStats.unpricedCount }})
            </button>
            <button
              type="button"
              @click="statusFilter = 'neverSold'"
              :class="[
                'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border',
                statusFilter === 'neverSold'
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-sky-50/70 text-[#0284c7] border-sky-200/80 hover:bg-sky-100'
              ]"
            >
              Belum Terjual ({{ usageStats.neverSoldCount }})
            </button>
            <button
              type="button"
              @click="statusFilter = 'slowMoving'"
              :class="[
                'px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all border',
                statusFilter === 'slowMoving'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50/60 text-rose-700 border-rose-200/80 hover:bg-rose-100'
              ]"
            >
              Sepi ≥30 Hr ({{ usageStats.slowMovingCount }})
            </button>
          </div>

          <!-- Kategori Filter Chips + Tombol Kelola Kategori -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button 
              v-for="cat in filterCategories" 
              :key="cat"
              @click="selectedCategory = cat"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                selectedCategory === cat 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              {{ cat }}
            </button>

            <!-- Tombol Masuk ke View Kelola Kategori -->
            <button 
              @click="currentView = 'categories'"
              class="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-[#0284c7] border border-sky-200/60 whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              title="Kelola Kategori Barang"
            >
              <Tag class="w-3.5 h-3.5" />
              <span>Kelola Kategori</span>
            </button>
          </div>

          <!-- Bar Aksi Pilih Banyak / Rapikan Katalog -->
          <div
            v-if="filteredProducts.length > 0 && (selectedIds.length > 0 || statusFilter === 'neverSold' || statusFilter === 'slowMoving')"
            class="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 flex-wrap"
          >
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="toggleSelectAllFiltered"
                class="text-[11px] font-bold text-[#0284c7] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare
                  v-if="filteredProducts.length > 0 && filteredProducts.every(p => selectedIdSet.has(p.id))"
                  class="w-3.5 h-3.5"
                />
                <Square v-else class="w-3.5 h-3.5" />
                <span>
                  {{ filteredProducts.every(p => selectedIdSet.has(p.id)) ? 'Batal Pilih Semua' : `Pilih Semua (${filteredProducts.length})` }}
                </span>
              </button>
              <span v-if="selectedIds.length > 0" class="text-[11px] font-bold text-slate-600">
                • {{ selectedIds.length }} dipilih
              </span>
            </div>

            <div v-if="selectedIds.length > 0" class="flex items-center gap-1.5">
              <template v-if="!confirmBulkDelete">
                <button
                  type="button"
                  @click="confirmBulkDelete = true"
                  class="h-7 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 class="w-3 h-3" />
                  <span>Hapus Terpilih ({{ selectedIds.length }})</span>
                </button>
              </template>
              <template v-else>
                <span class="text-[11px] font-bold text-rose-700">Yakin hapus {{ selectedIds.length }} barang?</span>
                <button
                  type="button"
                  @click="executeBulkDelete"
                  class="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Ya, Hapus
                </button>
                <button
                  type="button"
                  @click="confirmBulkDelete = false"
                  class="h-7 px-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
                >
                  Batal
                </button>
              </template>
            </div>
            <span v-else class="text-[11px] text-slate-500">
              {{ statusFilter === 'neverSold' ? 'Centang barang yang tidak dijual warung untuk dirapikan, atau pasang promo.' : 'Kandidat promo / diskon untuk barang sepi ≥30 hari.' }}
            </span>
          </div>
        </div>

        <!-- Product Cards Scrollable List -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          <!-- Empty State -->
          <div 
            v-if="filteredProducts.length === 0" 
            class="min-h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Package class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">
              {{ searchQuery.trim() ? `Barang "${searchQuery.trim()}" belum ada di katalog` : 'Tidak ada barang yang cocok' }}
            </p>
            <p class="text-[11px] text-slate-400 mt-0.5">
              {{ searchQuery.trim() ? 'Tekan Enter atau klik tombol di bawah untuk langsung mendaftarkannya.' : 'Coba ubah kata kunci pencarian atau kategori filter' }}
            </p>
            <button
              v-if="searchQuery.trim()"
              type="button"
              @click="openAddForm(searchQuery.trim())"
              class="mt-3 h-10 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Plus class="w-4 h-4 text-sky-400" />
              <span>Tambah "{{ searchQuery.trim() }}"</span>
            </button>
          </div>

          <!-- Product Item Card -->
          <div 
            v-for="p in visibleProducts" 
            :key="p.id"
            class="p-3 sm:p-3.5 bg-white hover:bg-slate-50/80 border rounded-2xl transition-all shadow-2xs space-y-2 group"
            :class="selectedIdSet.has(p.id) ? 'border-[#0284c7] bg-sky-50/30' : 'border-slate-200/80'"
          >
            <div class="flex items-center justify-between gap-2.5">
              <!-- Info Produk + Checkbox -->
              <div class="min-w-0 flex-1 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  :checked="selectedIdSet.has(p.id)"
                  @change="toggleSelectProduct(p.id)"
                  :aria-label="`Pilih ${p.name}`"
                  class="w-4 h-4 rounded accent-[#0a193d] cursor-pointer shrink-0"
                />

                <!-- Monogram Avatar -->
                <div class="hidden sm:flex w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-sky-50 text-slate-700 group-hover:text-[#0284c7] items-center justify-center font-bold text-sm uppercase shrink-0 border border-slate-200/70 transition-colors">
                  {{ p.name ? p.name.charAt(0) : 'P' }}
                </div>

                <div class="min-w-0 flex-1">
                  <h5 class="font-bold text-sm text-[#0a193d] truncate">{{ p.name }}</h5>

                  <div class="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs">
                    <span v-if="p.sellPrice > 0" class="font-bold text-[#0a193d] font-mono">
                      Rp {{ p.sellPrice.toLocaleString('id-ID') }}
                    </span>
                    <span
                      v-else
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80"
                    >
                      Belum Ada Harga
                    </span>
                    
                    <span v-if="p.buyPrice > 0" class="text-[11px] text-slate-400 font-mono">
                      Modal: Rp {{ p.buyPrice.toLocaleString('id-ID') }}
                    </span>

                    <span
                      v-if="p.wholesalePrice > 0"
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 font-mono"
                    >
                      Grosir: Rp {{ p.wholesalePrice.toLocaleString('id-ID') }}<template v-if="p.wholesaleMinQty >= 2"> (≥{{ p.wholesaleMinQty }})</template>
                    </span>

                    <span
                      v-if="p.agentPrice > 0"
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0284c7] border border-sky-200/70 font-mono"
                    >
                      Agen: Rp {{ p.agentPrice.toLocaleString('id-ID') }}
                    </span>

                    <span
                      v-if="p.stock !== null && p.stock !== undefined"
                      :class="[
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono',
                        Number(p.stock) === 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                          : Number(p.stock) <= 5
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      ]"
                    >
                      {{ Number(p.stock) === 0 ? 'Habis (0)' : `Stok: ${p.stock}` }}
                    </span>

                    <span
                      v-if="usageStats.byId[p.id]?.totalQtySold > 0"
                      :class="[
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                        usageStats.byId[p.id].isSlowMoving
                          ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                          : 'bg-slate-100 text-slate-600 border-slate-200/60'
                      ]"
                    >
                      {{ usageStats.byId[p.id].isSlowMoving
                        ? `Sepi ≥30hr (${usageStats.byId[p.id].totalQtySold}×)`
                        : `Terjual ${usageStats.byId[p.id].totalQtySold}×` }}
                    </span>
                    <span
                      v-else-if="statusFilter === 'neverSold'"
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/70"
                    >
                      Belum pernah terjual
                    </span>

                    <span v-if="p.category" class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      {{ p.category }}
                    </span>

                    <span v-if="p.barcode" class="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[110px]">
                      #{{ p.barcode }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Tombol Aksi Promo / Edit / Hapus -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  v-if="p.sellPrice > 0"
                  type="button"
                  @click="startInlineQuickPrice(p)"
                  class="h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-bold hidden sm:inline-flex items-center gap-1 cursor-pointer transition-colors"
                  title="Atur Harga Cepat / Promo"
                >
                  <Sparkles class="w-3 h-3" />
                  <span>{{ statusFilter === 'neverSold' || statusFilter === 'slowMoving' ? 'Promo' : 'Harga' }}</span>
                </button>

                <button 
                  @click="openEditForm(p)"
                  class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-[#0284c7] hover:border-sky-200 border border-transparent flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Edit Barang"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                </button>
                
                <button 
                  @click="handleDelete(p.id, p.name)"
                  class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 hover:border-rose-200 border border-transparent flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Hapus Barang"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Bar Input Harga Cepat Inline (Otomatis muncul di tab Belum Harga atau saat tombol Harga/Promo ditekan) -->
            <div
              v-if="statusFilter === 'unpriced' || !(p.sellPrice > 0) || inlineEditId === p.id"
              class="pt-2 border-t border-slate-100 flex items-center gap-2 pl-6"
            >
              <span class="text-[11px] font-bold text-slate-500 shrink-0">
                {{ p.sellPrice > 0 ? 'Harga Baru / Promo:' : 'Isi Harga Jual:' }}
              </span>
              <div class="relative flex-1 max-w-[180px]">
                <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[11px] font-bold text-slate-400">
                  Rp
                </span>
                <input
                  v-model="quickPriceDrafts[p.id]"
                  type="number"
                  min="1"
                  inputmode="numeric"
                  :placeholder="p.sellPrice > 0 ? String(p.sellPrice) : 'Misal: 3500'"
                  @keydown.enter.prevent="saveInlineQuickPrice(p)"
                  :aria-label="`Harga cepat ${p.name}`"
                  class="w-full h-8 pl-8 pr-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-lg text-xs font-bold font-mono text-right text-[#0a193d] outline-hidden"
                />
              </div>
              <button
                type="button"
                @click="saveInlineQuickPrice(p)"
                class="h-8 px-3 rounded-lg bg-[#0a193d] hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Check class="w-3 h-3 text-emerald-400" />
                <span>Simpan</span>
              </button>
            </div>
          </div>

          <div v-if="filteredProducts.length > visibleProducts.length" class="pt-2 flex justify-center">
            <button
              type="button"
              @click="displayLimit += 60"
              class="h-9 px-4 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-xs font-bold text-[#0284c7] cursor-pointer"
            >
              Tampilkan Lagi ({{ visibleProducts.length }} / {{ filteredProducts.length }})
            </button>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500 font-medium">
            Menampilkan {{ visibleProducts.length }} dari {{ filteredProducts.length }} barang
          </span>
          <button 
            @click="handleClose"
            class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>

      <!-- VIEW 2: FORM TAMBAH / EDIT BARANG -->
      <div v-else-if="currentView === 'form'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Form Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">
              {{ currentProduct.id ? 'Edit Data Barang' : 'Tambah Barang Baru' }}
            </h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Daftar</span>
          </button>
        </div>

        <!-- Form Inputs -->
        <div class="space-y-3.5">
          <!-- Nama Barang -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Barang
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Package class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="currentProduct.name"
                placeholder="Contoh: Beras Ramos 5 Kg"
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Harga Jual Ecer & Harga Modal Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Harga Ecer / Umum (Rp)
                </label>
                <span v-if="estimatedProfit > 0" class="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                  <TrendingUp class="w-3 h-3" /> Untung Rp {{ estimatedProfit.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-xs">
                  Rp
                </span>
                <input 
                  type="number" 
                  v-model="currentProduct.sellPrice"
                  placeholder="15000"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-base font-bold text-[#0a193d] text-right font-mono outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Harga Modal (Opsional)
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-medium text-slate-400 text-xs">
                  Rp
                </span>
                <input 
                  type="number" 
                  v-model="currentProduct.buyPrice"
                  placeholder="12000"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-base font-medium text-slate-700 text-right font-mono outline-hidden transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Multi Harga (Opsional: Harga Grosir & Harga Agen) -->
          <div class="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#0a193d] uppercase tracking-wider">
                Multi Harga (Opsional)
              </span>
              <span class="text-[11px] text-slate-500 font-medium">
                Kosongkan jika hanya dijual harga ecer
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">
                  Harga Grosir (Rp)
                </label>
                <input
                  type="number"
                  inputmode="numeric"
                  v-model="currentProduct.wholesalePrice"
                  placeholder="Opsional"
                  class="w-full h-10 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-bold text-amber-800 text-right font-mono outline-hidden transition-all"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">
                  Min. Qty Grosir
                </label>
                <input
                  type="number"
                  inputmode="numeric"
                  min="2"
                  v-model="currentProduct.wholesaleMinQty"
                  placeholder="Misal: 5 (opsional)"
                  class="w-full h-10 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-semibold text-[#0a193d] text-right font-mono outline-hidden transition-all"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">
                  Harga Agen (Rp)
                </label>
                <input
                  type="number"
                  inputmode="numeric"
                  v-model="currentProduct.agentPrice"
                  placeholder="Opsional"
                  class="w-full h-10 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-bold text-[#0284c7] text-right font-mono outline-hidden transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Stok Produk (Opsional & Non-Blocking) -->
          <div class="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-1.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Stok Saat Ini (Opsional)
              </label>
              <span class="text-[11px] text-slate-500 font-medium">
                Kosongkan jika tidak perlu melacak stok
              </span>
            </div>
            <div class="flex items-center gap-3">
              <input
                type="number"
                min="0"
                inputmode="numeric"
                v-model="currentProduct.stock"
                placeholder="Kosong = tidak dilacak (bebas jual)"
                class="w-44 h-10 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-bold text-[#0a193d] text-right font-mono outline-hidden transition-all"
              />
              <span class="text-[11px] text-slate-600 leading-snug">
                Berkurang otomatis saat laku &amp; bertambah saat kulakan. Barang stok 0 tetap bisa dibeli di kasa.
              </span>
            </div>
          </div>

          <!-- Barcode & Kategori Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kode Barcode (Opsional)
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Barcode class="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  v-model="currentProduct.barcode"
                  placeholder="Scan atau ketik barcode..."
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-mono font-semibold text-[#0a193d] outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kategori Produk
                </label>
                <button 
                  v-if="!isAddingCategoryInline"
                  type="button"
                  @click="isAddingCategoryInline = true"
                  class="text-[11px] font-bold text-[#0284c7] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus class="w-3 h-3" /> Tambah Kategori
                </button>
              </div>

              <!-- Inline Quick Add Input -->
              <div v-if="isAddingCategoryInline" class="flex items-center gap-2 mb-2 p-2 bg-sky-50/70 border border-sky-100 rounded-xl animate-in fade-in duration-150">
                <input 
                  type="text" 
                  v-model="newCategoryInput"
                  @keyup.enter="handleCreateCategory"
                  placeholder="Ketik kategori baru..."
                  class="flex-1 h-9 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-lg text-xs font-semibold text-[#0a193d] outline-hidden shadow-2xs"
                  autofocus
                />
                <button 
                  type="button"
                  @click="handleCreateCategory"
                  :disabled="!newCategoryInput.trim()"
                  class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg cursor-pointer disabled:cursor-not-allowed transition-all shadow-2xs"
                >
                  Simpan
                </button>
                <button 
                  type="button"
                  @click="isAddingCategoryInline = false; newCategoryInput = ''"
                  class="h-9 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Batal
                </button>
              </div>

              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Tag class="w-4 h-4" />
                </span>
                <select 
                  v-model="currentProduct.category"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-bold text-[#0a193d] outline-hidden transition-all appearance-none cursor-pointer"
                >
                  <option v-for="c in availableCategories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Tombol Aksi Form -->
        <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button 
            @click="currentView = 'list'"
            class="h-11 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button 
            @click="handleSave"
            class="h-11 px-6 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Check class="w-4 h-4 text-sky-400" />
            <span>Simpan Barang</span>
          </button>
        </div>
      </div>

      <!-- VIEW 3: KELOLA KATEGORI BARANG (DI DALAM MODAL YANG SAMA - TANPA BACKDROP BERTUMPUK!) -->
      <div v-else-if="currentView === 'categories'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Kategori Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">Pengaturan Kategori Produk</h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Barang</span>
          </button>
        </div>

        <!-- Form Input Buat Kategori Baru -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Buat Kategori Baru
          </label>
          <div class="flex items-center gap-2">
            <input 
              type="text" 
              v-model="newCategoryInput"
              @keyup.enter="handleCreateCategory"
              placeholder="Contoh: Obat & Herbal, Gas & Galon..."
              class="flex-1 h-11 px-3.5 bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-xl text-xs sm:text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
            />
            <button 
              @click="handleCreateCategory"
              :disabled="!newCategoryInput.trim()"
              class="h-11 px-4 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all shadow-xs shrink-0"
            >
              <Plus class="w-4 h-4 text-sky-400" />
              <span>Tambah</span>
            </button>
          </div>
        </div>

        <!-- Daftar Kategori Tersedia -->
        <div>
          <p class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Daftar Kategori Tersedia ({{ availableCategories.length }})
          </p>
          <div class="space-y-1.5">
            <div 
              v-for="cat in availableCategories" 
              :key="cat"
              class="p-2.5 px-3.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 transition-colors"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Tag class="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                <span class="text-xs font-bold text-[#0a193d] truncate">{{ cat }}</span>
                <span class="text-[11px] text-slate-400 font-mono">({{ getProductCountByCategory(cat) }} barang)</span>
              </div>

              <div class="shrink-0 flex items-center">
                <button 
                  @click="handleDeleteCategory(cat)"
                  :class="[
                    'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
                    getProductCountByCategory(cat) > 0 
                      ? 'text-slate-300 hover:text-slate-400 cursor-not-allowed' 
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                  ]"
                  :title="getProductCountByCategory(cat) > 0 ? `Tidak bisa dihapus: masih dipakai oleh ${getProductCountByCategory(cat)} barang` : 'Hapus Kategori'"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <p class="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>Kategori yang masih berisi barang tidak dapat dihapus sebelum kategori barangnya diganti.</span>
          </p>
        </div>

        <!-- Tombol Selesai Kelola Kategori -->
        <div class="pt-3 flex justify-end border-t border-slate-100">
          <button 
            @click="currentView = 'list'"
            class="h-10 px-5 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
