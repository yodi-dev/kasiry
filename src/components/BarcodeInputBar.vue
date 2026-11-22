<script setup>
import { ref } from 'vue'
import { Search, Camera, X, PlusCircle } from '@lucide/vue'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  searchResults: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:searchQuery', 
  'selectProduct', 
  'openCamera', 
  'triggerLazyInventory'
])

const inputRef = ref(null)

const handleInput = (e) => {
  emit('update:searchQuery', e.target.value)
}

const clearInput = () => {
  emit('update:searchQuery', '')
  if (inputRef.value) inputRef.value.focus()
}

const onSelect = (product) => {
  emit('selectProduct', product)
  clearInput()
}

const onTriggerUnknown = () => {
  const code = props.searchQuery.trim() || '8999999888123'
  emit('triggerLazyInventory', code)
  clearInput()
}
</script>

<template>
  <div class="relative w-full">
    <!-- Form Input Barcode & Search (Floating Glassmorphism Pill) -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search class="w-4 h-4" />
        </div>

        <input
          ref="inputRef"
          type="text"
          :value="searchQuery"
          @input="handleInput"
          placeholder="Cari nama barang atau scan barcode..."
          class="w-full h-11 sm:h-12 pl-10 pr-9 text-sm font-medium bg-white/90 backdrop-blur-md text-[#0a193d] placeholder:text-slate-400 rounded-2xl border border-white/90 focus:border-sky-500 focus:bg-white shadow-xs outline-hidden transition-all"
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

    <!-- Dropdown Hasil Pencarian Dinamis -->
    <div 
      v-if="searchQuery.trim().length > 0"
      class="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
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
