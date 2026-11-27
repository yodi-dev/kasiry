<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  ArrowLeftRight,
  Banknote,
  Send,
  History,
  Check,
  CheckCircle,
  AlertCircle,
  Trash2,
  Receipt
} from '@lucide/vue'
import { recordBelongsToShift } from '../utils/dailyStats'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  cashServices: {
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
      isShiftScoped: false,
      openingCash: 0,
      todayNetCashDrawer: 0,
      expectedCashDrawer: 0,
      todayCashWithdrawalTotal: 0,
      todayCashTransferTotal: 0,
      todayCashServiceAdminProfit: 0
    })
  }
})

const emit = defineEmits(['close', 'recordCashService', 'deleteCashService', 'openReceipt'])

const activeTab = ref('form')
const selectedType = ref('TARIK_TUNAI')
const amountInput = ref('')
const adminFeeInput = ref('5000')
const selectedChannel = ref('QRIS')
const customChannelInput = ref('')
const customerNameInput = ref('')
const noteInput = ref('')
const autoOpenReceipt = ref(true)
const confirmingDeleteId = ref(null)
const savedRecord = ref(null)
const errorBanner = ref('')

const amountPresets = [50000, 100000, 200000, 300000, 500000, 1000000]
const adminPresets = [0, 2000, 3000, 5000, 7000, 10000]
const channelPresets = ['QRIS', 'BRI', 'BCA', 'Mandiri', 'BNI', 'DANA', 'GoPay', 'ShopeePay', 'Lainnya']

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'form'
    selectedType.value = 'TARIK_TUNAI'
    amountInput.value = ''
    adminFeeInput.value = '5000'
    selectedChannel.value = 'QRIS'
    customChannelInput.value = ''
    customerNameInput.value = ''
    noteInput.value = ''
    confirmingDeleteId.value = null
    savedRecord.value = null
    errorBanner.value = ''
  }
}, { immediate: true })

watch(selectedType, (nextType) => {
  if (nextType === 'TRANSFER' && selectedChannel.value === 'QRIS') {
    selectedChannel.value = 'BRI'
  } else if (nextType === 'TARIK_TUNAI' && selectedChannel.value === 'Lainnya' && !customChannelInput.value) {
    selectedChannel.value = 'QRIS'
  }
  errorBanner.value = ''
})

