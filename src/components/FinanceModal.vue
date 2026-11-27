<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  Landmark,
  Wallet,
  ArrowLeftRight,
  Banknote,
  History,
  Check,
  CheckCircle,
  AlertCircle,
  Trash2,
  TrendingUp,
  Plus
} from '@lucide/vue'
import {
  computeFinanceBalances,
  computePeriodFinanceSummary,
  getFinanceAccountMeta
} from '../utils/financeEngine'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  activeShift: {
    type: Object,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({
      isShiftScoped: false,
      openingCash: 0,
      todayNetCashDrawer: 0,
      expectedCashDrawer: 0
    })
  },
  transactions: {
    type: Array,
    default: () => []
  },
  debtPayments: {
    type: Array,
    default: () => []
  },
  expenses: {
    type: Array,
    default: () => []
  },
  cashServices: {
    type: Array,
    default: () => []
  },
  digitalProducts: {
    type: Array,
    default: () => []
  },
  fundMovements: {
    type: Array,
    default: () => []
  },
  customers: {
    type: Array,
    default: () => []
  },
  precomputedPockets: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'recordFundMovement', 'deleteFundMovement'])

const activeTab = ref('summary') // 'summary' | 'action' | 'history'
const periodRange = ref('today') // 'today' | '7d' | '30d'
const actionType = ref('TAMBAH_TABUNGAN') // 'TAMBAH_TABUNGAN' | 'MUTASI' | 'SETOR_MODAL' | 'TARIK_DANA'
const fromAccount = ref('LACI')
const toAccount = ref('TABUNGAN')
const amountInput = ref('')
const noteInput = ref('')
const confirmingDeleteId = ref(null)
const savedNotice = ref('')
const errorNotice = ref('')

const amountPresets = [50000, 100000, 200000, 500000, 1000000]
const internalAccounts = [
  { id: 'LACI', label: 'Laci Kasir' },
  { id: 'KAS', label: 'Uang Kas' },
  { id: 'REKENING', label: 'Rekening/QRIS' },
  { id: 'TABUNGAN', label: 'Tabungan' },
  { id: 'PIHAK_KETIGA', label: 'Saldo Pihak Ketiga' }
]

const liveDrawerBalance = computed(() => {
  if (props.stats?.isShiftScoped) {
    return Number(props.stats.expectedCashDrawer ?? ((props.stats.openingCash || 0) + (props.stats.todayNetCashDrawer || 0)))
  }
  return Number(props.stats?.todayNetCashDrawer ?? 0)
})

const balances = computed(() =>
  computeFinanceBalances({
    transactions: props.transactions,
    debtPayments: props.debtPayments,
    expenses: props.expenses,
    cashServices: props.cashServices,
    digitalProducts: props.digitalProducts,
    fundMovements: props.fundMovements,
    customers: props.customers,
    liveDrawerBalance: liveDrawerBalance.value,
    precomputedPockets: props.precomputedPockets
  })
)

const periodSummary = computed(() =>
  computePeriodFinanceSummary({
    range: periodRange.value,
    activeShift: props.activeShift,
    transactions: props.transactions,
    debtPayments: props.debtPayments,
    expenses: props.expenses,
    cashServices: props.cashServices,
    digitalProducts: props.digitalProducts,
    fundMovements: props.fundMovements
  })
)

const activeMovements = computed(() =>
  (props.fundMovements || [])
    .filter(m => m && !m.deleted)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
)

const getBalanceForAccount = (accountId) => {
  if (accountId === 'LACI') return balances.value.laciBalance
  if (accountId === 'KAS') return balances.value.kasBalance
  if (accountId === 'REKENING') return balances.value.rekeningBalance
  if (accountId === 'TABUNGAN') return balances.value.tabunganBalance
  if (accountId === 'PIHAK_KETIGA' || accountId === 'SALDO_AGEN') return balances.value.pihakKetigaBalance
  return Infinity
}

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'summary'
    periodRange.value = 'today'
    actionType.value = 'TAMBAH_TABUNGAN'
    fromAccount.value = 'LACI'
    toAccount.value = 'TABUNGAN'
    amountInput.value = ''
    noteInput.value = ''
    confirmingDeleteId.value = null
    savedNotice.value = ''
    errorNotice.value = ''
  }
}, { immediate: true })

