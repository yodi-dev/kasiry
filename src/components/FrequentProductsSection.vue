<script setup>
import { Plus } from '@lucide/vue'

const props = defineProps({
  frequentProducts: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selectProduct'])
</script>

<template>
  <div class="w-full space-y-2.5">
    <!-- Header Bersih: Hanya "Barang Sering Terjual" -->
    <div class="px-1">
      <h2 class="text-xs sm:text-sm font-bold text-[#0a193d] uppercase tracking-wide">
        Barang Sering Terjual
      </h2>
    </div>

    <!-- Grid 6-8 Tombol Cepat -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <button 
        v-for="item in frequentProducts"
        :key="item.id"
        @click="emit('selectProduct', item)"
        class="min-h-[76px] p-2.5 sm:p-3 bg-white/90 hover:bg-white active:scale-95 text-left rounded-2xl border border-white/90 hover:border-sky-300 shadow-xs hover:shadow-sm flex flex-col justify-between cursor-pointer transition-all group"
      >
        <p class="font-semibold text-[#0a193d] text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-sky-800 transition-colors">
          {{ item.name }}
        </p>

        <div class="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100/80">
          <p class="font-bold text-sky-700 text-xs sm:text-sm">
            Rp {{ item.sellPrice.toLocaleString('id-ID') }}
          </p>
          <div class="w-5 h-5 rounded-lg bg-sky-50 group-hover:bg-[#0a193d] text-sky-700 group-hover:text-white flex items-center justify-center transition-colors">
            <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
