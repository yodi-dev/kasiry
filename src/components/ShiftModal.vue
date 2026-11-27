<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  Clock,
  User,
  Wallet,
  Check,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Store
} from '@lucide/vue'
import { computeShiftClosingPreview, formatShiftWhatsAppText } from '../utils/dailyStats'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  activeShift: {
    type: Object,
    default: null
  },
  completedShift: {
    type: Object,
    default: null
  },
  isActiveShiftStale: {
    type: Boolean,
    default: false
  },
  defaultCashierName: {
    type: String,
    default: 'Kasir'
  },
  lastOpeningCash: {
    type: Number,
    default: 0
  },
  unassignedTodayCount: {
    type: Number,
    default: 0
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
  storeName: {
    type: String,
    default: 'Warung Kasiry'
  },
  isAutoPrompt: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'close',
  'dismissPrompt',
  'openShift',
  'closeShift',
  'startNextShift'
])

const cashierInput = ref(props.defaultCashierName || 'Kasir')
const openingCashInput = ref(String(props.lastOpeningCash || 0))
const adoptUnassigned = ref(true)

const actualCashInput = ref('')
const closingNoteInput = ref('')

const openingPresets = [0, 100000, 200000, 300000, 500000]

const currentViewMode = computed(() => {
  if (props.completedShift) return 'summary'
  if (props.activeShift) return 'close'
  return 'open'
})

watch(
  () => [props.isOpen, props.activeShift?.id, props.completedShift?.id],
  ([open]) => {
    if (open) {
      cashierInput.value = props.defaultCashierName || 'Kasir'
      openingCashInput.value = String(props.lastOpeningCash || 0)
      adoptUnassigned.value = true
      actualCashInput.value = ''
      closingNoteInput.value = ''
    }
  },
  { immediate: true }
)

const parseNumericInput = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return 0
  const val = parseInt(digits, 10)
  return Number.isFinite(val) ? val : 0
}

const parsedOpeningCash = computed(() => parseNumericInput(openingCashInput.value))
const hasActualCashEntered = computed(() => String(actualCashInput.value ?? '').trim().length > 0)
const parsedActualCash = computed(() => parseNumericInput(actualCashInput.value))

const closingPreview = computed(() => {
  if (!props.activeShift) return null
  return computeShiftClosingPreview({
    shift: props.activeShift,
    transactions: props.transactions,
    debtPayments: props.debtPayments,
    expenses: props.expenses,
    cashServices: props.cashServices,
    digitalProducts: props.digitalProducts,
    fundMovements: props.fundMovements,
    actualCash: hasActualCashEntered.value ? parsedActualCash.value : 0
  })
})

const formatDateTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleDismissOrClose = () => {
  if (currentViewMode.value === 'open' && props.isAutoPrompt) {
    emit('dismissPrompt')
  } else {
    emit('close')
  }
}

const submitOpenShift = () => {
  emit('openShift', {
    cashierName: cashierInput.value.trim() || props.defaultCashierName || 'Kasir',
    openingCash: parsedOpeningCash.value,
    adoptUnassignedToday: adoptUnassigned.value
  })
}

const fillExactExpected = () => {
  if (!closingPreview.value) return
  actualCashInput.value = String(Math.max(0, closingPreview.value.expectedCash))
}

const submitCloseShift = () => {
  if (!props.activeShift || !hasActualCashEntered.value) return
  emit('closeShift', {
    shiftId: props.activeShift.id,
    actualCash: parsedActualCash.value,
    closingNote: closingNoteInput.value.trim()
  })
}

