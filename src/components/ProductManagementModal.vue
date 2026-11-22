<script setup>
import { ref, computed } from 'vue'
import { X, Plus, Search, Edit2, Trash2, Check, Package } from '@lucide/vue'

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

const categories = ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.products
  return props.products.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.barcode && p.barcode.includes(q))
  )
})

const openAddForm = () => {
  currentProduct.value = {
    id: null,
    name: '',
    sellPrice: '',
    buyPrice: '',
    barcode: '',
    category: 'Sembako',
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
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60">
            <Package class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Kelola Barang</h3>
            <p class="text-xs text-slate-500 font-medium">Daftar barang warung ({{ products.length }} produk)</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Action & Search Bar (Hanya tampil jika tidak sedang membuka form edit) -->
      <div v-if="!isEditing" class="p-4 border-b border-slate-100 flex items-center gap-2.5 shrink-0 bg-slate-50/50">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Cari nama atau barcode..."
            class="w-full h-10 pl-9 pr-3 text-sm font-normal bg-white border border-slate-200 rounded-xl focus:border-emerald-700 outline-hidden"
          />
        </div>
        <button 
          @click="openAddForm"
          class="h-10 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Barang</span>
        </button>
      </div>

      <!-- VIEW 1: Form Tambah / Edit Barang -->
      <div v-if="isEditing" class="p-5 flex-1 overflow-y-auto space-y-3.5">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 class="font-semibold text-slate-900 text-sm">
            {{ currentProduct.id ? 'Edit Barang' : 'Tambah Barang Baru' }}
          </h4>
          <button 
            @click="isEditing = false"
            class="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
          >
            Kembali ke Daftar
          </button>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">Nama Barang:</label>
          <input 
            type="text" 
            v-model="currentProduct.name"
            placeholder="Contoh: Beras Ramos 5 Kg"
            class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-sm font-medium text-slate-900 outline-hidden"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Harga Jual (Rp):</label>
            <input 
              type="number" 
              v-model="currentProduct.sellPrice"
              placeholder="15000"
              class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-sm font-semibold text-emerald-800 text-right outline-hidden"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Harga Modal (Rp):</label>
            <input 
              type="number" 
              v-model="currentProduct.buyPrice"
              placeholder="12000"
              class="w-full h-10 px-3 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm font-normal text-slate-700 text-right outline-hidden"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Kode Barcode (Opsional):</label>
            <input 
              type="text" 
              v-model="currentProduct.barcode"
              placeholder="Scan atau ketik kode..."
              class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-xs font-mono text-slate-900 outline-hidden"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Kategori:</label>
            <select 
              v-model="currentProduct.category"
              class="w-full h-10 px-2.5 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-xs font-medium text-slate-900 outline-hidden"
            >
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="pt-1">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="currentProduct.isMacro"
              class="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-700"
            />
            <span class="text-xs font-medium text-slate-700">Tampilkan di tombol cepat depan</span>
          </label>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button 
            @click="isEditing = false"
            class="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 cursor-pointer"
          >
            Batal
          </button>
          <button 
            @click="handleSave"
            class="h-9 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Simpan Barang</span>
          </button>
        </div>
      </div>

      <!-- VIEW 2: Tabel Daftar Barang -->
      <div v-else class="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3">
        <div 
          v-if="filteredProducts.length === 0" 
          class="h-40 flex items-center justify-center text-center text-xs text-slate-400"
        >
          Tidak ada barang yang cocok.
        </div>

        <div 
          v-for="p in filteredProducts" 
          :key="p.id"
          class="p-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl transition-colors"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="font-medium text-slate-900 text-sm truncate">{{ p.name }}</p>
              <span v-if="p.isMacro" class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                Cepat
              </span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-normal">
              <span class="font-semibold text-emerald-800">Rp {{ p.sellPrice.toLocaleString('id-ID') }}</span>
              <span v-if="p.buyPrice" class="text-slate-400">Modal: Rp {{ p.buyPrice.toLocaleString('id-ID') }}</span>
              <span v-if="p.barcode" class="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                {{ p.barcode }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button 
              @click="openEditForm(p)"
              class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              title="Edit Barang"
            >
              <Edit2 class="w-3.5 h-3.5" />
            </button>
            <button 
              @click="handleDelete(p.id, p.name)"
              class="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center cursor-pointer transition-colors"
              title="Hapus Barang"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="!isEditing" class="p-3 bg-slate-50/70 border-t border-slate-200 flex justify-end shrink-0">
        <button 
          @click="emit('close')"
          class="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 cursor-pointer text-xs"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
