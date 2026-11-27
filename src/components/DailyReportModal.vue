<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  BarChart3, 
  MessageSquare, 
  Download, 
  TrendingUp, 
  ShoppingBag, 
  Receipt, 
  Clock, 
  Calendar,
  Wallet,
  Plus,
  Trash2,
  ArrowLeftRight,
  Zap
} from '@lucide/vue'
import { getExpenseCategoryMeta, getExpenseSourceMeta } from '../utils/expenseConstants'
import { recordBelongsToShift, formatShiftWhatsAppText } from '../utils/dailyStats'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  stats: {
    type: Object,
    default: () => ({
      todaySales: 1485000,
      todayProfit: 285000,
      transactionCount: 42,
      todayNewDebt: 60000,
      todayDebtPaid: 0,
      todayExpensesCash: 0,
      todayExpensesNonCash: 0,
      todayExpensesTotal: 0,
      todayOperationalExpenses: 0,
      todayPriveTotal: 0,
      topProducts: []
    })
  },
  transactions: {
    type: Array,
    default: () => []
  },
  expenses: {
    type: Array,
    default: () => []
  },
  shifts: {
    type: Array,
    default: () => []
  },
  activeShift: {
    type: Object,
    default: null
  },
  isActiveShiftStale: {
    type: Boolean,
    default: false
  },
  storeName: {
    type: String,
    default: 'Warung Kasiry'
  },
  isExporting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'close',
  'downloadExcel',
  'openExpense',
  'openCashService',
  'openDigitalProduct',
  'deleteExpense',
  'deleteTransaction',
  'openReceipt',
  'openShift'
])

// Active Tab: 'summary' | 'expenses' | 'history'
const activeTab = ref('summary')
const confirmingDeleteId = ref(null)
const confirmingDeleteTxId = ref(null)

watch(() => props.isOpen, (open) => {
  if (open) {
    confirmingDeleteId.value = null
    confirmingDeleteTxId.value = null
  }
}, { immediate: true })

const todayFormatted = computed(() => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())
})

