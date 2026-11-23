<script setup>
import { ref, computed } from 'vue'
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
  Sparkles,
  TrendingUp 
} from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  products: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'saveProduct', 'deleteProduct'])

const searchQuery = ref('')
const selectedCategory = ref('Semua')
const isEditing = ref(false)

const currentProduct = ref({
  id: null,
  name: '',
  sellPrice: '',
  buyPrice: '',
  barcode: '',
  category: 'Sembako',
  isMacro: false
})

const categories = ['Semua', 'Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']
const formCategories = ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return props.products.filter(p => {
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.includes(q))
    
    const matchesCategory = selectedCategory.value === 'Semua' || p.category === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})

// Hitung estimasi keuntungan saat mengisi form
const estimatedProfit = computed(() => {
  const sell = parseInt(String(currentProduct.value.sellPrice).replace(/\D/g, '') || '0', 10)
  const buy = parseInt(String(currentProduct.value.buyPrice).replace(/\D/g, '') || '0', 10)
  if (sell > 0 && buy > 0) {
    return sell - buy
  }
  return 0
})

const openAddForm = () => {
  currentProduct.value = {
    id: null,
    name: '',
    sellPrice: '',
    buyPrice: '',
    barcode: '',
    category: selectedCategory.value !== 'Semua' ? selectedCategory.value : 'Sembako',
    isMacro: false
  }
  isEditing.value = true
}

const openEditForm = (p) => {
  currentProduct.value = {
    id: p.id,
    name: p.name,
    sellPrice: String(p.sellPrice),
    buyPrice: p.buyPrice ? String(p.buyPrice) : '',
    barcode: p.barcode || '',
    category: p.category || 'Sembako',
    isMacro: !!p.isMacro
  }
  isEditing.value = true
}

const handleSave = () => {
  const sell = parseInt(String(currentProduct.value.sellPrice).replace(/\D/g, '') || '0', 10)
  const buy = parseInt(String(currentProduct.value.buyPrice).replace(/\D/g, '') || '0', 10)
  if (!currentProduct.value.name.trim() || sell <= 0) return

  emit('saveProduct', {
    id: currentProduct.value.id || Date.now(),
    name: currentProduct.value.name.trim(),
    sellPrice: sell,
    buyPrice: buy > 0 ? buy : Math.round(sell * 0.8),
    barcode: currentProduct.value.barcode.trim(),
    category: currentProduct.value.category,
    isMacro: currentProduct.value.isMacro
  })

  isEditing.value = false
}

const handleDelete = (id, name) => {
  if (confirm(`Hapus barang "${name}" dari daftar?`)) {
    emit('deleteProduct', id)
  }
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100/90 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs">
            <Package class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Kelola Barang Toko</h3>
            <p class="text-xs text-slate-500 font-medium">Total {{ products.length }} produk terdaftar</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- VIEW 1: FORM TAMBAH / EDIT BARANG -->
      <div v-if="isEditing" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Form Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-sky-50 text-[#0284c7] flex items-center justify-center font-bold text-xs">
              <Edit2 v-if="currentProduct.id" class="w-3.5 h-3.5" />
              <Plus v-else class="w-4 h-4" />
            </span>
            <h4 class="font-bold text-sm text-[#0a193d]">
              {{ currentProduct.id ? 'Edit Data Barang' : 'Tambah Barang Baru' }}
            </h4>
          </div>
          <button 
            @click="isEditing = false"
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

          <!-- Harga Jual & Harga Modal Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Harga Jual (Rp)
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
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori Produk
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Tag class="w-4 h-4" />
                </span>
                <select 
                  v-model="currentProduct.category"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-bold text-[#0a193d] outline-hidden transition-all appearance-none cursor-pointer"
                >
                  <option v-for="c in formCategories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Pilihan Tombol Cepat Beranda -->
          <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                <Sparkles class="w-4 h-4" />
              </div>
              <div>
                <strong class="text-xs font-bold text-[#0a193d] block">Tampilkan di Tombol Cepat Beranda</strong>
                <span class="text-[11px] text-slate-500">Muncul di menu cepat kasir untuk barang paling laris.</span>
              </div>
            </div>
            <input 
              type="checkbox" 
              v-model="currentProduct.isMacro"
              class="w-5 h-5 accent-[#0a193d] rounded cursor-pointer shrink-0"
            />
          </div>
        </div>

        <!-- Tombol Aksi Form -->
        <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button 
            @click="isEditing = false"
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

      <!-- VIEW 2: DAFTAR BARANG (SEARCH, FILTER & LIST) -->
      <div v-else class="flex flex-col flex-1 min-h-0">
        <!-- Control Bar (Search & Tambah) -->
        <div class="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <Search class="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="Cari nama barang atau barcode..."
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
              @click="openAddForm"
              class="h-11 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Plus class="w-4 h-4 text-sky-400" />
              <span class="hidden sm:inline">Tambah Barang</span>
              <span class="sm:hidden">Tambah</span>
            </button>
          </div>

          <!-- Kategori Filter Chips -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button 
              v-for="cat in categories" 
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
          </div>
        </div>

        <!-- Product Cards Scrollable List -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          <!-- Empty State -->
          <div 
            v-if="filteredProducts.length === 0" 
            class="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Package class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Tidak ada barang yang cocok</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau kategori filter</p>
          </div>

          <!-- Product Item Card -->
          <div 
            v-for="p in filteredProducts" 
            :key="p.id"
            class="p-3 sm:p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl transition-all shadow-2xs flex items-center justify-between gap-3 group"
          >
            <!-- Info Produk -->
            <div class="min-w-0 flex-1 flex items-center gap-3">
              <!-- Monogram Avatar -->
              <div class="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-sky-50 text-slate-700 group-hover:text-[#0284c7] flex items-center justify-center font-bold text-sm uppercase shrink-0 border border-slate-200/70 transition-colors">
                {{ p.name ? p.name.charAt(0) : 'P' }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h5 class="font-bold text-sm text-[#0a193d] truncate">{{ p.name }}</h5>
                  <span 
                    v-if="p.isMacro" 
                    class="text-[10px] bg-sky-50 text-sky-700 border border-sky-200/60 px-2 py-0.2 rounded-full font-bold flex items-center gap-0.5 shrink-0"
                  >
                    ★ Cepat
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
                  <span class="font-bold text-[#0a193d] font-mono">
                    Rp {{ p.sellPrice.toLocaleString('id-ID') }}
                  </span>
                  
                  <span v-if="p.buyPrice" class="text-[11px] text-slate-400 font-mono">
                    Modal: Rp {{ p.buyPrice.toLocaleString('id-ID') }}
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

            <!-- Tombol Aksi Edit & Hapus -->
            <div class="flex items-center gap-1.5 shrink-0">
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
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500 font-medium">
            Menampilkan {{ filteredProducts.length }} dari {{ products.length }} barang
          </span>
          <button 
            @click="emit('close')"
            class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
