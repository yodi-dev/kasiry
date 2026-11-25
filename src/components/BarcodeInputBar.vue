<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Search, Camera, X, PlusCircle } from '@lucide/vue'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  modalOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:searchQuery', 
  'selectProduct', 
  'openCamera', 
  'triggerLazyInventory'
])

const inputRef = ref(null)
const isFocused = ref(false)

const focusInput = () => {
  if (props.modalOpen) return
  nextTick(() => {
    if (props.modalOpen) return
    if (inputRef.value) {
      const activeEl = document.activeElement
      const isOtherInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== inputRef.value
      if (!isOtherInput) {
        inputRef.value.focus({ preventScroll: true })
        isFocused.value = true
      }
    }
  })
}

// Global keydown: jika kasir mulai mengetik karakter atau barcode scanner nembak,
// langsung arahkan fokus ke input barcode secara otomatis (kecuali jika ada modal terbuka)
const handleGlobalKeyDown = (e) => {
  if (props.modalOpen) return
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) return
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    focusInput()
  }
}

// Autofocus tangguh saat komponen dimuat & saat tab aktif
onMounted(() => {
  focusInput()
  setTimeout(focusInput, 50)
  setTimeout(focusInput, 200)
  setTimeout(focusInput, 500)
  window.addEventListener('focus', focusInput)
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('focus', focusInput)
  window.removeEventListener('keydown', handleGlobalKeyDown)
})

defineExpose({
  focusInput
})

const handleInput = (e) => {
  emit('update:searchQuery', e.target.value)
}

const clearInput = () => {
  emit('update:searchQuery', '')
  focusInput()
}

const onSelect = (product) => {
  emit('selectProduct', product)
  clearInput()
}

const onTriggerUnknown = () => {
  const code = props.searchQuery.trim() || '8999999888123'
  emit('triggerLazyInventory', code)
  emit('update:searchQuery', '')
}

const handleEnter = () => {
  if (props.searchResults && props.searchResults.length > 0) {
    onSelect(props.searchResults[0])
  } else if (props.searchQuery.trim().length > 0) {
    onTriggerUnknown()
  }
}
</script>

<template>
  <div class="relative w-full">
    <!-- Form Input Barcode & Search (Floating Glassmorphism Pill tepat di atas Keranjang) -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <div 
          class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors"
          :class="isFocused ? 'text-sky-600' : 'text-slate-400'"
        >
          <Search class="w-4 h-4" />
        </div>

        <input
          ref="inputRef"
          type="text"
          autofocus
          :value="searchQuery"
          @input="handleInput"
          @keydown.enter="handleEnter"
          @focus="isFocused = true"
          @blur="isFocused = false"
          placeholder="Cari nama barang atau scan barcode..."
          class="w-full h-11 sm:h-12 pl-10 pr-9 text-sm font-medium bg-white/95 backdrop-blur-md text-[#0a193d] placeholder:text-slate-400 rounded-2xl border-2 transition-all shadow-md outline-none"
          :class="isFocused ? 'border-sky-500 ring-4 ring-sky-500/20 bg-white' : 'border-slate-200/80 hover:border-slate-300'"
        />

        <button 
          v-if="searchQuery"
          @click="clearInput"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tombol Scan Barcode Kamera -->
      <button 
        @click="emit('openCamera')"
        class="h-11 sm:h-12 px-3 sm:px-3.5 bg-[#0a193d] hover:bg-[#102b66] text-white rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 shrink-0 shadow-sm"
        title="Buka Kamera Barcode"
      >
        <Camera class="w-4 h-4 text-sky-400" />
        <span class="hidden sm:inline text-xs font-semibold">Scan</span>
      </button>
    </div>

    <!-- Dropdown Hasil Pencarian Dinamis (Membuka ke Atas karena Posisi Input Sticky di Bawah) -->
    <div 
      v-if="searchQuery.trim().length > 0"
      class="absolute left-0 right-0 bottom-full mb-2.5 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
    >
      <div 
        v-for="product in searchResults" 
        :key="product.id"
        @click="onSelect(product)"
        class="p-2.5 px-3 hover:bg-sky-50/60 flex items-center justify-between cursor-pointer transition-colors"
      >
        <div class="min-w-0 pr-2">
          <p class="font-semibold text-[#0a193d] text-sm leading-snug truncate">{{ product.name }}</p>
          <p v-if="product.barcode" class="text-[11px] text-slate-400 font-mono mt-0.5">
            {{ product.barcode }}
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-bold text-sky-700 text-sm">Rp {{ product.sellPrice.toLocaleString('id-ID') }}</p>
        </div>
      </div>

      <div class="p-2.5 px-3 bg-slate-50 flex items-center justify-between gap-2">
        <span class="text-xs text-slate-500">Barang belum ada?</span>
        <button 
          @click="onTriggerUnknown"
          class="h-7 px-2.5 bg-[#0a193d] hover:bg-[#102b66] text-white font-medium text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
          <PlusCircle class="w-3.5 h-3.5 text-sky-400" />
          <span>Tambah Baru</span>
        </button>
      </div>
    </div>
  </div>
</template>