const selectActionMode = (mode) => {
  actionType.value = mode
  errorNotice.value = ''
  if (mode === 'TAMBAH_TABUNGAN') {
    fromAccount.value = 'LACI'
    toAccount.value = 'TABUNGAN'
  } else if (mode === 'MUTASI') {
    fromAccount.value = 'LACI'
    toAccount.value = 'KAS'
  } else if (mode === 'SETOR_MODAL') {
    fromAccount.value = 'LUAR'
    toAccount.value = 'KAS'
  } else if (mode === 'TARIK_DANA') {
    fromAccount.value = 'TABUNGAN'
    toAccount.value = 'LUAR'
  }
}

const openQuickAddTabungan = () => {
  selectActionMode('TAMBAH_TABUNGAN')
  activeTab.value = 'action'
}

const openQuickTopUpMitra = () => {
  actionType.value = 'MUTASI'
  errorNotice.value = ''
  fromAccount.value = 'REKENING'
  toAccount.value = 'PIHAK_KETIGA'
  activeTab.value = 'action'
}

const parsedAmount = computed(() => {
  const num = parseInt(String(amountInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const isSameAccountError = computed(() => fromAccount.value === toAccount.value)

const sourceAvailableBalance = computed(() => getBalanceForAccount(fromAccount.value))

const isInsufficientSource = computed(() => {
  if (fromAccount.value === 'LUAR') return false
  if (parsedAmount.value <= 0) return false
  return sourceAvailableBalance.value <= 0 || parsedAmount.value > sourceAvailableBalance.value
})

const canSubmitMovement = computed(() => {
  return parsedAmount.value > 0 && !isSameAccountError.value && !isInsufficientSource.value
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

const handleSubmit = () => {
  errorNotice.value = ''
  if (parsedAmount.value <= 0) {
    errorNotice.value = 'Masukkan nominal dana lebih dari Rp 0.'
    return
  }
  if (isSameAccountError.value) {
    errorNotice.value = 'Kantong asal dan tujuan tidak boleh sama.'
    return
  }
  if (isInsufficientSource.value) {
    errorNotice.value = `Saldo ${getFinanceAccountMeta(fromAccount.value).shortLabel} tidak mencukupi (tersedia Rp ${Math.max(0, sourceAvailableBalance.value).toLocaleString('id-ID')}).`
    return
  }

  const fromLabel = getFinanceAccountMeta(fromAccount.value).shortLabel
  const toLabel = getFinanceAccountMeta(toAccount.value).shortLabel
  const payload = {
    type: actionType.value,
    fromAccount: fromAccount.value,
    toAccount: toAccount.value,
    amount: parsedAmount.value,
    availableSourceBalance: fromAccount.value === 'LUAR' ? undefined : sourceAvailableBalance.value,
    note: noteInput.value.trim() || `${fromLabel} ke ${toLabel}`
  }

  emit('recordFundMovement', payload)
  savedNotice.value = `Berhasil catat Rp ${payload.amount.toLocaleString('id-ID')} (${fromLabel} -> ${toLabel})`
  amountInput.value = ''
  noteInput.value = ''

  setTimeout(() => {
    savedNotice.value = ''
  }, 3000)
}

const triggerDelete = (id) => {
  if (confirmingDeleteId.value === id) {
    emit('deleteFundMovement', id)
    confirmingDeleteId.value = null
  } else {
    confirmingDeleteId.value = id
    setTimeout(() => {
      if (confirmingDeleteId.value === id) confirmingDeleteId.value = null
    }, 3500)
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">

      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Landmark class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              Manajemen Keuangan &amp; Tabungan
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              Pantau saldo Laci, Uang Kas, Rekening/QRIS, Tabungan &amp; Pihak Ketiga
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

      <!-- 2. Tab Switcher -->
      <div class="px-5 pt-3 pb-1 shrink-0 bg-white border-b border-slate-100">
        <div class="p-1 bg-slate-100 rounded-2xl grid grid-cols-3 gap-1">
          <button
            type="button"
            @click="activeTab = 'summary'"
            :class="[
              'h-10 px-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'summary' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <TrendingUp class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Ringkasan Saldo</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'action'"
            :class="[
              'h-10 px-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'action' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <ArrowLeftRight class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Tabungan &amp; Mutasi</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'history'"
            :class="[
              'h-10 px-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'history' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <History class="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>Riwayat ({{ activeMovements.length }})</span>
          </button>
        </div>
      </div>

      <!-- 3. Body -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

        <!-- TAB 1: RINGKASAN SALDO 4 KANTONG + ARUS PERIODE -->
        <template v-if="activeTab === 'summary'">
          <!-- 4 Kartu Saldo Kantong Dana -->
          <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
            <!-- Laci Kasir -->
            <div class="min-w-0 p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80">
              <span class="text-[11px] font-bold text-[#0284c7] uppercase tracking-wider block">Uang Laci Kasir</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-1 break-words">
                Rp {{ balances.laciBalance.toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {{ stats.isShiftScoped ? `Sesuai Shift ${stats.shiftCode || 'Aktif'}` : 'Harian (sebelum buka shift)' }}
              </p>
            </div>

            <!-- Uang Kas Toko -->
            <div class="min-w-0 p-3.5 rounded-2xl bg-emerald-50/75 border border-emerald-200/80">
              <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Uang Kas Toko</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1 break-words">
                Rp {{ balances.kasBalance.toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Cadangan / sumber tarik tunai
              </p>
            </div>

            <!-- Rekening & QRIS -->
            <div class="min-w-0 p-3.5 rounded-2xl bg-indigo-50/75 border border-indigo-200/80">
              <span class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Rekening &amp; QRIS</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-1 break-words">
                Rp {{ balances.rekeningBalance.toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Saldo non-tunai kumulatif
              </p>
            </div>

            <!-- Tabungan Toko -->
            <div class="min-w-0 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col justify-between gap-2">
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Tabungan Toko</span>
                  <button
                    type="button"
                    @click="openQuickAddTabungan"
                    class="px-2 py-0.5 rounded-lg bg-[#0a193d] hover:bg-slate-800 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus class="w-3 h-3 text-amber-300" />
                    <span>Tambah</span>
                  </button>
                </div>
                <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-1 break-words">
                  Rp {{ balances.tabunganBalance.toLocaleString('id-ID') }}
                </p>
              </div>
              <p class="text-[11px] text-amber-900/75 leading-snug">Simpanan tabungan usaha</p>
            </div>

            <!-- Saldo Pihak Ketiga (Pulsa & Token PLN) -->
            <div class="col-span-2 min-w-0 p-3.5 rounded-2xl bg-purple-50/75 border border-purple-200/80 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <span class="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">Saldo Pihak Ketiga (Pulsa / PLN)</span>
                <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-0.5 break-words">
                  Rp {{ (balances.pihakKetigaBalance || 0).toLocaleString('id-ID') }}
                </p>
                <p class="text-[11px] text-purple-800/80 leading-snug">Otomatis terpotong modal saat jual pulsa/token memakai Saldo Pihak Ketiga</p>
              </div>
              <button
                type="button"
                @click="openQuickTopUpMitra"
                class="px-3 py-1.5 rounded-xl bg-[#0a193d] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5 text-purple-300" />
                <span>Isi Saldo</span>
              </button>
            </div>
          </div>

          <!-- Posisi Kekayaan Usaha -->
          <div class="p-4 rounded-2xl bg-[#0a193d] text-white space-y-2 shadow-xs">
            <div class="flex items-center justify-between gap-2 text-xs text-sky-200">
              <span>Total Dana Likuid (Laci + Kas + Rek + Tabungan + Mitra)</span>
              <span class="font-mono font-bold text-white">Rp {{ balances.totalLiquidAssets.toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 text-xs text-sky-200">
              <span>Piutang Belum Lunas (Buku Utang)</span>
              <span class="font-mono font-bold text-amber-300">Rp {{ balances.totalReceivables.toLocaleString('id-ID') }}</span>
            </div>
            <div class="pt-2 border-t border-white/15 flex items-center justify-between gap-2 text-sm font-bold">
              <span>Total Kekayaan Usaha</span>
              <span class="font-mono text-emerald-300 text-base">Rp {{ balances.totalNetWealth.toLocaleString('id-ID') }}</span>
            </div>
          </div>

          <!-- Ringkasan Arus Keuangan Lintas Periode -->
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#0a193d] uppercase tracking-wider">Ringkasan Arus Periode</span>
              <div class="p-0.5 bg-white rounded-xl border border-slate-200 flex gap-1">
                <button
                  type="button"
                  @click="periodRange = 'today'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                    periodRange === 'today' ? 'bg-[#0a193d] text-white' : 'text-slate-600 hover:bg-slate-50'
                  ]"
                >
                  {{ activeShift ? 'Shift Ini' : 'Hari Ini' }}
                </button>
                <button
                  type="button"
                  @click="periodRange = '7d'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                    periodRange === '7d' ? 'bg-[#0a193d] text-white' : 'text-slate-600 hover:bg-slate-50'
                  ]"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  @click="periodRange = '30d'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                    periodRange === '30d' ? 'bg-[#0a193d] text-white' : 'text-slate-600 hover:bg-slate-50'
                  ]"
                >
                  30 Hari
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Total Omzet</span>
                <span class="font-mono font-bold text-[#0a193d] mt-0.5 block">
                  Rp {{ periodSummary.salesTotal.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Pelunasan Bon</span>
                <span class="font-mono font-bold text-[#0284c7] mt-0.5 block">
                  +Rp {{ periodSummary.debtPaid.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Estimasi Laba</span>
                <span class="font-mono font-bold text-emerald-700 mt-0.5 block">
                  Rp {{ periodSummary.netProfit.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Masuk Tabungan</span>
                <span class="font-mono font-bold text-amber-700 mt-0.5 block">
                  +Rp {{ periodSummary.addedToTabungan.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Masuk Uang Kas</span>
                <span class="font-mono font-bold text-emerald-700 mt-0.5 block">
                  +Rp {{ periodSummary.movedToKas.toLocaleString('id-ID') }}
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/70">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">Kas Keluar</span>
                <span class="font-mono font-bold text-rose-600 mt-0.5 block">
                  Rp {{ periodSummary.expensesTotal.toLocaleString('id-ID') }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB 2: TABUNGAN & MUTASI ANTAR KANTONG -->
        <template v-else-if="activeTab === 'action'">
          <div
            v-if="savedNotice"
            class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{{ savedNotice }}</span>
          </div>

          <div
            v-if="errorNotice"
            class="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{{ errorNotice }}</span>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Jenis Aksi -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pilih Jenis Transaksi Keuangan
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  @click="selectActionMode('TAMBAH_TABUNGAN')"
                  :class="[
                    'h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all',
                    actionType === 'TAMBAH_TABUNGAN'
                      ? 'bg-[#0a193d] text-white border-[#0a193d]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Tambah Tabungan
                </button>
                <button
                  type="button"
                  @click="selectActionMode('MUTASI')"
                  :class="[
                    'h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all',
                    actionType === 'MUTASI'
                      ? 'bg-[#0a193d] text-white border-[#0a193d]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Pindah Kantong
                </button>
                <button
                  type="button"
                  @click="selectActionMode('SETOR_MODAL')"
                  :class="[
                    'h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all',
                    actionType === 'SETOR_MODAL'
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Setor Modal Awal
                </button>
                <button
                  type="button"
                  @click="selectActionMode('TARIK_DANA')"
                  :class="[
                    'h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all',
                    actionType === 'TARIK_DANA'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Ambil Dana
                </button>
              </div>
            </div>

            <!-- Pilih Kantong Asal & Tujuan -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Sumber Dana -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Dari Kantong / Sumber:
                </label>
                <div v-if="actionType === 'SETOR_MODAL'" class="h-11 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center text-xs font-bold text-slate-700">
                  Dana Luar / Modal Awal Pemilik
                </div>
                <select
                  v-else
                  v-model="fromAccount"
                  class="w-full h-11 px-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-[#0284c7] text-xs font-bold text-[#0a193d] outline-hidden"
                >
                  <option v-for="acc in internalAccounts" :key="acc.id" :value="acc.id">
                    {{ acc.label }} (Rp {{ getBalanceForAccount(acc.id).toLocaleString('id-ID') }})
                  </option>
                  <option v-if="actionType === 'TAMBAH_TABUNGAN'" value="LUAR">
                    Setor Langsung dari Dana Luar
                  </option>
                </select>
              </div>

              <!-- Tujuan Dana -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Ke Kantong Tujuan:
                </label>
                <div v-if="actionType === 'TAMBAH_TABUNGAN'" class="h-11 px-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center text-xs font-bold text-amber-900">
                  Tabungan Toko (Saldo: Rp {{ balances.tabunganBalance.toLocaleString('id-ID') }})
                </div>
                <div v-else-if="actionType === 'TARIK_DANA'" class="h-11 px-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center text-xs font-bold text-rose-800">
                  Diambil / Dicairkan Pemilik (Keluar Usaha)
                </div>
                <select
                  v-else
                  v-model="toAccount"
                  class="w-full h-11 px-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-[#0284c7] text-xs font-bold text-[#0a193d] outline-hidden"
                >
                  <option v-for="acc in internalAccounts" :key="acc.id" :value="acc.id">
                    {{ acc.label }} (Rp {{ getBalanceForAccount(acc.id).toLocaleString('id-ID') }})
                  </option>
                </select>
              </div>
            </div>

            <!-- Input Nominal -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nominal (Rp)
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-slate-400">Rp</span>
                <input
                  type="text"
                  inputmode="numeric"
                  v-model="amountInput"
                  placeholder="Contoh: 200000"
                  class="w-full h-12 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-2xl text-lg font-bold font-mono text-[#0a193d] outline-hidden"
                />
              </div>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="preset in amountPresets"
                  :key="preset"
                  type="button"
                  @click="amountInput = String(preset)"
                  :class="[
                    'px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono cursor-pointer transition-colors border',
                    parsedAmount === preset
                      ? 'bg-[#0a193d] text-white border-[#0a193d]'
                      : 'bg-slate-100 hover:bg-sky-50 hover:text-[#0284c7] text-slate-700 border-slate-200/70'
                  ]"
                >
                  {{ preset >= 1000000 ? '1jt' : `${(preset / 1000).toLocaleString('id-ID')}rb` }}
                </button>
              </div>
            </div>

            <div
              v-if="isInsufficientSource"
              class="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
            >
              <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Saldo <strong>{{ getFinanceAccountMeta(fromAccount).shortLabel }}</strong> tidak mencukupi
                (tersedia Rp {{ Math.max(0, sourceAvailableBalance).toLocaleString('id-ID') }}).
              </span>
            </div>

            <div
              v-if="isSameAccountError"
              class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium"
            >
              <AlertCircle class="w-4 h-4 text-amber-600 shrink-0" />
              <span>Kantong asal dan tujuan harus berbeda.</span>
            </div>

            <!-- Catatan -->
            <div>
              <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Keterangan / Catatan <span class="text-slate-400 font-medium normal-case">(opsional)</span>
              </label>
              <input
                type="text"
                v-model="noteInput"
                placeholder="Misal: Sisihkan tabungan harian / Setor modal brankas"
                class="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-medium text-[#0a193d] outline-hidden"
              />
            </div>

            <button
              type="submit"
              :disabled="!canSubmitMovement"
              class="w-full h-12 rounded-2xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 shadow-sm"
            >
              <Check class="w-4 h-4 text-sky-400" />
              <span>
                {{
                  actionType === 'TAMBAH_TABUNGAN'
                    ? 'Simpan Tambah Tabungan'
                    : actionType === 'SETOR_MODAL'
                    ? 'Simpan Setor Modal'
                    : actionType === 'TARIK_DANA'
                    ? 'Simpan Penarikan Dana'
                    : 'Simpan Pindah Dana'
                }}
              </span>
            </button>
          </form>
        </template>

        <!-- TAB 3: RIWAYAT MUTASI & TABUNGAN -->
        <template v-else>
          <div
            v-if="activeMovements.length === 0"
            class="p-8 rounded-2xl bg-slate-50 border border-slate-200/70 text-center text-slate-400 text-xs"
          >
            <Wallet class="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p class="font-bold text-slate-500">Belum ada catatan tabungan atau mutasi kas</p>
            <p class="mt-0.5 text-[11px]">Gunakan tab Tabungan &amp; Mutasi untuk mencatat tambah tabungan atau setor kas.</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="mv in activeMovements"
              :key="mv.id"
              class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between gap-3"
            >
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border',
                      mv.type === 'TAMBAH_TABUNGAN'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : mv.type === 'SETOR_MODAL'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : mv.type === 'TARIK_DANA'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-sky-50 text-[#0284c7] border-sky-200'
                    ]"
                  >
                    {{ mv.type === 'TAMBAH_TABUNGAN' ? 'Tambah Tabungan' : mv.type === 'SETOR_MODAL' ? 'Setor Modal' : mv.type === 'TARIK_DANA' ? 'Ambil Dana' : 'Pindah Kantong' }}
                  </span>
                  <span class="text-[11px] font-mono text-slate-400">
                    {{ mv.movementNumber }} • {{ formatDateTime(mv.createdAt) }}
                  </span>
                </div>

                <p class="text-xs sm:text-sm font-bold text-[#0a193d] font-mono">
                  Rp {{ Number(mv.amount || 0).toLocaleString('id-ID') }}
                  <span class="font-sans text-xs font-semibold text-slate-600">
                    ({{ getFinanceAccountMeta(mv.fromAccount).shortLabel }} → {{ getFinanceAccountMeta(mv.toAccount).shortLabel }})
                  </span>
                </p>

                <p v-if="mv.note" class="text-[11px] text-slate-500 truncate">
                  {{ mv.note }}
                </p>
              </div>

              <button
                type="button"
                @click="triggerDelete(mv.id)"
                :class="[
                  'h-8 px-2.5 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors border shrink-0',
                  confirmingDeleteId === mv.id
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200'
                ]"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span v-if="confirmingDeleteId === mv.id">Hapus?</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
