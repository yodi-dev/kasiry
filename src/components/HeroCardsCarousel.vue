<script setup>
import { Plus, CreditCard, Wallet, TrendingUp, BookOpen } from '@lucide/vue'

const props = defineProps({
  todaySales: {
    type: Number,
    default: 1485000
  },
  todayProfit: {
    type: Number,
    default: 285000
  },
  totalDebt: {
    type: Number,
    default: 252000
  },
  transactionCount: {
    type: Number,
    default: 42
  }
})

const emit = defineEmits(['openAddProduct', 'openDailyReport', 'openDebtBook'])
</script>

<template>
  <div class="w-full flex items-center gap-3 overflow-x-auto no-scrollbar py-2 px-1">
    <!-- Left Dark Squircle [+] Button (matches reference left) -->
    <button 
      @click="emit('openAddProduct')"
      class="w-13 sm:w-15 h-38 sm:h-42 rounded-[24px] sm:rounded-[28px] bg-[#0a193d] hover:bg-[#0d2149] text-white flex flex-col items-center justify-center gap-1.5 shrink-0 shadow-md shadow-sky-950/20 active:scale-95 cursor-pointer transition-all border border-sky-900/40"
      title="Tambah Barang Baru"
    >
      <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <Plus class="w-5 h-5 text-sky-400 stroke-[3]" />
      </div>
      <span class="text-[10px] font-bold text-sky-200 uppercase tracking-tighter">Tambah</span>
    </button>

    <!-- Card 1: Main Vibrant Azure Card (Matches Visa card in reference) -->
    <div 
      @click="emit('openDailyReport')"
      class="w-56 sm:w-64 h-38 sm:h-42 rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0b4d82] text-white p-4.5 flex flex-col justify-between shrink-0 shadow-lg shadow-sky-600/25 relative overflow-hidden cursor-pointer hover:shadow-xl transition-all"
    >
      <!-- Background Abstract Contour Lines (Matches reference visual) -->
      <svg class="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 300 180" fill="none">
        <circle cx="210" cy="90" r="85" stroke="white" stroke-width="1.5" />
        <circle cx="160" cy="110" r="110" stroke="white" stroke-width="1.2" />
        <path d="M-20,140 Q70,40 170,100 T320,60" stroke="white" stroke-width="2" />
      </svg>

      <!-- Top Card Header -->
      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-1.5">
          <div class="w-7 h-5 rounded bg-white/20 border border-white/40 flex items-center justify-center">
            <span class="w-3 h-2 rounded-xs bg-white/80"></span>
          </div>
          <span class="text-xs font-bold text-white/90 tracking-wide uppercase">Kas Masuk</span>
        </div>
        <span class="text-[11px] font-mono font-medium text-sky-200 bg-white/10 px-2 py-0.5 rounded-full">
          {{ transactionCount }} Struk
        </span>
      </div>

      <!-- Bottom Card Values -->
      <div class="relative z-10">
        <span class="text-[11px] text-sky-200 block font-medium">Total Uang Penjualan:</span>
        <p class="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
          Rp {{ todaySales.toLocaleString('id-ID') }}
        </p>
        <div class="flex items-center justify-between mt-1 text-[11px] text-sky-200 font-medium">
          <span>Habiba Store</span>
          <span>Hari ini</span>
        </div>
      </div>
    </div>

    <!-- Card 2: Sky Blue Card (Buku Utang / Bon) -->
    <div 
      @click="emit('openDebtBook')"
      class="w-52 sm:w-60 h-38 sm:h-42 rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white p-4.5 flex flex-col justify-between shrink-0 shadow-md shadow-sky-500/20 relative overflow-hidden cursor-pointer hover:shadow-lg transition-all"
    >
      <svg class="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 300 180" fill="none">
        <circle cx="80" cy="40" r="90" stroke="white" stroke-width="1.5" />
      </svg>

      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-1.5">
          <BookOpen class="w-4 h-4 text-white" />
          <span class="text-xs font-bold tracking-wide uppercase">Buku Utang</span>
        </div>
        <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
      </div>

      <div class="relative z-10">
        <span class="text-[11px] text-sky-100 block font-medium">Total Bon Belum Lunas:</span>
        <p class="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
          Rp {{ totalDebt.toLocaleString('id-ID') }}
        </p>
        <p class="text-[11px] text-sky-100 font-medium mt-1">
          Tetangga / Langganan
        </p>
      </div>
    </div>

    <!-- Card 3: Deep Royal Navy Card (Untung Bersih) -->
    <div 
      @click="emit('openDailyReport')"
      class="w-52 sm:w-60 h-38 sm:h-42 rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#0a193d] via-[#102b66] to-[#0e214d] text-white p-4.5 flex flex-col justify-between shrink-0 shadow-md shadow-sky-950/20 relative overflow-hidden cursor-pointer hover:shadow-lg transition-all"
    >
      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-1.5">
          <TrendingUp class="w-4 h-4 text-emerald-400" />
          <span class="text-xs font-bold tracking-wide uppercase text-slate-300">Untung Bersih</span>
        </div>
        <span class="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
          Laba
        </span>
      </div>

      <div class="relative z-10">
        <span class="text-[11px] text-slate-400 block font-medium">Estimasi Keuntungan:</span>
        <p class="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight mt-0.5">
          Rp {{ todayProfit.toLocaleString('id-ID') }}
        </p>
        <p class="text-[11px] text-slate-400 font-medium mt-1">
          Selisih Harga Modal
        </p>
      </div>
    </div>
  </div>
</template>
