<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  Wallet,
  Check,
  CheckCircle,
  Clock,
  Trash2,
  Receipt
} from '@lucide/vue'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SOURCES,
  getExpenseCategoryMeta,
  getExpenseSourceMeta
} from '../utils/expenseConstants'
import { recordBelongsToShift } from '../utils/dailyStats'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  expenses: {
    type: Array,
    default: () => []
  },
  activeShift: {
    type: Object,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({
      todayCashDrawer: 0,
      todayNetCashDrawer: 0,
      todayExpensesCash: 0,
      todayExpensesNonCash: 0,
      todayExpensesTotal: 0
    })
  }
})

const emit = defineEmits(['close', 'recordExpense', 'deleteExpense'])

const selectedCategory = ref('operasional')
const selectedSource = ref('TUNAI_LACI')
const amountInput = ref('')
const noteInput = ref('')
const savedBanner = ref(false)
const confirmingDeleteId = ref(null)

const quickAmounts = [5000, 10000, 20000, 50000, 100000]

watch(() => props.isOpen, (open) => {
  if (open) {
    selectedCategory.value = 'operasional'
    selectedSource.value = 'TUNAI_LACI'
    amountInput.value = ''
    noteInput.value = ''
    savedBanner.value = false
    confirmingDeleteId.value = null
  }
}, { immediate: true })

