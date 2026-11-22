<script setup>
import { Camera, BookOpen, BarChart3, Package, MoreHorizontal } from '@lucide/vue'

const props = defineProps({
  totalDebtCount: {
    type: Number,
    default: 4
  }
})

const emit = defineEmits([
  'openCamera', 
  'openDebtBook', 
  'openDailyReport', 
  'openProductManage'
])
</script>

<template>
  <div class="w-full py-1">
    <!-- Header: Activities with ... (matches reference) -->
    <div class="flex items-center justify-between px-1 mb-3">
      <h2 class="text-sm sm:text-base font-bold text-[#0a193d]">
        Menu Cepat
      </h2>
      <button 
        @click="emit('openProductManage')" 
        class="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
        title="Lihat Semua Menu"
      >
        <MoreHorizontal class="w-5 h-5" />
      </button>
    </div>

    <!-- Row of 4 Dark Navy Squircles (matches reference style) -->
    <div class="grid grid-cols-4 gap-3">
      <!-- 1. Scan Barcode Kamera -->
      <button 
        @click="emit('openCamera')"
        class="flex flex-col items-center group cursor-pointer"
      >
        <div class="w-13 h-13 sm:w-15 sm:h-15 rounded-[22px] bg-[#0a193d] group-hover:bg-[#102b66] text-white flex items-center justify-center shadow-md shadow-sky-950/15 group-active:scale-95 transition-all">
          <Camera class="w-6 h-6 text-sky-400" />
        </div>
        <span class="text-xs font-semibold text-[#0a193d] mt-2 group-hover:text-sky-700 transition-colors">
          Scan
        </span>
      </button>

      <!-- 2. Buku Utang / Bon -->
      <button 
        @click="emit('openDebtBook')"
        class="flex flex-col items-center group cursor-pointer relative"
      >
        <div class="w-13 h-13 sm:w-15 sm:h-15 rounded-[22px] bg-[#0a193d] group-hover:bg-[#102b66] text-white flex items-center justify-center shadow-md shadow-sky-950/15 group-active:scale-95 transition-all relative">
          <BookOpen class="w-6 h-6 text-sky-400" />
          <span 
            v-if="totalDebtCount > 0" 
            class="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs"
          >
            {{ totalDebtCount }}
          </span>
        </div>
        <span class="text-xs font-semibold text-[#0a193d] mt-2 group-hover:text-sky-700 transition-colors">
          Utang
        </span>
      </button>

      <!-- 3. Laporan Kasir -->
      <button 
        @click="emit('openDailyReport')"
        class="flex flex-col items-center group cursor-pointer"
      >
        <div class="w-13 h-13 sm:w-15 sm:h-15 rounded-[22px] bg-[#0a193d] group-hover:bg-[#102b66] text-white flex items-center justify-center shadow-md shadow-sky-950/15 group-active:scale-95 transition-all">
          <BarChart3 class="w-6 h-6 text-sky-400" />
        </div>
        <span class="text-xs font-semibold text-[#0a193d] mt-2 group-hover:text-sky-700 transition-colors">
          Laporan
        </span>
      </button>

      <!-- 4. Kelola Barang -->
      <button 
        @click="emit('openProductManage')"
        class="flex flex-col items-center group cursor-pointer"
      >
        <div class="w-13 h-13 sm:w-15 sm:h-15 rounded-[22px] bg-[#0a193d] group-hover:bg-[#102b66] text-white flex items-center justify-center shadow-md shadow-sky-950/15 group-active:scale-95 transition-all">
          <Package class="w-6 h-6 text-sky-400" />
        </div>
        <span class="text-xs font-semibold text-[#0a193d] mt-2 group-hover:text-sky-700 transition-colors">
          Barang
        </span>
      </button>
    </div>
  </div>
</template>
