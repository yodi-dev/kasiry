<script setup>
const props = defineProps({
  macroProducts: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selectProduct'])
</script>

<template>
  <div class="w-full space-y-2">
    <!-- Header Ringkas Tanpa Penjelasan Berlebih -->
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        Daftar Barang
      </h2>
    </div>

    <!-- Grid Produk Bersih (Tanpa Filter Kategori & Tanpa Ikon) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      <button 
        v-for="item in macroProducts"
        :key="item.id"
        @click="emit('selectProduct', item)"
        class="min-h-[68px] p-2.5 bg-white hover:bg-slate-50 active:scale-98 text-left rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs flex flex-col justify-between cursor-pointer transition-all"
      >
        <p class="font-medium text-slate-800 text-xs sm:text-sm leading-snug line-clamp-2">
          {{ item.name }}
        </p>

        <div class="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-100">
          <p class="font-semibold text-emerald-700 text-xs sm:text-sm">
            Rp {{ item.sellPrice.toLocaleString('id-ID') }}
          </p>
          <span v-if="item.category" class="text-[10px] text-slate-400 font-normal">
            {{ item.category }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