const parsedAmount = computed(() => {
  const num = parseInt(String(amountInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const todayExpenses = computed(() => {
  if (props.activeShift && props.activeShift.status === 'OPEN') {
    return (props.expenses || [])
      .filter(e => e && !e.deleted && recordBelongsToShift(e, props.activeShift, 'createdAt'))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const cutoff = startOfDay.getTime()
  return (props.expenses || [])
    .filter(e => e && !e.deleted && (e.createdAt || 0) >= cutoff)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const netDrawerDisplay = computed(() => {
  if (props.stats?.todayNetCashDrawer !== undefined) {
    return props.stats.todayNetCashDrawer
  }
  return (props.stats?.todayCashDrawer || 0) - (props.stats?.todayExpensesCash || 0)
})

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const submitExpense = () => {
  if (parsedAmount.value <= 0) return

  emit('recordExpense', {
    amount: parsedAmount.value,
    category: selectedCategory.value,
    source: selectedSource.value,
    note: noteInput.value.trim()
  })

  amountInput.value = ''
  noteInput.value = ''
  savedBanner.value = true
  setTimeout(() => {
    savedBanner.value = false
  }, 2200)
}

const confirmDelete = (id) => {
  emit('deleteExpense', id)
  confirmingDeleteId.value = null
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg md:max-w-2xl lg:max-w-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Wallet class="w-5 h-5 text-amber-400" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Catatan Kas Keluar</h3>
            <p class="text-xs text-slate-500 font-medium leading-snug">Pengeluaran operasional warung &amp; tarik kas laci</p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 2. KPI Strip (min-w-0 agar bebas terpotong) -->
      <div class="px-5 py-3 bg-slate-50/90 border-b border-slate-100 grid grid-cols-2 gap-2.5 sm:gap-3 shrink-0">
        <div
          :class="[
            'min-w-0 p-3 sm:p-3.5 rounded-2xl border shadow-2xs',
            netDrawerDisplay < 0 ? 'bg-rose-50 border-rose-200/80' : 'bg-white border-slate-200/80'
          ]"
        >
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Sisa Tunai Laci
          </span>
          <p
            :class="[
              'text-lg sm:text-xl font-bold font-mono mt-0.5 leading-tight break-words',
              netDrawerDisplay < 0 ? 'text-rose-700' : 'text-[#0a193d]'
            ]"
          >
            Rp {{ netDrawerDisplay.toLocaleString('id-ID') }}
          </p>
          <p class="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
            Masuk Rp {{ (stats.todayCashDrawer || 0).toLocaleString('id-ID') }} - Keluar Rp {{ (stats.todayExpensesCash || 0).toLocaleString('id-ID') }}
          </p>
        </div>

        <div class="min-w-0 p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-2xs">
          <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            Keluar Hari Ini
          </span>
          <p class="text-lg sm:text-xl font-bold font-mono text-amber-900 mt-0.5 leading-tight break-words">
            Rp {{ (stats.todayExpensesTotal || 0).toLocaleString('id-ID') }}
          </p>
          <p class="text-[11px] text-amber-800 font-medium mt-0.5 leading-snug">
            {{ todayExpenses.length }} catatan ({{ (stats.todayExpensesNonCash || 0) > 0 ? `Non-Tunai Rp ${stats.todayExpensesNonCash.toLocaleString('id-ID')}` : 'Semua dari laci' }})
          </p>
        </div>
      </div>

      <!-- 3. Scrollable Body (Responsive 2 kolom di Tablet/Laptop) -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          <!-- Kolom Kiri: Form Tambah Pengeluaran -->
          <form @submit.prevent="submitExpense" class="md:col-span-6 space-y-4">
            <div
              v-if="savedBanner"
              class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2"
            >
              <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Pengeluaran tercatat &amp; saldo laci diperbarui!</span>
            </div>

            <!-- 1. Kategori Cepat -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Jenis Pengeluaran
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="cat in EXPENSE_CATEGORIES"
                  :key="cat.id"
                  type="button"
                  @click="selectedCategory = cat.id"
                  :class="[
                    'p-2.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-98',
                    selectedCategory === cat.id
                      ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                      : 'bg-slate-50 hover:bg-white text-[#0a193d] border-slate-200/90'
                  ]"
                >
                  <span class="text-xs font-bold block leading-tight">{{ cat.label }}</span>
                  <span
                    :class="[
                      'text-[10px] block mt-0.5 leading-snug',
                      selectedCategory === cat.id ? 'text-sky-200' : 'text-slate-500'
                    ]"
                  >
                    {{ cat.hint }}
                  </span>
                </button>
              </div>
            </div>

            <!-- 2. Sumber Dana -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sumber Uang
              </label>
              <div class="p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1">
                <button
                  v-for="src in EXPENSE_SOURCES"
                  :key="src.id"
                  type="button"
                  @click="selectedSource = src.id"
                  :class="[
                    'h-9 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    selectedSource === src.id
                      ? 'bg-white text-[#0a193d] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  ]"
                >
                  {{ src.label }}
                </button>
              </div>
            </div>

            <!-- 3. Nominal Keluar -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nominal Keluar (Rp)
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputmode="numeric"
                  v-model="amountInput"
                  placeholder="0"
                  class="w-full h-12 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-lg font-bold font-mono text-[#0a193d] outline-hidden transition-all"
                />
              </div>

              <!-- Tombol Nominal Cepat -->
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="q in quickAmounts"
                  :key="q"
                  type="button"
                  @click="amountInput = String(q)"
                  class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-[#0284c7] text-slate-700 text-xs font-bold font-mono cursor-pointer transition-colors"
                >
                  {{ (q / 1000).toLocaleString('id-ID') }}rb
                </button>
              </div>
            </div>

            <!-- 4. Keterangan Opsional -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan / Keterangan <span class="text-slate-400 font-medium normal-case">(opsional)</span>
              </label>
              <input
                type="text"
                v-model="noteInput"
                placeholder="Misal: Beli isi galon / plastik kresek"
                class="w-full h-11 px-3.5 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs sm:text-sm font-medium text-[#0a193d] outline-hidden transition-all"
              />
            </div>

            <button
              type="submit"
              :disabled="parsedAmount <= 0"
              class="w-full h-12 rounded-2xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 shadow-sm"
            >
              <Check class="w-4 h-4 text-amber-400" />
              <span>Simpan Kas Keluar</span>
            </button>
          </form>

          <!-- Kolom Kanan: Daftar Pengeluaran Hari Ini -->
          <div class="md:col-span-6 space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt class="w-4 h-4 text-amber-600" />
                <span>Daftar Keluar Hari Ini</span>
              </h4>
              <span class="text-[11px] font-bold text-slate-500 font-mono">
                {{ todayExpenses.length }} item
              </span>
            </div>

            <div
              v-if="todayExpenses.length === 0"
              class="p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center space-y-1.5"
            >
              <Wallet class="w-8 h-8 mx-auto text-slate-300" />
              <p class="text-xs font-semibold text-slate-500">Belum ada pengeluaran hari ini</p>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Catat pembelian plastik, galon, bensin, atau tarik tunai owner di sini agar sisa laci tetap akurat.
              </p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="exp in todayExpenses"
                :key="exp.id || exp.expenseNumber"
                class="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="font-mono font-bold text-[11px] text-[#0a193d]">
                        {{ exp.expenseNumber }}
                      </span>
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

                  <div class="text-right shrink-0 space-y-1">
                    <p class="font-mono font-bold text-sm text-rose-700">
                      -Rp {{ Number(exp.amount || 0).toLocaleString('id-ID') }}
                    </p>
                    <p class="text-[11px] text-slate-400 font-mono flex items-center justify-end gap-1">
                      <Clock class="w-3 h-3" />
                      <span>{{ formatTime(exp.createdAt) }}</span>
                    </p>
                  </div>
                </div>

                <!-- Hapus Konfirmasi 2-Langkah -->
                <div v-if="confirmingDeleteId === exp.id" class="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span class="text-rose-700 font-semibold">Hapus catatan keluar ini?</span>
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
                      @click="confirmDelete(exp.id)"
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
                    :aria-label="`Hapus ${exp.expenseNumber}`"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Footer -->
      <div class="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-slate-500 font-medium">
          Tarik / Setor Owner tidak mengurangi estimasi untung jualan
        </span>
        <button
          type="button"
          @click="emit('close')"
          class="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
