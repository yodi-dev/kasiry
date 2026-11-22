<script setup>
import { ref } from 'vue'
import { Search, Plus, X, PlusCircle } from '@lucide/vue'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  products: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:searchQuery', 
  'selectProduct', 
  'triggerLazyInventory'
])

const handleInput = (e) => {
  emit('update:searchQuery', e.target.value)
}

const clearInput = () => {
  emit('update:searchQuery', '')
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
  <div class="w-full space-y-3">
    <!-- Search Bar (Soft Glassmorphism Card) -->
    <div class="relative w-full">
      <div class="relative flex-1">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search class="w-4 h-4" />
        </div>

        <input
          type="text"
          :value="searchQuery"
          @input="handleInput"
          placeholder="Cari nama barang atau scan barcode..."
          class="w-full h-12 pl-10 pr-9 text-sm font-medium bg-white/90 backdrop-blur-md text-[#0a193d] placeholder:text-slate-400 rounded-2xl border border-white/80 focus:border-sky-500 focus:bg-white shadow-xs outline-hidden transition-all"
        />

        <button 
          v-if="searchQuery"
          @click="clearInput"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Dropdown Filter Real-Time -->
      <div 
        v-if="searchQuery.trim().length > 0"
        class="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
      >
        <div 
          v-for="product in searchResults" 
          :key="product.id"
          @click="onSelect(product)"
          class="p-3 hover:bg-sky-50/60 flex items-center justify-between cursor-pointer transition-colors"
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

    <!-- Product Grid Header -->
    <div class="flex items-center justify-between px-1">
      <h3 class="text-sm sm:text-base font-bold text-[#0a193d]">
        Katalog Barang
      </h3>
      <span class="text-xs text-slate-500 font-medium">{{ products.length }} item</span>
    </div>

    <!-- Product Cards Grid (Soft Modern Cards) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      <div 
        v-for="item in products"
        :key="item.id"
        @click="emit('selectProduct', item)"
        class="min-h-[82px] p-3 bg-white/85 hover:bg-white active:scale-97 text-left rounded-2xl border border-white/90 hover:border-sky-300 shadow-sm hover:shadow-md flex flex-col justify-between cursor-pointer transition-all group"
      >
        <div>
          <p class="font-semibold text-[#0a193d] text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-sky-800 transition-colors">
            {{ item.name }}
          </p>
          <span v-if="item.category" class="text-[10px] text-slate-400 font-medium mt-0.5 block">
            {{ item.category }}
          </span>
        </div>

        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80">
          <p class="font-bold text-sky-700 text-xs sm:text-sm">
            Rp {{ item.sellPrice.toLocaleString('id-ID') }}
          </p>
          <div class="w-6 h-6 rounded-lg bg-sky-50 group-hover:bg-[#0a193d] text-sky-700 group-hover:text-white flex items-center justify-center transition-colors">
            <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
