<script setup>
import { ref, computed } from 'vue'
import { Plus, Flame, LayoutGrid } from '@lucide/vue'

const props = defineProps({
  frequentProducts: {
    type: Array,
    default: () => []
  },
  allProducts: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => []
  },
  cartItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selectProduct'])

const activeTab = ref('Terlaris')

// Peta cepat jumlah barang yang sedang ada di keranjang
const cartQtyMap = computed(() => {
  const map = {}
  props.cartItems.forEach(item => {
    map[item.id] = (map[item.id] || 0) + item.qty
  })
  return map
})

// Kategori aktif yang benar-benar memiliki barang (beserta jumlahnya)
const activeCategories = computed(() => {
  const counts = {}
  props.allProducts.forEach(p => {
    const cat = p.category?.trim()
    if (cat) counts[cat] = (counts[cat] || 0) + 1
  })
  return props.categories
    .filter(cat => counts[cat] > 0)
    .map(cat => ({ name: cat, count: counts[cat] }))
})

const displayedProducts = computed(() => {
  if (activeTab.value === 'Terlaris') {
    return props.frequentProducts
  }
  if (activeTab.value === 'Semua') {
    return props.allProducts
  }
  return props.allProducts.filter(p => p.category?.trim() === activeTab.value)
})
</script>

<template>
  <section
    aria-label="Katalog Barang Cepat"
    class="products-pane-container w-full space-y-2.5 md:space-y-0 md:bg-white/80 md:backdrop-blur-md md:rounded-3xl md:border md:border-white/90 md:shadow-sm md:p-4 lg:p-5 md:h-full md:flex md:flex-col md:min-h-0"
  >
    <!-- Slot Pencarian & Scan Inline (Khusus Tablet & Desktop) -->
    <div v-if="$slots.search" class="hidden md:block shrink-0 mb-3">
      <slot name="search" />
    </div>

    <!-- Mobile Header: Ringkas dengan tombol pintas Semua Barang -->
    <div class="px-1 flex items-center justify-between gap-2 md:hidden">
      <h2 class="text-xs font-bold text-[#0a193d] uppercase tracking-wide">
        {{ activeTab === 'Terlaris' ? 'Barang Sering Terjual' : activeTab }}
      </h2>
      <button
        v-if="allProducts.length > frequentProducts.length"
        type="button"
        @click="activeTab = activeTab === 'Terlaris' ? 'Semua' : 'Terlaris'"
        class="text-[11px] font-semibold text-[#0284c7] hover:underline cursor-pointer"
      >
        {{ activeTab === 'Terlaris' ? `Lihat Semua (${allProducts.length})` : 'Tampilkan Terlaris' }}
      </button>
    </div>

    <!-- Tablet & Desktop Category Filter Pills -->
    <div class="hidden md:flex items-center justify-between gap-3 mb-3 shrink-0">
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0" role="tablist" aria-label="Kategori Barang">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'Terlaris'"
          @click="activeTab = 'Terlaris'"
          class="h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          :class="activeTab === 'Terlaris'
            ? 'bg-[#0a193d] text-white shadow-xs'
            : 'bg-white/90 hover:bg-white text-slate-600 border border-slate-200/70'"
        >
          <Flame aria-hidden="true" class="size-3.5" :class="activeTab === 'Terlaris' ? 'text-sky-400' : 'text-[#0284c7]'" />
          <span>Terlaris</span>
        </button>

        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'Semua'"
          @click="activeTab = 'Semua'"
          class="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          :class="activeTab === 'Semua'
            ? 'bg-[#0a193d] text-white shadow-xs'
            : 'bg-white/90 hover:bg-white text-slate-600 border border-slate-200/70'"
        >
          <LayoutGrid aria-hidden="true" class="size-3.5" />
          <span>Semua</span>
          <span class="text-[10px] opacity-75 tabular-nums">({{ allProducts.length }})</span>
        </button>

        <button
          v-for="cat in activeCategories"
          :key="cat.name"
          type="button"
          role="tab"
          :aria-selected="activeTab === cat.name"
          @click="activeTab = cat.name"
          class="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-all"
          :class="activeTab === cat.name
            ? 'bg-[#0a193d] text-white shadow-xs'
            : 'bg-white/90 hover:bg-white text-slate-600 border border-slate-200/70'"
        >
          <span>{{ cat.name }}</span>
          <span class="text-[10px] opacity-70 tabular-nums">({{ cat.count }})</span>
        </button>
      </div>
    </div>

    <!-- Grid Adaptif (Container Query: 2 col HP, 3 col Tablet, 4-5 col Desktop; Scrollable Internal di md+) -->
    <div class="kasiry-scroll-pane md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-0.5">
      <div class="frequent-products-grid gap-2 sm:gap-2.5">
        <button 
          v-for="(item, idx) in displayedProducts"
          :key="item.id"
          type="button"
          @click="emit('selectProduct', item)"
          class="relative min-h-[78px] md:min-h-[92px] p-2.5 sm:p-3 bg-white/95 hover:bg-white active:scale-96 text-left rounded-2xl border shadow-2xs hover:shadow-md flex flex-col justify-between cursor-pointer transition-all group"
          :class="[
            idx >= 16 ? 'offscreen-card-defer' : '',
            cartQtyMap[item.id] > 0
              ? 'border-[#0284c7]/60 ring-2 ring-sky-400/20 bg-sky-50/40'
              : 'border-slate-200/60 hover:border-sky-300'
          ]"
        >
          <!-- Badge Kuantitas Aktif di Struk -->
          <span
            v-if="cartQtyMap[item.id] > 0"
            class="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#0a193d] text-white text-[10px] font-bold shadow-xs tabular-nums leading-none"
          >
            {{ cartQtyMap[item.id] }}×
          </span>

          <div class="min-w-0 pr-2">
            <span v-if="item.category" class="hidden md:block text-[10px] font-semibold text-slate-400 truncate mb-0.5">
              {{ item.category }}
            </span>
            <p class="font-semibold text-[#0a193d] text-xs sm:text-[13px] leading-snug line-clamp-2 group-hover:text-sky-800 transition-colors">
              {{ item.name }}
            </p>
          </div>

          <div class="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-slate-100/90">
            <p class="font-bold text-[#0284c7] text-xs sm:text-sm tabular-nums truncate">
              Rp {{ item.sellPrice.toLocaleString('id-ID') }}
            </p>
            <div class="size-6 sm:size-6 rounded-lg bg-sky-50 group-hover:bg-[#0a193d] text-sky-700 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
              <Plus aria-hidden="true" class="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>