const shareClosedShiftToWA = () => {
  if (!props.completedShift) return
  const text = formatShiftWhatsAppText(props.completedShift, props.storeName)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg md:max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Clock v-if="currentViewMode === 'open'" class="w-5 h-5 text-sky-400" />
            <Wallet v-else-if="currentViewMode === 'close'" class="w-5 h-5 text-amber-400" />
            <CheckCircle v-else class="w-5 h-5 text-emerald-400" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              <template v-if="currentViewMode === 'open'">Buka Shift / Mulai Jualan</template>
              <template v-else-if="currentViewMode === 'close'">Tutup Shift &amp; Buku Harian</template>
              <template v-else>Shift Berhasil Ditutup ✓</template>
            </h3>
            <p class="text-xs text-slate-500 font-medium leading-snug truncate">
              <template v-if="currentViewMode === 'open'">
                {{ storeName }} • Atur modal awal laci kasir hari ini
              </template>
              <template v-else-if="currentViewMode === 'close'">
                {{ activeShift?.shiftCode }} • {{ activeShift?.cashierName }} (Buka {{ formatDateTime(activeShift?.openedAt) }})
              </template>
              <template v-else>
                {{ completedShift?.shiftCode }} • {{ completedShift?.cashierName }}
              </template>
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="handleDismissOrClose"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 2. Body -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- ==================== MODE 1: BUKA SHIFT ==================== -->
        <form v-if="currentViewMode === 'open'" @submit.prevent="submitOpenShift" class="space-y-4">
          <div class="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/70 text-xs text-sky-900 leading-relaxed flex items-start gap-2.5">
            <Store class="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
            <span>
              Satu shift mencatat seluruh transaksi, QRIS, utang, dan kas keluar selama warung buka sampai nanti <strong>Tutup Buku</strong>.
            </span>
          </div>

          <!-- Nama Kasir -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Kasir / Penjaga
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User class="w-4 h-4" />
              </span>
              <input
                type="text"
                v-model="cashierInput"
                placeholder="Contoh: Kasir"
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-bold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Modal Awal Laci -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Modal Awal Laci / Uang Kembalian (Rp)
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputmode="numeric"
                v-model="openingCashInput"
                placeholder="0"
                class="w-full h-12 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-lg font-bold font-mono text-[#0a193d] outline-hidden transition-all"
              />
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button
                v-for="preset in openingPresets"
                :key="preset"
                type="button"
                @click="openingCashInput = String(preset)"
                :class="[
                  'px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono cursor-pointer transition-colors border',
                  parsedOpeningCash === preset
                    ? 'bg-[#0a193d] text-white border-[#0a193d]'
                    : 'bg-slate-100 hover:bg-sky-50 hover:text-[#0284c7] text-slate-700 border-slate-200/70'
                ]"
              >
                {{ preset === 0 ? 'Rp 0' : `${(preset / 1000).toLocaleString('id-ID')}rb` }}
              </button>
            </div>
          </div>

          <!-- Jika terlanjur ada transaksi hari ini sebelum Buka Shift -->
          <label
            v-if="unassignedTodayCount > 0"
            class="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 cursor-pointer text-xs text-amber-950"
          >
            <input
              type="checkbox"
              v-model="adoptUnassigned"
              class="mt-0.5 rounded border-amber-400 text-[#0284c7] focus:ring-[#0284c7]"
            />
            <span class="leading-snug">
              <strong>Sertakan {{ unassignedTodayCount }} catatan hari ini</strong> (penjualan / kas keluar / bayar bon) yang dibuat sebelum klik Buka Shift.
            </span>
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              @click="handleDismissOrClose"
              class="h-11 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs cursor-pointer transition-colors"
            >
              {{ isAutoPrompt ? 'Nanti Saja (Langsung Jualan)' : 'Batal' }}
            </button>
            <button
              type="submit"
              class="h-11 px-4 rounded-2xl bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm"
            >
              <Check class="w-4 h-4 text-sky-400" />
              <span>Buka Shift Sekarang</span>
            </button>
          </div>
        </form>

        <!-- ==================== MODE 2: TUTUP SHIFT ==================== -->
        <form v-else-if="currentViewMode === 'close' && closingPreview" @submit.prevent="submitCloseShift" class="space-y-4">
          <div
            v-if="isActiveShiftStale"
            class="p-3 rounded-2xl bg-amber-50 border border-amber-300/80 text-xs text-amber-950 flex items-start gap-2.5"
          >
            <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span class="leading-snug">
              <strong>Shift kemarin masih terbuka!</strong> Sebaiknya lakukan Tutup Buku untuk shift ini dulu agar omzet tidak tercampur dengan hari baru.
            </span>
          </div>

          <!-- Ringkasan Arus Kas Laci Shift -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="min-w-0 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Modal Awal Laci</span>
              <p class="text-base sm:text-lg font-bold font-mono text-[#0a193d] mt-0.5 break-words">
                Rp {{ closingPreview.openingCash.toLocaleString('id-ID') }}
              </p>
            </div>

            <div class="min-w-0 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70">
              <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Tunai Masuk Laci</span>
              <p class="text-base sm:text-lg font-bold font-mono text-emerald-800 mt-0.5 break-words">
                +Rp {{ ((closingPreview.todayCashDrawer || 0) + (closingPreview.todayCashServiceIn || 0) + (closingPreview.todayFundToLaci || 0)).toLocaleString('id-ID') }}
              </p>
            </div>

            <div class="min-w-0 p-3 rounded-2xl bg-amber-50/75 border border-amber-200/75">
              <span class="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Kas Keluar Laci</span>
              <p class="text-base sm:text-lg font-bold font-mono text-rose-700 mt-0.5 break-words">
                -Rp {{ ((closingPreview.todayExpensesCash || 0) + (closingPreview.todayCashServiceOut || 0) + (closingPreview.todayFundFromLaci || 0)).toLocaleString('id-ID') }}
              </p>
            </div>

            <div class="min-w-0 p-3 rounded-2xl bg-[#0a193d] text-white border border-[#0a193d] shadow-xs">
              <span class="text-[11px] font-bold text-sky-300 uppercase tracking-wider block">Seharusnya di Laci</span>
              <p class="text-base sm:text-lg font-bold font-mono text-white mt-0.5 break-words">
                Rp {{ closingPreview.expectedCash.toLocaleString('id-ID') }}
              </p>
            </div>
          </div>

          <!-- Strip Informasi Non-Tunai & Aktivitas -->
          <div class="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
            <span>QRIS: <strong class="font-mono text-[#0284c7]">Rp {{ closingPreview.todayQrisTotal.toLocaleString('id-ID') }}</strong></span>
            <span>•</span>
            <span>Bon Baru: <strong class="font-mono text-rose-700">Rp {{ closingPreview.todayNewDebt.toLocaleString('id-ID') }}</strong></span>
            <template v-if="(closingPreview.todayCashServiceAdminProfit || 0) > 0">
              <span>•</span>
              <span>Admin Tarik/Tf: <strong class="font-mono text-[#0284c7]">+Rp {{ closingPreview.todayCashServiceAdminProfit.toLocaleString('id-ID') }}</strong></span>
            </template>
            <template v-if="(closingPreview.todayDigitalProfit || 0) > 0">
              <span>•</span>
              <span>Laba Pulsa/PLN: <strong class="font-mono text-emerald-700">+Rp {{ closingPreview.todayDigitalProfit.toLocaleString('id-ID') }}</strong></span>
            </template>
            <template v-if="(closingPreview.todayFundToLaci || 0) > 0">
              <span>•</span>
              <span>Dana Masuk Laci: <strong class="font-mono text-emerald-700">+Rp {{ closingPreview.todayFundToLaci.toLocaleString('id-ID') }}</strong></span>
            </template>
            <template v-if="(closingPreview.todayFundFromLaci || 0) > 0">
              <span>•</span>
              <span>Mutasi Dari Laci: <strong class="font-mono text-amber-700">-Rp {{ closingPreview.todayFundFromLaci.toLocaleString('id-ID') }}</strong></span>
            </template>
            <span>•</span>
            <span>Untung: <strong class="font-mono text-emerald-700">Rp {{ closingPreview.todayProfit.toLocaleString('id-ID') }}</strong></span>
            <span>•</span>
            <span>{{ closingPreview.transactionCount }} struk</span>
          </div>

          <!-- Input Uang Fisik Laci -->
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Uang Fisik di Laci Sekarang (Rp)
              </label>
              <button
                type="button"
                @click="fillExactExpected"
                class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#0284c7] font-bold text-[11px] cursor-pointer transition-colors"
              >
                Pas (Sesuai Sistem)
              </button>
            </div>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputmode="numeric"
                v-model="actualCashInput"
                placeholder="Hitung & ketik total uang tunai di laci..."
                class="w-full h-12 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-lg font-bold font-mono text-[#0a193d] outline-hidden transition-all"
              />
            </div>

            <!-- Indikator Live Selisih Kas -->
            <div
              v-if="hasActualCashEntered"
              :class="[
                'mt-2 px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between',
                closingPreview.cashDifference === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : closingPreview.cashDifference > 0
                  ? 'bg-sky-50 border-sky-200 text-[#0284c7]'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              ]"
            >
              <span>Selisih Laci:</span>
              <span class="font-mono">
                <template v-if="closingPreview.cashDifference === 0">Pas / Cocok ✓ (Rp 0)</template>
                <template v-else-if="closingPreview.cashDifference > 0">
                  Lebih +Rp {{ closingPreview.cashDifference.toLocaleString('id-ID') }}
                </template>
                <template v-else>
                  Kurang -Rp {{ Math.abs(closingPreview.cashDifference).toLocaleString('id-ID') }}
                </template>
              </span>
            </div>
          </div>

          <!-- Catatan Tutup Buku -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Tutup Buku <span class="text-slate-400 font-medium normal-case">(opsional)</span>
            </label>
            <input
              type="text"
              v-model="closingNoteInput"
              placeholder="Misal: Uang laci disetorkan ke brankas / alasan selisih"
              class="w-full h-11 px-3.5 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs sm:text-sm font-medium text-[#0a193d] outline-hidden transition-all"
            />
          </div>

          <button
            type="submit"
            :disabled="!hasActualCashEntered"
            class="w-full h-12 rounded-2xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 shadow-sm"
          >
            <Check class="w-4 h-4 text-emerald-400" />
            <span>Tutup Buku &amp; Simpan Shift</span>
          </button>
        </form>

        <!-- ==================== MODE 3: RINGKASAN TUTUP SHIFT SELESAI ==================== -->
        <div v-else-if="completedShift" class="space-y-4">
          <div class="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">Ringkasan Tutup Buku</span>
              <span class="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200">
                {{ completedShift.shiftCode }}
              </span>
            </div>
            <p class="text-xs text-emerald-900">
              {{ formatDateTime(completedShift.openedAt) }} — {{ formatDateTime(completedShift.closedAt) }}
            </p>
          </div>

          <div class="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-500">Modal Awal Laci:</span>
              <span class="font-mono font-bold text-[#0a193d]">Rp {{ (completedShift.openingCash || 0).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Tunai Masuk Laci:</span>
              <span class="font-mono font-bold text-emerald-700">+Rp {{ ((completedShift.summary?.todayCashDrawer || 0) + (completedShift.summary?.todayCashServiceIn || 0) + (completedShift.summary?.todayFundToLaci || 0)).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Kas Keluar Laci:</span>
              <span class="font-mono font-bold text-rose-700">-Rp {{ ((completedShift.summary?.todayExpensesCash || 0) + (completedShift.summary?.todayCashServiceOut || 0) + (completedShift.summary?.todayFundFromLaci || 0)).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between pt-1.5 border-t border-slate-200">
              <span class="font-semibold text-slate-700">Seharusnya di Laci:</span>
              <span class="font-mono font-bold text-[#0a193d]">Rp {{ (completedShift.expectedCash || 0).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-semibold text-slate-700">Uang Fisik Laci:</span>
              <span class="font-mono font-bold text-[#0a193d]">Rp {{ (completedShift.actualCash || 0).toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between pt-1.5 border-t border-slate-200">
              <span class="font-bold text-slate-800">Selisih Laci:</span>
              <span
                :class="[
                  'font-mono font-bold',
                  (completedShift.cashDifference || 0) === 0
                    ? 'text-emerald-700'
                    : (completedShift.cashDifference || 0) > 0
                    ? 'text-[#0284c7]'
                    : 'text-rose-700'
                ]"
              >
                <template v-if="(completedShift.cashDifference || 0) === 0">Pas ✓ (Rp 0)</template>
                <template v-else-if="(completedShift.cashDifference || 0) > 0">
                  Lebih +Rp {{ completedShift.cashDifference.toLocaleString('id-ID') }}
                </template>
                <template v-else>
                  Kurang -Rp {{ Math.abs(completedShift.cashDifference).toLocaleString('id-ID') }}
                </template>
              </span>
            </div>
            <div v-if="(completedShift.summary?.todayQrisTotal || 0) > 0" class="flex justify-between pt-1.5 border-t border-slate-200">
              <span class="text-slate-500">QRIS (Non-Tunai):</span>
              <span class="font-mono font-bold text-[#0284c7]">Rp {{ completedShift.summary.todayQrisTotal.toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Estimasi Untung Bersih:</span>
              <span class="font-mono font-bold text-emerald-700">Rp {{ (completedShift.summary?.todayProfit || 0).toLocaleString('id-ID') }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <button
              type="button"
              @click="shareClosedShiftToWA"
              class="w-full h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
            >
              <MessageSquare class="w-4 h-4" />
              <span>Kirim Laporan Tutup Shift ke WhatsApp</span>
            </button>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="emit('startNextShift')"
                class="h-10 px-3 rounded-2xl bg-sky-50 hover:bg-sky-100 text-[#0284c7] font-bold text-xs cursor-pointer transition-colors"
              >
                Buka Shift Baru
              </button>
              <button
                type="button"
                @click="emit('close')"
                class="h-10 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