const parsedAmount = computed(() => {
  const num = parseInt(String(amountInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const parsedAdminFee = computed(() => {
  const num = parseInt(String(adminFeeInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const totalPaidByCustomer = computed(() => parsedAmount.value + parsedAdminFee.value)

const resolvedChannel = computed(() => {
  if (selectedChannel.value === 'Lainnya') {
    return customChannelInput.value.trim() || 'Transfer Bank / E-Wallet'
  }
  return selectedChannel.value
})

const availableDrawerCash = computed(() => {
  if (props.stats?.isShiftScoped) {
    return Number(props.stats.expectedCashDrawer ?? ((props.stats.openingCash || 0) + (props.stats.todayNetCashDrawer || 0)))
  }
  return Number(props.stats?.todayNetCashDrawer ?? 0)
})

const isDrawerInsufficient = computed(() => {
  if (selectedType.value !== 'TARIK_TUNAI') return false
  if (parsedAmount.value <= 0) return false
  return availableDrawerCash.value <= 0 || parsedAmount.value > availableDrawerCash.value
})

const projectedDrawerAfter = computed(() => {
  if (parsedAmount.value <= 0) return availableDrawerCash.value
  return selectedType.value === 'TRANSFER'
    ? availableDrawerCash.value + totalPaidByCustomer.value
    : availableDrawerCash.value - parsedAmount.value
})

const periodServices = computed(() => {
  if (props.activeShift && props.activeShift.status === 'OPEN') {
    return (props.cashServices || [])
      .filter(s => s && !s.deleted && recordBelongsToShift(s, props.activeShift, 'createdAt'))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const cutoff = startOfDay.getTime()
  return (props.cashServices || [])
    .filter(s => s && !s.deleted && (s.createdAt || 0) >= cutoff)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const handleSubmit = () => {
  errorBanner.value = ''
  if (parsedAmount.value <= 0) {
    errorBanner.value = 'Masukkan nominal layanan lebih dari Rp 0.'
    return
  }
  if (isDrawerInsufficient.value) {
    errorBanner.value = `Uang tunai di laci tidak cukup (tersedia Rp ${Math.max(0, availableDrawerCash.value).toLocaleString('id-ID')}).`
    return
  }

  const payload = {
    type: selectedType.value,
    amount: parsedAmount.value,
    adminFee: parsedAdminFee.value,
    channel: resolvedChannel.value,
    customerName: customerNameInput.value.trim(),
    cashSource: 'LACI',
    note: noteInput.value.trim(),
    openReceipt: autoOpenReceipt.value
  }

  emit('recordCashService', payload)
  savedRecord.value = {
    ...payload,
    totalPaid: totalPaidByCustomer.value
  }

  amountInput.value = ''
  customerNameInput.value = ''
  noteInput.value = ''

  setTimeout(() => {
    savedRecord.value = null
  }, 3000)
}

const triggerDelete = (id) => {
  if (confirmingDeleteId.value === id) {
    emit('deleteCashService', id)
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
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">

      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <ArrowLeftRight class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              Tarik Tunai &amp; Transfer
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ activeShift ? `Shift ${activeShift.shiftCode} • Sumber Uang: Laci Kasir` : 'Hitung Harian • Sumber Uang: Laci Kasir' }}
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
        <div class="p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1">
          <button
            type="button"
            @click="activeTab = 'form'"
            :class="[
              'h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'form' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Banknote class="w-4 h-4 shrink-0" />
            <span>Catat Layanan</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'history'"
            :class="[
              'h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'history' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <History class="w-4 h-4 shrink-0" />
            <span>Riwayat ({{ periodServices.length }})</span>
          </button>
        </div>
      </div>

      <!-- 3. Body -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

        <!-- Banner Sisa Tunai di Laci & Jasa Admin -->
        <div class="grid grid-cols-2 gap-2.5">
          <div
            :class="[
              'min-w-0 p-3 rounded-2xl border',
              availableDrawerCash > 0 ? 'bg-sky-50/75 border-sky-200/75' : 'bg-amber-50/85 border-amber-200'
            ]"
          >
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              {{ activeShift ? 'Uang Tunai di Laci' : 'Tunai Masuk Hari Ini' }}
            </span>
            <p
              :class="[
                'text-base sm:text-lg font-bold font-mono mt-0.5 break-words',
                availableDrawerCash > 0 ? 'text-[#0a193d]' : 'text-amber-800'
              ]"
            >
              Rp {{ availableDrawerCash.toLocaleString('id-ID') }}
            </p>
          </div>

          <div class="min-w-0 p-3 rounded-2xl bg-emerald-50/75 border border-emerald-200/75">
            <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Laba Jasa Admin</span>
            <p class="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-0.5 break-words">
              +Rp {{ (stats.todayCashServiceAdminProfit || 0).toLocaleString('id-ID') }}
            </p>
          </div>
        </div>

        <!-- TAB 1: FORM LAYANAN -->
        <template v-if="activeTab === 'form'">
          <div
            v-if="savedRecord"
            class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {{ savedRecord.type === 'TRANSFER' ? 'Transfer / Top-Up' : 'Tarik Tunai' }} Rp {{ savedRecord.amount.toLocaleString('id-ID') }} (+admin Rp {{ savedRecord.adminFee.toLocaleString('id-ID') }}) berhasil dicatat!
            </span>
          </div>

          <div
            v-if="errorBanner"
            class="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{{ errorBanner }}</span>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Pilih Jenis Layanan -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Jenis Layanan
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="selectedType = 'TARIK_TUNAI'"
                  :class="[
                    'p-3 rounded-2xl border-2 text-left cursor-pointer transition-all',
                    selectedType === 'TARIK_TUNAI'
                      ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                  ]"
                >
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-xs font-bold">Tarik Tunai</span>
                    <Banknote :class="['w-4 h-4', selectedType === 'TARIK_TUNAI' ? 'text-sky-400' : 'text-slate-400']" />
                  </div>
                  <p :class="['text-[11px] mt-1 leading-snug', selectedType === 'TARIK_TUNAI' ? 'text-sky-200' : 'text-slate-500']">
                    Transfer/QRIS masuk, tunai keluar laci
                  </p>
                </button>

                <button
                  type="button"
                  @click="selectedType = 'TRANSFER'"
                  :class="[
                    'p-3 rounded-2xl border-2 text-left cursor-pointer transition-all',
                    selectedType === 'TRANSFER'
                      ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                  ]"
                >
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-xs font-bold">Transfer / Top-Up</span>
                    <Send :class="['w-4 h-4', selectedType === 'TRANSFER' ? 'text-emerald-400' : 'text-slate-400']" />
                  </div>
                  <p :class="['text-[11px] mt-1 leading-snug', selectedType === 'TRANSFER' ? 'text-sky-200' : 'text-slate-500']">
                    Tunai masuk laci, saldo dikirim
                  </p>
                </button>
              </div>
            </div>

            <!-- Input Nominal Pokok -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nominal Pokok ({{ selectedType === 'TARIK_TUNAI' ? 'Uang Tunai Diambil' : 'Saldo Dikirim' }})
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputmode="numeric"
                  v-model="amountInput"
                  placeholder="Contoh: 100000"
                  class="w-full h-12 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-lg font-bold font-mono text-[#0a193d] outline-hidden transition-all"
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

            <!-- Guard Saldo Laci Kurang -->
            <div
              v-if="isDrawerInsufficient"
              class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div class="space-y-0.5 leading-snug">
                <p class="font-bold">Uang tunai di laci tidak cukup untuk Tarik Tunai ini.</p>
                <p>
                  Tersedia di laci: <strong class="font-mono">Rp {{ Math.max(0, availableDrawerCash).toLocaleString('id-ID') }}</strong>.
                  Buka Shift / isi modal awal laci atau catat penjualan tunai dulu.
                </p>
              </div>
            </div>

            <!-- Biaya Admin (Cara A) -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Biaya Admin Jasa (Laba Toko)
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div class="relative sm:col-span-5">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputmode="numeric"
                    v-model="adminFeeInput"
                    placeholder="5000"
                    class="w-full h-11 pl-9 pr-3 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-2xl text-sm font-bold font-mono text-[#0a193d] outline-hidden transition-all"
                  />
                </div>
                <div class="sm:col-span-7 flex flex-wrap gap-1.5">
                  <button
                    v-for="adm in adminPresets"
                    :key="adm"
                    type="button"
                    @click="adminFeeInput = String(adm)"
                    :class="[
                      'px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono cursor-pointer transition-colors border',
                      parsedAdminFee === adm
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border-slate-200/70'
                    ]"
                  >
                    {{ adm === 0 ? 'Rp 0' : `${adm / 1000}rb` }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Channel / Bank / E-Wallet -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Channel / Bank / E-Wallet
              </label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="ch in channelPresets"
                  :key="ch"
                  type="button"
                  @click="selectedChannel = ch"
                  :class="[
                    'px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border',
                    selectedChannel === ch
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  {{ ch }}
                </button>
              </div>
              <input
                v-if="selectedChannel === 'Lainnya'"
                type="text"
                v-model="customChannelInput"
                placeholder="Nama bank / e-wallet (misal: SeaBank, BSI, LinkAja)"
                class="mt-2 w-full h-10 px-3.5 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-medium text-[#0a193d] outline-hidden transition-all"
              />
            </div>

            <!-- Customer & Catatan -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Nama Pelanggan <span class="text-slate-400 font-medium normal-case">(opsional)</span>
                </label>
                <input
                  type="text"
                  v-model="customerNameInput"
                  placeholder="Misal: Bu Sari"
                  class="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-medium text-[#0a193d] outline-hidden"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Catatan / No. Tujuan <span class="text-slate-400 font-medium normal-case">(opsional)</span>
                </label>
                <input
                  type="text"
                  v-model="noteInput"
                  placeholder="Misal: BRI 0812xxx / a.n Budi"
                  class="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-medium text-[#0a193d] outline-hidden"
                />
              </div>
            </div>

            <!-- Ringkasan Live Aliran Dana (Cara A) -->
            <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div class="flex justify-between text-slate-600">
                <span>{{ selectedType === 'TARIK_TUNAI' ? 'Pelanggan Transfer / QRIS:' : 'Pelanggan Bayar Tunai ke Laci:' }}</span>
                <span class="font-bold font-mono text-[#0a193d]">Rp {{ totalPaidByCustomer.toLocaleString('id-ID') }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>{{ selectedType === 'TARIK_TUNAI' ? 'Uang Tunai Keluar Dari Laci:' : 'Saldo Dikirim Toko:' }}</span>
                <span class="font-bold font-mono">Rp {{ parsedAmount.toLocaleString('id-ID') }}</span>
              </div>
              <div class="flex justify-between text-emerald-700 font-semibold">
                <span>Keuntungan Biaya Admin:</span>
                <span class="font-mono">+Rp {{ parsedAdminFee.toLocaleString('id-ID') }}</span>
              </div>
              <div class="pt-1.5 border-t border-slate-200/80 flex justify-between font-bold text-[#0a193d]">
                <span>Perkiraan Sisa Laci Setelah Transaksi:</span>
                <span class="font-mono">Rp {{ projectedDrawerAfter.toLocaleString('id-ID') }}</span>
              </div>
            </div>

            <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="autoOpenReceipt"
                class="rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7]"
              />
              <span>Tampilkan struk bukti transaksi setelah disimpan (bisa cetak thermal / WA)</span>
            </label>

            <button
              type="submit"
              :disabled="parsedAmount <= 0 || isDrawerInsufficient"
              class="w-full h-12 rounded-2xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 shadow-sm"
            >
              <Check class="w-4 h-4 text-sky-400" />
              <span>
                {{ selectedType === 'TRANSFER' ? 'Simpan Transfer / Top-Up' : 'Simpan Tarik Tunai' }}
              </span>
            </button>
          </form>
        </template>

        <!-- TAB 2: RIWAYAT LAYANAN -->
        <template v-else>
          <div
            v-if="periodServices.length === 0"
            class="p-8 rounded-2xl bg-slate-50 border border-slate-200/70 text-center text-slate-400 text-xs"
          >
            <ArrowLeftRight class="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p class="font-bold text-slate-500">Belum ada transaksi tarik tunai atau transfer</p>
            <p class="mt-0.5 text-[11px]">Catatan dari tab Catat Layanan akan langsung tersimpan di sini.</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="svc in periodServices"
              :key="svc.id"
              class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start justify-between gap-3"
            >
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border',
                      svc.type === 'TRANSFER'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-sky-50 text-[#0284c7] border-sky-200'
                    ]"
                  >
                    {{ svc.type === 'TRANSFER' ? 'Transfer / Top-Up' : 'Tarik Tunai' }}
                  </span>
                  <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {{ svc.channel || 'QRIS' }}
                  </span>
                  <span class="text-[11px] font-mono text-slate-400">
                    {{ svc.serviceNumber }} • {{ formatTime(svc.createdAt) }}
                  </span>
                </div>

                <p class="text-xs sm:text-sm font-bold text-[#0a193d]">
                  Pokok Rp {{ Number(svc.amount || 0).toLocaleString('id-ID') }}
                  <span class="text-emerald-700 font-semibold text-xs">
                    (+Admin Rp {{ Number(svc.adminFee || 0).toLocaleString('id-ID') }})
                  </span>
                </p>

                <p v-if="svc.customerName || svc.note" class="text-[11px] text-slate-500 truncate">
                  {{ [svc.customerName, svc.note].filter(Boolean).join(' • ') }}
                </p>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click="emit('openReceipt', svc)"
                  class="h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284c7] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  title="Lihat & Cetak Struk"
                >
                  <Receipt class="w-3.5 h-3.5" />
                  <span class="hidden sm:inline">Struk</span>
                </button>

                <button
                  type="button"
                  @click="triggerDelete(svc.id)"
                  :class="[
                    'h-8 px-2.5 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors border',
                    confirmingDeleteId === svc.id
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200'
                  ]"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span v-if="confirmingDeleteId === svc.id">Hapus?</span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
