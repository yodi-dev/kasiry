<script setup>
import { ref, watch } from 'vue'
import { X, Plus, Barcode } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  scannedBarcode: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'saveAndAddToCart'])

const productName = ref('')
const sellPrice = ref('')
const buyPrice = ref('')
const category = ref('Makanan')

const categories = ['Makanan', 'Minuman', 'Sembako', 'Kebersihan', 'Rokok', 'Lainnya']

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    productName.value = ''
    sellPrice.value = ''
    buyPrice.value = ''
    category.value = 'Makanan'
  }
})

const handleSave = () => {
  const sell = parseInt(sellPrice.value.replace(/\D/g, '') || '0', 10)
  const buy = parseInt(buyPrice.value.replace(/\D/g, '') || '0', 10)
  if (!productName.value.trim() || sell <= 0) return

  emit('saveAndAddToCart', {
    id: Date.now(),
    barcode: props.scannedBarcode,
    name: productName.value.trim(),
    sellPrice: sell,
    buyPrice: buy > 0 ? buy : Math.round(sell * 0.8),
    isMacro: false,
    category: category.value
  })
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
      <!-- Header (Bersih) -->
      <div class="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-900 leading-tight">Barang Belum Terdaftar</h3>
          <p class="text-xs text-slate-500 font-normal">Input cepat sambil jualan (Lazy Inventory)</p>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Kode Barcode Info -->
      <div class="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Barcode class="w-4 h-4 text-slate-500" />
        <span class="text-xs font-mono font-medium text-slate-700">Kode: {{ scannedBarcode || '8999999888123' }}</span>
      </div>

      <!-- Form Kilat -->
      <form @submit.prevent="handleSave" class="p-5 space-y-3">
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Nama Barang:
          </label>
          <input 
            type="text" 
            v-model="productName"
            placeholder="Contoh: Biskuit Regal 250g"
            required
            class="w-full h-11 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-sm font-medium text-slate-900 outline-hidden"
            autofocus
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Harga Jual (Rp):
            </label>
            <input 
              type="number" 
              v-model="sellPrice"
              placeholder="12000"
              required
              class="w-full h-11 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-sm font-semibold text-emerald-800 text-right outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">
              Harga Modal (Opsional):
            </label>
            <input 
              type="number" 
              v-model="buyPrice"
              placeholder="10000"
              class="w-full h-11 px-3 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm font-normal text-slate-700 text-right outline-hidden"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Kategori:
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button 
              type="button"
              v-for="cat in categories" 
              :key="cat"
              @click="category = cat"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors',
                category === cat 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              ]"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button 
            type="button"
            @click="emit('close')"
            class="h-10 px-3 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 cursor-pointer"
          >
            Batal
          </button>
          <button 
            type="submit"
            class="h-10 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Plus class="w-3.5 h-3.5" />
            Simpan & Masuk Keranjang
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
