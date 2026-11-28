<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, Plus, Barcode, Check } from '@lucide/vue'
import { sanitizeOptionalPrice, sanitizeMinQty } from '../utils/pricing'
import { isLikelyBarcode } from '../utils/barcode'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  scannedBarcode: {
    type: String,
    default: ''
  },
  initialName: {
    type: String,
    default: ''
  },
  categories: {
    type: Array,
    default: () => ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']
  }
})

const emit = defineEmits(['close', 'saveAndAddToCart', 'addCategory'])

const defaultCategories = ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']

const nameInputRef = ref(null)
const newCategoryInputRef = ref(null)
const productName = ref('')
const barcodeValue = ref('')
const sellPrice = ref('')
const buyPrice = ref('')
const wholesalePrice = ref('')
const wholesaleMinQty = ref('')
const agentPrice = ref('')
const showMultiPrice = ref(false)
const category = ref('Makanan')
const isAddingCategoryInline = ref(false)
const newCategoryInput = ref('')

const availableCategories = computed(() => {
  if (props.categories && props.categories.length > 0) {
    return props.categories
  }
  return defaultCategories
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    const cleanInitialName = String(props.initialName || '').trim()
    const cleanScanned = String(props.scannedBarcode || '').trim()
    const scannedIsCode = cleanScanned ? isLikelyBarcode(cleanScanned) : false

    productName.value = cleanInitialName || (!scannedIsCode && cleanScanned ? cleanScanned : '')
    barcodeValue.value = cleanInitialName ? '' : (scannedIsCode ? cleanScanned : '')
    sellPrice.value = ''
    buyPrice.value = ''
    wholesalePrice.value = ''
    wholesaleMinQty.value = ''
    agentPrice.value = ''
    showMultiPrice.value = false
    isAddingCategoryInline.value = false
    newCategoryInput.value = ''
    category.value = availableCategories.value.includes('Makanan')
      ? 'Makanan'
      : (availableCategories.value[0] || 'Lainnya')
    nextTick(() => {
      nameInputRef.value?.focus()
    })
  }
}, { immediate: true })

const openInlineCategory = () => {
  isAddingCategoryInline.value = true
  nextTick(() => {
    newCategoryInputRef.value?.focus()
  })
}

const handleCreateCategory = () => {
  const trimmed = newCategoryInput.value.trim()
  if (!trimmed) return

  const existing = availableCategories.value.find(
    c => c.toLowerCase() === trimmed.toLowerCase()
  )
  if (existing) {
    category.value = existing
  } else {
    emit('addCategory', trimmed)
    category.value = trimmed
  }

  newCategoryInput.value = ''
  isAddingCategoryInline.value = false
}

const handleCategoryEnter = (e) => {
  if (e?.isComposing || e?.keyCode === 229) return
  e?.preventDefault()
  handleCreateCategory()
}