// Daftar transaksi lingkup shift aktif (atau hari ini bila belum buka shift) diurutkan terbaru
const todayTransactions = computed(() => {
  if (!props.transactions || props.transactions.length === 0) return []
  if (props.activeShift && props.activeShift.status === 'OPEN') {
    return props.transactions
      .filter(t => t && !t.deleted && recordBelongsToShift(t, props.activeShift, 'createdAt'))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayTimestamp = startOfDay.getTime()

  return props.transactions
    .filter(t => t && !t.deleted && (t.createdAt || 0) >= todayTimestamp)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

// Daftar pengeluaran aktif lingkup shift aktif (atau hari ini) diurutkan terbaru
const todayExpenses = computed(() => {
  if (!props.expenses || props.expenses.length === 0) return []
  if (props.activeShift && props.activeShift.status === 'OPEN') {
    return props.expenses
      .filter(e => e && !e.deleted && recordBelongsToShift(e, props.activeShift, 'createdAt'))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayTimestamp = startOfDay.getTime()

  return props.expenses
    .filter(e => e && !e.deleted && (e.createdAt || 0) >= todayTimestamp)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const closedShifts = computed(() => {
  return (props.shifts || [])
    .filter(s => s && !s.deleted && s.status === 'CLOSED')
    .sort((a, b) => (b.closedAt || b.openedAt || 0) - (a.closedAt || a.openedAt || 0))
})

const formatDateTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const shareClosedShiftToWA = (shift) => {
  const text = formatShiftWhatsAppText(shift, props.storeName)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

const grossCashDrawer = computed(() => {
  const cashSales = props.stats.todayCashSales ?? props.stats.todaySales ?? 0
  const debtPaidCash = props.stats.todayDebtPaidCash ?? props.stats.todayDebtPaid ?? 0
  return props.stats.todayCashDrawer ?? (cashSales + debtPaidCash)
})

const netCashDrawer = computed(() => {
  if (props.stats.todayNetCashDrawer !== undefined) {
    return props.stats.todayNetCashDrawer
  }
  return grossCashDrawer.value - (props.stats.todayExpensesCash || 0)
})

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// Format pesan WhatsApp laporan harian
const generateWhatsAppText = () => {
  const cashSales = props.stats.todayCashSales ?? props.stats.todaySales ?? 0
  const qrisSales = props.stats.todayQrisSales ?? 0
  const debtPaidCash = props.stats.todayDebtPaidCash ?? props.stats.todayDebtPaid ?? 0
  const debtPaidQris = props.stats.todayDebtPaidQris ?? 0
  const cashDrawerTotal = props.stats.todayCashDrawer ?? (cashSales + debtPaidCash)
  const qrisTotal = props.stats.todayQrisTotal ?? (qrisSales + debtPaidQris)
  const totalCash = cashDrawerTotal + qrisTotal
  const expensesCash = props.stats.todayExpensesCash || 0
  const expensesNonCash = props.stats.todayExpensesNonCash || 0
  const expensesTotal = props.stats.todayExpensesTotal ?? (expensesCash + expensesNonCash)
  const cashServiceIn = props.stats.todayCashServiceIn || 0
  const cashServiceOut = props.stats.todayCashServiceOut || 0
  const cashServiceAdminProfit = props.stats.todayCashServiceAdminProfit || 0
  const digitalSales = props.stats.todayDigitalSales || 0
  const digitalProfit = props.stats.todayDigitalProfit || 0
  const priveTotal = props.stats.todayPriveTotal || 0

  let text = `*📊 LAPORAN KASIR ${props.storeName.toUpperCase()}*\n`
  text += `📅 Tanggal: ${todayFormatted.value}\n`
  if (props.stats.isShiftScoped) {
    const expDrawer = props.stats.expectedCashDrawer ?? ((props.stats.openingCash || 0) + netCashDrawer.value)
    text += `🕒 Shift: ${props.stats.shiftCode || '-'} (${props.stats.shiftCashierName || 'Kasir'})\n`
    text += `💼 Modal Awal Laci: Rp ${(props.stats.openingCash || 0).toLocaleString('id-ID')}\n`
    text += `🧮 Seharusnya di Laci (dg Modal): Rp ${expDrawer.toLocaleString('id-ID')}\n`
  }
  text += `--------------------------------\n`
  text += `💵 *Total Kas Masuk:* Rp ${totalCash.toLocaleString('id-ID')}\n`
  text += `   • Uang Tunai Masuk Laci: Rp ${cashDrawerTotal.toLocaleString('id-ID')}\n`
  if (qrisTotal > 0) {
    text += `   • QRIS (Non-Tunai): Rp ${qrisTotal.toLocaleString('id-ID')}\n`
  }
  if ((props.stats.todayDebtPaid || 0) > 0) {
    text += `   • Termasuk Pelunasan Bon: Rp ${props.stats.todayDebtPaid.toLocaleString('id-ID')}\n`
  }
  if (digitalSales > 0) {
    text += `⚡ *Pulsa & Token PLN:* Rp ${digitalSales.toLocaleString('id-ID')} (Laba +Rp ${digitalProfit.toLocaleString('id-ID')})\n`
  }
  if (cashServiceIn > 0 || cashServiceOut > 0) {
    text += `🏧 *Layanan Tarik Tunai & Transfer:*\n`
    if (cashServiceIn > 0) {
      text += `   • Transfer/Top-Up Masuk Laci: +Rp ${cashServiceIn.toLocaleString('id-ID')}\n`
    }
    if (cashServiceOut > 0) {
      text += `   • Tarik Tunai Keluar Laci: -Rp ${cashServiceOut.toLocaleString('id-ID')}\n`
    }
    if (cashServiceAdminProfit > 0) {
      text += `   • Jasa Admin Layanan: +Rp ${cashServiceAdminProfit.toLocaleString('id-ID')}\n`
    }
  }
  if (expensesTotal > 0) {
    text += `💸 *Total Kas Keluar:* Rp ${expensesTotal.toLocaleString('id-ID')}\n`
    if (expensesCash > 0) {
      text += `   • Keluar Dari Laci Tunai: Rp ${expensesCash.toLocaleString('id-ID')}\n`
    }
    if (expensesNonCash > 0) {
      text += `   • Keluar Non-Tunai: Rp ${expensesNonCash.toLocaleString('id-ID')}\n`
    }
    if (priveTotal > 0) {
      text += `   • Tarik / Setor Owner: Rp ${priveTotal.toLocaleString('id-ID')} (tidak kurangi untung)\n`
    }
  }
  const fundToLaci = props.stats.todayFundToLaci || 0
  const fundFromLaci = props.stats.todayFundFromLaci || 0
  if (fundToLaci > 0 || fundFromLaci > 0) {
    text += `🏦 *Mutasi Laci <-> Keuangan:*\n`
    if (fundToLaci > 0) {
      text += `   • Dana Masuk Laci: +Rp ${fundToLaci.toLocaleString('id-ID')}\n`
    }
    if (fundFromLaci > 0) {
      text += `   • Setor/Tabungan Dari Laci: -Rp ${fundFromLaci.toLocaleString('id-ID')}\n`
    }
  }
  if (expensesTotal > 0 || cashServiceIn > 0 || cashServiceOut > 0 || fundToLaci > 0 || fundFromLaci > 0) {
    text += `💰 *Sisa Tunai Fisik Laci:* Rp ${netCashDrawer.value.toLocaleString('id-ID')}\n`
  }
  text += `📈 *Perkiraan Untung Bersih:* Rp ${(props.stats.todayProfit || 0).toLocaleString('id-ID')}\n`
  text += `🧾 *Jumlah Transaksi:* ${props.stats.transactionCount || 0} struk\n`
  if (props.stats.todayNewDebt > 0) {
    text += `📋 *Bon/Utang Baru:* Rp ${props.stats.todayNewDebt.toLocaleString('id-ID')}\n`
  }
  text += `--------------------------------\n`
  text += `⭐ *Barang Paling Laris Hari Ini:*\n`
  if (props.stats.topProducts && props.stats.topProducts.length > 0) {
    props.stats.topProducts.forEach((p, idx) => {
      text += `${idx + 1}. ${p.name} (${p.qty}x) = Rp ${p.subtotal.toLocaleString('id-ID')}\n`
    })
  } else {
    text += `(Belum ada data barang terjual hari ini)\n`
  }
  text += `--------------------------------\n`
  text += `Dicatat otomatis via Kasiry by Awanbeo.`
  return text
}

const shareToWhatsApp = () => {
  const text = generateWhatsAppText()
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

const confirmDeleteExpense = (id) => {
  emit('deleteExpense', id)
  confirmingDeleteId.value = null
}

const confirmDeleteTransaction = (tx) => {
  emit('deleteTransaction', tx)
  confirmingDeleteTxId.value = null
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <BarChart3 class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              {{ activeShift ? 'Laporan Shift Kasir Aktif' : 'Laporan Penjualan Hari Ini' }}
            </h3>
            <p class="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <Calendar class="w-3.5 h-3.5 text-slate-400" />
              <span v-if="activeShift">
                {{ activeShift.shiftCode }} • {{ activeShift.cashierName }} • Buka {{ formatDateTime(activeShift.openedAt) }}
              </span>
              <span v-else>{{ todayFormatted }}</span>
            </p>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 2. Segmented Pill Tab Switcher -->
      <div class="px-5 pt-3.5 pb-1 shrink-0 bg-white border-b border-slate-100">
        <div class="p-1 bg-slate-100 rounded-2xl grid grid-cols-4 gap-1">
          <button 
            @click="activeTab = 'summary'"
            :class="[
              'h-10 px-1.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer transition-all',
              activeTab === 'summary' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <BarChart3 class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Ringkasan</span>
          </button>

          <button 
            @click="activeTab = 'expenses'"
            :class="[
              'h-10 px-1.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer transition-all',
              activeTab === 'expenses' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Wallet class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Kas Keluar ({{ todayExpenses.length }})</span>
          </button>

          <button 
            @click="activeTab = 'history'"
            :class="[
              'h-10 px-1.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer transition-all',
              activeTab === 'history' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Receipt class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Riwayat <span class="hidden sm:inline">Transaksi </span>({{ todayTransactions.length }})</span>
          </button>

          <button 
            @click="activeTab = 'shifts'"
            :class="[
              'h-10 px-1.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer transition-all',
              activeTab === 'shifts' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Clock class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Shift ({{ closedShifts.length }})</span>
          </button>
        </div>
      </div>

      <!-- 3. Modal Body Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        
        <!-- TAB 1: RINGKASAN KAS & STATISTIK -->
        <div v-if="activeTab === 'summary'" class="space-y-4">
          <!-- Strip Status Shift Aktif / Buka Tutup Shift -->
          <div
            :class="[
              'p-3.5 rounded-2xl border flex items-center justify-between gap-3',
              activeShift
                ? (isActiveShiftStale ? 'bg-amber-50/90 border-amber-300/80' : 'bg-sky-50/80 border-sky-200/80')
                : 'bg-slate-50 border-slate-200/80'
            ]"
          >
            <div class="min-w-0">
              <p class="text-xs font-bold text-[#0a193d] flex items-center gap-1.5">
                <Clock class="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                <span v-if="activeShift">
                  {{ isActiveShiftStale ? 'Shift Kemarin Masih Terbuka' : 'Shift Aktif Berjalan' }}
                  • Modal Awal: <span class="font-mono">Rp {{ (stats.openingCash || 0).toLocaleString('id-ID') }}</span>
                </span>
                <span v-else>Belum Buka Shift (Memakai Hitungan Hari Ini)</span>
              </p>
              <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
                <template v-if="activeShift">
                  Seharusnya di laci saat ini: <strong class="font-mono text-[#0a193d]">Rp {{ ((stats.expectedCashDrawer ?? ((stats.openingCash || 0) + netCashDrawer)) || 0).toLocaleString('id-ID') }}</strong>
                </template>
                <template v-else>
                  Buka shift untuk mengatur modal awal laci &amp; tutup buku harian.
                </template>
              </p>
            </div>
            <button
              type="button"
              @click="emit('openShift')"
              class="h-9 px-3 rounded-xl bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              {{ activeShift ? 'Tutup Shift' : 'Buka Shift' }}
            </button>
          </div>
          <!-- 4 Kartu Indikator Keuangan -->
          <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
            <!-- Total Uang Kas Masuk -->
            <div class="min-w-0 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Kas Masuk</span>
              <p class="text-xl sm:text-2xl font-bold font-mono text-[#0a193d] mt-1 leading-tight break-words">
                Rp {{ ((stats.todaySales || 0) + (stats.todayDebtPaid || 0) + (stats.todayDigitalSalesCash || 0) + (stats.todayDigitalSalesQris || 0)).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1 leading-snug break-words">
                <template v-if="(stats.todayExpensesCash || 0) > 0 || (stats.todayCashServiceIn || 0) > 0 || (stats.todayCashServiceOut || 0) > 0 || (stats.todayFundToLaci || 0) > 0 || (stats.todayFundFromLaci || 0) > 0">
                  Sisa Laci: Rp {{ netCashDrawer.toLocaleString('id-ID') }}
                  (Masuk Rp {{ grossCashDrawer.toLocaleString('id-ID') }})
                </template>
                <template v-else>
                  Laci Tunai: Rp {{ grossCashDrawer.toLocaleString('id-ID') }}
                </template>
                <span v-if="(stats.todayQrisTotal || 0) > 0"> • QRIS: Rp {{ stats.todayQrisTotal.toLocaleString('id-ID') }}</span>
                <span v-else-if="stats.todayDebtPaid > 0"> • Bon: Rp {{ stats.todayDebtPaid.toLocaleString('id-ID') }}</span>
              </p>
            </div>

            <!-- Perkiraan Untung Bersih (Laba) -->
            <div class="min-w-0 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Untung Bersih (Laba)</span>
              <p class="text-xl sm:text-2xl font-bold font-mono text-emerald-700 mt-1 leading-tight break-words">
                Rp {{ (stats.todayProfit || 0).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                <template v-if="(stats.todayOperationalExpenses || 0) > 0 || (stats.todayCashServiceAdminProfit || 0) > 0 || (stats.todayDigitalProfit || 0) > 0">
                  Laba jual Rp {{ (stats.todayGrossProfit || 0).toLocaleString('id-ID') }}
                  <span v-if="(stats.todayDigitalProfit || 0) > 0"> + Pulsa/PLN Rp {{ stats.todayDigitalProfit.toLocaleString('id-ID') }}</span>
                  <span v-if="(stats.todayCashServiceAdminProfit || 0) > 0"> + Admin Rp {{ stats.todayCashServiceAdminProfit.toLocaleString('id-ID') }}</span>
                  <span v-if="(stats.todayOperationalExpenses || 0) > 0"> - Biaya Rp {{ stats.todayOperationalExpenses.toLocaleString('id-ID') }}</span>
                </template>
                <template v-else>
                  Estimasi selisih modal
                </template>
              </p>
            </div>

            <!-- Total Transaksi -->
            <div class="min-w-0 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Transaksi</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-1 leading-tight">
                {{ stats.transactionCount || 0 }} Struk
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1">Struk kasir tercatat</p>
            </div>

            <!-- Bon Baru -->
            <div class="min-w-0 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bon / Utang Baru</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-rose-600 mt-1 leading-tight break-words">
                Rp {{ (stats.todayNewDebt || 0).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1">Dicatat di buku utang</p>
            </div>
          </div>

          <!-- Strip Ringkas Pengeluaran Hari Ini + Aksi Cepat -->
          <div class="p-3.5 rounded-2xl bg-amber-50/75 border border-amber-200/80 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <Wallet class="w-4 h-4 text-amber-700 shrink-0" />
                <span class="text-xs font-bold text-amber-900">
                  Kas Keluar Hari Ini:
                  <span class="font-mono">Rp {{ (stats.todayExpensesTotal || 0).toLocaleString('id-ID') }}</span>
                </span>
              </div>
              <p class="text-[11px] text-amber-800/90 mt-0.5 leading-snug">
                <template v-if="(stats.todayExpensesTotal || 0) > 0">
                  Laci Tunai: Rp {{ (stats.todayExpensesCash || 0).toLocaleString('id-ID') }}
                  <span v-if="(stats.todayExpensesNonCash || 0) > 0"> • Non-Tunai: Rp {{ stats.todayExpensesNonCash.toLocaleString('id-ID') }}</span>
                  <span v-if="(stats.todayPriveTotal || 0) > 0"> • Tarik Owner: Rp {{ stats.todayPriveTotal.toLocaleString('id-ID') }}</span>
                </template>
                <template v-else>
                  Belum ada catatan pengeluaran operasional atau ambil kas laci hari ini.
                </template>
              </p>
            </div>
            <button
              type="button"
              @click="emit('openExpense')"
              class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5 text-amber-400" />
              <span>Catat Keluar</span>
            </button>
          </div>

          <!-- Strip Ringkas Layanan Tarik Tunai & Transfer -->
          <div class="p-3.5 rounded-2xl bg-sky-50/75 border border-sky-200/80 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <ArrowLeftRight class="w-4 h-4 text-[#0284c7] shrink-0" />
                <span class="text-xs font-bold text-[#0a193d]">
                  Tarik Tunai &amp; Transfer ({{ stats.todayCashServiceCount || 0 }}x)
                </span>
              </div>
              <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
                <template v-if="(stats.todayCashServiceCount || 0) > 0">
                  Tarik Laci: -Rp {{ (stats.todayCashServiceOut || 0).toLocaleString('id-ID') }}
                  • Tf Masuk: +Rp {{ (stats.todayCashServiceIn || 0).toLocaleString('id-ID') }}
                  • Admin: <strong class="text-emerald-700">+Rp {{ (stats.todayCashServiceAdminProfit || 0).toLocaleString('id-ID') }}</strong>
                </template>
                <template v-else>
                  Catat tarik tunai &amp; transfer/top-up agar sisa uang laci tetap cocok.
                </template>
              </p>
            </div>
            <button
              type="button"
              @click="emit('openCashService')"
              class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5 text-sky-400" />
              <span>Catat Layanan</span>
            </button>
          </div>

          <!-- Strip Ringkas Penjualan Pulsa, Paket Data & Token PLN -->
          <div class="p-3.5 rounded-2xl bg-emerald-50/65 border border-emerald-200/80 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <Zap class="w-4 h-4 text-emerald-700 shrink-0" />
                <span class="text-xs font-bold text-[#0a193d]">
                  Pulsa &amp; Token PLN ({{ stats.todayDigitalCount || 0 }}x)
                </span>
              </div>
              <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">
                <template v-if="(stats.todayDigitalCount || 0) > 0">
                  Omzet: Rp {{ (stats.todayDigitalSales || 0).toLocaleString('id-ID') }}
                  • Modal Digital: Rp {{ (stats.todayDigitalCost || 0).toLocaleString('id-ID') }}
                  • Laba: <strong class="text-emerald-700">+Rp {{ (stats.todayDigitalProfit || 0).toLocaleString('id-ID') }}</strong>
                </template>
                <template v-else>
                  Catat pulsa, paket data &amp; token listrik agar omzet konter &amp; bon masuk rekap.
                </template>
              </p>
            </div>
            <button
              type="button"
              @click="emit('openDigitalProduct')"
              class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5 text-emerald-400" />
              <span>Jual Pulsa/PLN</span>
            </button>
          </div>

          <!-- Top 5 Produk Paling Laris -->
          <div>
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <TrendingUp class="w-4 h-4 text-[#0284c7]" />
              <span>Barang Paling Laris Hari Ini</span>
            </h4>

            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              <div 
                v-if="!stats.topProducts || stats.topProducts.length === 0"
                class="p-6 text-center text-slate-400 text-xs"
              >
                <ShoppingBag class="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p class="font-medium text-slate-500">Belum ada barang terjual hari ini</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Transaksi penjualan hari ini akan otomatis muncul di sini</p>
              </div>

              <div 
                v-for="(item, idx) in stats.topProducts" 
                :key="item.name"
                class="p-3 sm:p-3.5 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50/80 transition-colors"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span 
                    :class="[
                      'w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border',
                      idx === 0 
                        ? 'bg-amber-50 text-amber-800 border-amber-200/70' 
                        : idx === 1 
                        ? 'bg-slate-100 text-slate-700 border-slate-200' 
                        : 'bg-slate-50 text-slate-500 border-slate-200/60'
                    ]"
                  >
                    {{ idx + 1 }}
                  </span>
                  <span class="font-bold text-[#0a193d] truncate">{{ item.name }}</span>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-slate-500 font-medium mr-2 font-mono text-xs">{{ item.qty }} pcs</span>
                  <span class="font-bold font-mono text-[#0a193d]">Rp {{ item.subtotal.toLocaleString('id-ID') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tombol Aksi Ekspor & Berbagi -->
          <div class="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- Kirim ke WhatsApp -->
            <button 
              @click="shareToWhatsApp"
              class="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
            >
              <MessageSquare class="w-4 h-4" />
              <span>Kirim Ringkasan ke WhatsApp</span>
            </button>

            <!-- Unduh File Excel (.xlsx) -->
            <button 
              @click="emit('downloadExcel')"
              :disabled="isExporting"
              class="h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-2xs disabled:opacity-60 disabled:cursor-wait"
            >
              <span v-if="isExporting" class="w-4 h-4 rounded-full border-2 border-[#0284c7] border-t-transparent animate-spin"></span>
              <Download v-else class="w-4 h-4 text-slate-500" />
              <span>{{ isExporting ? 'Menyiapkan Excel...' : 'Unduh Laporan Excel (.xlsx)' }}</span>
            </button>
          </div>
        </div>

        <!-- TAB 2: KAS KELUAR / PENGELUARAN HARI INI -->
        <div v-else-if="activeTab === 'expenses'" class="space-y-3">
          <div class="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Total Pengeluaran Hari Ini</p>
              <p class="text-lg font-bold font-mono text-amber-950">
                Rp {{ (stats.todayExpensesTotal || 0).toLocaleString('id-ID') }}
              </p>
            </div>
            <button
              type="button"
              @click="emit('openExpense')"
              class="h-10 px-3.5 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Plus class="w-4 h-4 text-amber-400" />
              <span>Catat Kas Keluar</span>
            </button>
          </div>

          <div
            v-if="todayExpenses.length === 0"
            class="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Wallet class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Belum ada catatan kas keluar hari ini</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Klik "Catat Kas Keluar" untuk mencatat pembelian plastik, galon, bensin, atau tarik owner</p>
          </div>

          <div
            v-for="exp in todayExpenses"
            :key="exp.id || exp.expenseNumber"
            class="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-mono font-bold text-xs text-[#0a193d]">{{ exp.expenseNumber }}</span>
                  <span
                    :class="[
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      exp.category === 'prive'
                        ? 'bg-sky-50 text-[#0284c7] border-sky-200/70'
                        : 'bg-amber-50 text-amber-800 border-amber-200/70'
                    ]"
                  >
                    {{ getExpenseCategoryMeta(exp.category).label }}
                  </span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ getExpenseSourceMeta(exp.source).shortLabel }}
                  </span>
                </div>
                <p class="text-xs font-semibold text-slate-700 break-words">
                  {{ exp.note || getExpenseCategoryMeta(exp.category).label }}
                </p>
              </div>
              <div class="text-right shrink-0 space-y-0.5">
                <p class="font-mono font-bold text-sm text-rose-700">-Rp {{ Number(exp.amount || 0).toLocaleString('id-ID') }}</p>
                <div class="flex items-center justify-end gap-1 text-slate-400 font-mono text-[11px]">
                  <Clock class="w-3 h-3" />
                  <span>{{ formatTime(exp.createdAt) }}</span>
                </div>
              </div>
            </div>

            <div v-if="confirmingDeleteId === exp.id" class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-rose-700 font-semibold">Hapus catatan pengeluaran ini?</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  @click="confirmingDeleteId = null"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  @click="confirmDeleteExpense(exp.id)"
                  class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
            <div v-else class="flex justify-end">
              <button
                type="button"
                @click="confirmingDeleteId = exp.id"
                class="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 3: RIWAYAT TRANSAKSI HARI INI -->
        <div v-else-if="activeTab === 'history'" class="space-y-2.5">
          <div 
            v-if="todayTransactions.length === 0" 
            class="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Receipt class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Belum ada transaksi hari ini</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Semua nota pembayaran kasir hari ini akan tercatat di sini</p>
          </div>

          <!-- Daftar Struk Hari Ini -->
          <div 
            v-for="tx in todayTransactions" 
            :key="tx.invoiceNumber"
            class="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl transition-all shadow-2xs space-y-2"
          >
            <!-- Header Struk -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono font-bold text-xs text-[#0a193d]">{{ tx.invoiceNumber }}</span>
                <span 
                  :class="[
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    tx.paymentMethod === 'TUNAI' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                      : tx.paymentMethod === 'QRIS'
                      ? 'bg-sky-50 text-[#0284c7] border-sky-200/70'
                      : String(tx.paymentMethod || '').includes('SEBAGIAN BON')
                      ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                      : 'bg-rose-50 text-rose-800 border-rose-200/60'
                  ]"
                >
                  {{ tx.paymentMethod }}
                </span>
                <span v-if="tx.customerName" class="text-xs text-slate-500 font-semibold truncate">
                  • {{ tx.customerName }}
                </span>
              </div>

              <div class="flex items-center gap-1 text-slate-400 font-mono text-xs shrink-0">
                <Clock class="w-3.5 h-3.5" />
                <span>{{ formatTime(tx.createdAt) }}</span>
              </div>
            </div>

            <!-- Item-item Struk -->
            <div v-if="tx.items && tx.items.length > 0" class="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <div v-for="item in tx.items" :key="item.id" class="flex items-center justify-between py-0.5">
                <span class="truncate mr-2">• {{ item.name }} (x{{ item.qty }})</span>
                <span class="font-mono text-slate-700 shrink-0">Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}</span>
              </div>
            </div>

            <!-- Total Akhir Struk & Aksi Cetak / Void -->
            <div class="flex items-center justify-between pt-1 text-xs gap-2">
              <span class="text-slate-500 font-medium">Total Pembayaran:</span>
              <span class="font-mono font-bold text-sm text-[#0a193d]">
                Rp {{ tx.totalAmount.toLocaleString('id-ID') }}
              </span>
            </div>

            <div v-if="confirmingDeleteTxId === (tx.id || tx.invoiceNumber)" class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
              <span class="text-rose-700 font-semibold">Batalkan struk ini &amp; pulihkan stok/bon?</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  @click="confirmingDeleteTxId = null"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  @click="confirmDeleteTransaction(tx)"
                  class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  Ya, Void
                </button>
              </div>
            </div>
            <div v-else class="pt-1.5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                @click="emit('openReceipt', tx)"
                class="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284c7] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Receipt class="w-3 h-3" />
                <span>Cetak Struk</span>
              </button>
              <button
                v-if="tx.id"
                type="button"
                @click="confirmingDeleteTxId = tx.id || tx.invoiceNumber"
                class="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 class="w-3 h-3" />
                <span>Batalkan</span>
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 4: RIWAYAT SHIFT & TUTUP BUKU HARIAN -->
        <div v-else-if="activeTab === 'shifts'" class="space-y-3">
          <div
            v-if="closedShifts.length === 0"
            class="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Clock class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Belum ada riwayat tutup shift</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Rekap buka/tutup buku harian kasir akan tercatat rapi di sini</p>
          </div>

          <div
            v-for="s in closedShifts"
            :key="s.id || s.shiftCode"
            class="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2.5"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono font-bold text-xs text-[#0a193d]">{{ s.shiftCode }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    {{ s.cashierName }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  {{ formatDateTime(s.openedAt) }} → {{ formatDateTime(s.closedAt) }}
                </p>
              </div>
              <button
                type="button"
                @click="shareClosedShiftToWA(s)"
                class="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
              >
                <MessageSquare class="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div>
                <span class="text-slate-400 block">Modal Awal</span>
                <span class="font-mono font-bold text-[#0a193d]">Rp {{ (s.openingCash || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Tunai Masuk</span>
                <span class="font-mono font-bold text-emerald-700">Rp {{ (s.summary?.todayCashDrawer || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Kas Keluar Laci</span>
                <span class="font-mono font-bold text-rose-700">Rp {{ (s.summary?.todayExpensesCash || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">QRIS (Non-Tunai)</span>
                <span class="font-mono font-bold text-[#0284c7]">Rp {{ (s.summary?.todayQrisTotal || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Fisik di Laci</span>
                <span class="font-mono font-bold text-[#0a193d]">Rp {{ (s.actualCash || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Selisih Laci</span>
                <span
                  :class="[
                    'font-mono font-bold',
                    (s.cashDifference || 0) === 0
                      ? 'text-emerald-700'
                      : (s.cashDifference || 0) > 0
                      ? 'text-[#0284c7]'
                      : 'text-rose-700'
                  ]"
                >
                  {{ (s.cashDifference || 0) === 0 ? 'Pas ✓' : `${s.cashDifference > 0 ? '+' : '-'}Rp ${Math.abs(s.cashDifference).toLocaleString('id-ID')}` }}
                </span>
              </div>
            </div>

            <p v-if="s.closingNote" class="text-[11px] text-slate-500 italic">
              Catatan: "{{ s.closingNote }}"
            </p>
          </div>
        </div>

      </div>

      <!-- 4. Modal Footer -->
      <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
        <span class="text-xs text-slate-500 font-medium">
          Laporan diperbarui otomatis secara real-time
        </span>
        <button 
          @click="emit('close')"
          class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
        >
          Tutup
        </button>
      </div>

    </div>
  </div>
</template>