const handleSave = () => {
  const sell = parseInt(String(sellPrice.value ?? '').replace(/\D/g, '') || '0', 10)
  const buy = parseInt(String(buyPrice.value ?? '').replace(/\D/g, '') || '0', 10)
  if (!productName.value.trim() || sell <= 0) return

  emit('saveAndAddToCart', {
    barcode: barcodeValue.value.trim(),
    name: productName.value.trim(),
    sellPrice: sell,
    buyPrice: buy > 0 ? buy : Math.round(sell * 0.8),
    wholesalePrice: sanitizeOptionalPrice(wholesalePrice.value),
    wholesaleMinQty: sanitizeMinQty(wholesaleMinQty.value),
    agentPrice: sanitizeOptionalPrice(agentPrice.value),
    isMacro: false,
    category: category.value
  })
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
      <!-- Header (Design System: Deep Navy) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="text-base font-bold text-[#0a193d] leading-tight">Barang Belum Terdaftar</h3>
        <button 
          type="button"
          @click="emit('close')"
          aria-label="Tutup modal"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X aria-hidden="true" class="w-4 h-4" />
        </button>
      </div>

      <!-- Kode Barcode Info -->
      <div class="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Barcode aria-hidden="true" class="w-4 h-4 text-slate-500 shrink-0" />
        <span v-if="barcodeValue" class="text-xs font-mono font-medium text-slate-700">Kode: {{ barcodeValue }}</span>
        <span v-else class="text-xs font-medium text-slate-500">Tanpa barcode (opsional) • Nama otomatis terisi</span>
      </div>

      <!-- Form Kilat -->
      <form @submit.prevent="handleSave" class="p-5 space-y-3.5">
        <div>
          <label for="lazy-product-name" class="block text-xs font-medium text-slate-700 mb-1">
            Nama Barang:
          </label>
          <input 
            id="lazy-product-name"
            ref="nameInputRef"
            type="text" 
            v-model="productName"
            placeholder="Contoh: Biskuit Regal 250g"
            class="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-xl text-base sm:text-sm font-medium text-[#0a193d] outline-hidden transition-all"
          />
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label for="lazy-sell-price" class="block text-xs font-semibold text-[#0a193d] mb-1">
              Harga Jual (Rp):
            </label>
            <input 
              id="lazy-sell-price"
              type="number" 
              inputmode="numeric"
              min="1"
              v-model="sellPrice"
              placeholder="12000"
              class="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-xl text-base sm:text-sm font-bold text-sky-800 text-right tabular-nums outline-hidden transition-all"
            />
          </div>

          <div>
            <label for="lazy-buy-price" class="block text-xs font-semibold text-slate-500 mb-1">
              Harga Modal (Opsional):
            </label>
            <input 
              id="lazy-buy-price"
              type="number" 
              inputmode="numeric"
              v-model="buyPrice"
              placeholder="10000"
              class="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-xl text-base sm:text-sm font-medium text-slate-700 text-right tabular-nums outline-hidden transition-all"
            />
          </div>
        </div>

        <!-- Opsi Lipat Multi Harga Grosir/Agen -->
        <div>
          <button
            type="button"
            @click="showMultiPrice = !showMultiPrice"
            class="text-[11px] font-bold text-[#0284c7] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus aria-hidden="true" class="w-3 h-3" />
            <span>{{ showMultiPrice ? 'Tutup Harga Grosir / Agen' : 'Atur Harga Grosir / Agen (Opsional)' }}</span>
          </button>

          <div
            v-if="showMultiPrice"
            class="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-3 gap-2"
          >
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Harga Grosir</label>
              <input
                type="number"
                inputmode="numeric"
                v-model="wholesalePrice"
                placeholder="Rp"
                class="w-full h-9 px-2.5 bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-bold text-amber-800 text-right font-mono outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Min. Qty</label>
              <input
                type="number"
                inputmode="numeric"
                min="2"
                v-model="wholesaleMinQty"
                placeholder="5"
                class="w-full h-9 px-2.5 bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-semibold text-[#0a193d] text-right font-mono outline-hidden"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Harga Agen</label>
              <input
                type="number"
                inputmode="numeric"
                v-model="agentPrice"
                placeholder="Rp"
                class="w-full h-9 px-2.5 bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-bold text-[#0284c7] text-right font-mono outline-hidden"
              />
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <label class="block text-xs font-semibold text-[#0a193d]">
              Kategori:
            </label>
            <button
              v-if="!isAddingCategoryInline"
              type="button"
              @click="openInlineCategory"
              class="text-[11px] font-bold text-[#0284c7] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus aria-hidden="true" class="w-3 h-3" /> Tambah Kategori
            </button>
          </div>

          <!-- Input Inline Tambah Kategori -->
          <div
            v-if="isAddingCategoryInline"
            class="flex items-center gap-2 mb-2 p-2 bg-sky-50/80 border border-sky-100 rounded-xl animate-in fade-in duration-150"
          >
            <input
              ref="newCategoryInputRef"
              type="text"
              v-model="newCategoryInput"
              @keydown.enter="handleCategoryEnter"
              @keydown.esc.stop="isAddingCategoryInline = false; newCategoryInput = ''"
              placeholder="Ketik nama kategori baru..."
              aria-label="Nama kategori baru"
              class="flex-1 min-w-0 h-9 px-3 bg-white border border-slate-200 focus:border-[#0284c7] rounded-lg text-base sm:text-xs font-semibold text-[#0a193d] outline-hidden shadow-2xs"
            />
            <button
              type="button"
              @click="handleCreateCategory"
              :disabled="!newCategoryInput.trim()"
              class="h-9 px-3 bg-[#0a193d] hover:bg-[#102b66] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-all shrink-0"
            >
              <Check aria-hidden="true" class="w-3.5 h-3.5 text-sky-400" />
              <span>Simpan</span>
            </button>
            <button
              type="button"
              @click="isAddingCategoryInline = false; newCategoryInput = ''"
              class="h-9 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors shrink-0"
            >
              Batal
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
            <button 
              type="button"
              v-for="cat in availableCategories" 
              :key="cat"
              @click="category = cat"
              :aria-pressed="category === cat"
              :class="[
                'px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors',
                category === cat 
                  ? 'bg-[#0a193d] text-white font-semibold shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              ]"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          <button 
            type="button"
            @click="emit('close')"
            class="h-10 px-4 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button 
            type="submit"
            :disabled="!productName.trim() || Number(String(sellPrice ?? '').replace(/\D/g, '') || 0) <= 0"
            class="h-10 px-5 bg-[#0a193d] hover:bg-[#102b66] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus aria-hidden="true" class="w-3.5 h-3.5" />
            Simpan &amp; Masuk Keranjang
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
