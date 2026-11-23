<script setup>
import { ref, computed, watch } from 'vue'
import { X, CheckCircle, Banknote, UserCheck, Plus, AlertCircle, CreditCard } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  savedCustomers: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'processCashPayment', 'processDebtPayment'])

// Active Tab: 'cash' | 'debt'
const activeTab = ref('cash')

// Cash Mode State
const cashGiven = ref(0)
const cashInputStr = ref('')

// Debt Mode State
const customerQuery = ref('')
const selectedCustomer = ref(null)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    activeTab.value = 'cash'
    cashGiven.value = props.totalAmount
    cashInputStr.value = String(props.totalAmount)
    selectedCustomer.value = null
    customerQuery.value = ''
  }
})

// Pecahan uang kertas standar
const standardBills = [2000, 5000, 10000, 20000, 50000, 100000]

// Hitung saran pembulatan ke atas
const roundedSuggestions = computed(() => {
  const tot = props.totalAmount
  const suggestions = []
  if (tot <= 0) return []

  const next10k = Math.ceil(tot / 10000) * 10000
  if (next10k > tot && !suggestions.includes(next10k)) suggestions.push(next10k)

  const next20k = Math.ceil(tot / 20000) * 20000
  if (next20k > tot && !suggestions.includes(next20k)) suggestions.push(next20k)

  const next50k = Math.ceil(tot / 50000) * 50000
  if (next50k > tot && !suggestions.includes(next50k)) suggestions.push(next50k)

  const next100k = Math.ceil(tot / 100000) * 100000
  if (next100k > tot && !suggestions.includes(next100k)) suggestions.push(next100k)

  return suggestions.slice(0, 3)
})

// Hitung Uang Kembalian
const changeAmount = computed(() => {
  return Math.max(0, cashGiven.value - props.totalAmount)
})

const isCashSufficient = computed(() => {
  return cashGiven.value >= props.totalAmount
})

// Set Cash
const setExactCash = () => {
  cashGiven.value = props.totalAmount
  cashInputStr.value = String(props.totalAmount)
}

const setCashAmount = (amount) => {
  cashGiven.value = amount
  cashInputStr.value = String(amount)
}

const addCash = (amount) => {
  cashGiven.value += amount
  cashInputStr.value = String(cashGiven.value)
}

const onManualCashInput = (e) => {
  const num = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
  cashGiven.value = num
  cashInputStr.value = num > 0 ? String(num) : ''
}

// Filter pelanggan di mode utang
const filteredCustomers = computed(() => {
  const q = customerQuery.value.trim().toLowerCase()
  if (!q) return props.savedCustomers
  return props.savedCustomers.filter(c => c.name.toLowerCase().includes(q))
})

const selectCustomer = (c) => {
  selectedCustomer.value = c
  customerQuery.value = c.name
}

const createAndSelectCustomer = () => {
  const newName = customerQuery.value.trim()
  if (!newName) return
  const newCust = { id: Date.now(), name: newName, totalDebt: 0, phone: '' }
  selectedCustomer.value = newCust
}

// Konfirmasi Pembayaran
const submitPayment = () => {
  if (activeTab.value === 'cash') {
    if (!isCashSufficient.value) return
    emit('processCashPayment', {
      totalAmount: props.totalAmount,
      cashGiven: cashGiven.value,
      changeAmount: changeAmount.value
    })
  } else {
    if (!selectedCustomer.value && !customerQuery.value.trim()) return
    const cust = selectedCustomer.value || {
      id: Date.now(),
      name: customerQuery.value.trim(),
      phone: '',
      totalDebt: 0
    }
    emit('processDebtPayment', {
      totalAmount: props.totalAmount,
      customer: cust
    })
  }
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
      <!-- Modal Header (Design System: Deep Navy & Clean Subtitle) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-slate-100 text-[#0a193d] flex items-center justify-center border border-slate-200/80">
            <CreditCard class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Metode Pembayaran</h3>
            <p class="text-xs text-slate-500 font-medium">Pilih bayar tunai atau catat ke buku utang</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher: Segmented Pill Control Modern -->
      <div class="px-5 pt-3.5 pb-1 shrink-0">
        <div class="p-1 bg-slate-100 rounded-2xl flex gap-1">
          <button 
            @click="activeTab = 'cash'"
            :class="[
              'flex-1 h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all',
              activeTab === 'cash' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Banknote class="w-4 h-4" />
            <span>Bayar Tunai</span>
          </button>

          <button 
            @click="activeTab = 'debt'"
            :class="[
              'flex-1 h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all',
              activeTab === 'debt' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <UserCheck class="w-4 h-4" />
            <span>Utang / Bon</span>
          </button>
        </div>
      </div>

      <!-- Total Tagihan Banner (Design System: Midnight Deep Navy & Sky Accent) -->
      <div class="mx-5 my-2.5 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#0a193d] text-white flex items-center justify-between shadow-xs shrink-0">
        <div>
          <span class="text-xs font-bold text-sky-300 uppercase tracking-wider block">Total Tagihan</span>
        </div>
        <div class="text-right">
          <span class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
            Rp {{ totalAmount.toLocaleString('id-ID') }}
          </span>
        </div>
      </div>

      <!-- Modal Body Scrollable -->
      <div class="flex-1 overflow-y-auto">
        <!-- TAB 1: MODE TUNAI -->
        <div v-if="activeTab === 'cash'" class="px-5 py-2 space-y-3.5">
          <!-- Input Nominal Diterima -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Uang Diterima dari Pembeli:
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-4 flex items-center font-bold text-slate-400 text-base">Rp</span>
              <input 
                type="text" 
                :value="cashInputStr ? parseInt(cashInputStr).toLocaleString('id-ID') : ''"
                @input="onManualCashInput"
                placeholder="0"
                class="w-full h-13 pl-12 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/15 rounded-2xl text-xl sm:text-2xl font-bold text-[#0a193d] outline-hidden transition-all text-right font-mono"
              />
            </div>
          </div>

          <!-- Tombol Uang Pas & Pembulatan Terdekat -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- Uang Pas -->
            <button 
              @click="setExactCash"
              class="h-11 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200/80 cursor-pointer transition-all active:scale-95 shadow-2xs flex items-center justify-center gap-1.5"
            >
              <span>Uang Pas</span>
            </button>

            <!-- Saran Pembulatan -->
            <button 
              v-for="sug in roundedSuggestions" 
              :key="sug"
              @click="setCashAmount(sug)"
              class="h-11 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              Rp {{ (sug / 1000) }}rb
            </button>
          </div>

          <!-- Pecahan Nominal Uang Standar Rupiah -->
          <div>
            <p class="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tambah Pecahan Uang Kertas:</p>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button 
                v-for="bill in standardBills" 
                :key="bill"
                @click="addCash(bill)"
                class="h-10 bg-slate-100 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 text-slate-800 font-bold text-xs rounded-xl cursor-pointer border border-transparent transition-all active:scale-95 font-mono"
              >
                +{{ bill >= 1000 ? `${bill/1000}rb` : bill }}
              </button>
            </div>
          </div>

          <!-- Display Uang Kembalian -->
          <div 
            :class="[
              'p-4 rounded-2xl border transition-all flex items-center justify-between',
              isCashSufficient 
                ? 'bg-emerald-50/70 border-emerald-200/80' 
                : 'bg-rose-50/70 border-rose-200/80'
            ]"
          >
            <div>
              <p :class="['text-xs font-bold uppercase tracking-wider', isCashSufficient ? 'text-emerald-800' : 'text-rose-700']">
                {{ isCashSufficient ? 'Uang Kembalian:' : 'Uang Masih Kurang:' }}
              </p>
            </div>
            <div class="text-right">
              <p 
                :class="[
                  'text-2xl sm:text-3xl font-extrabold font-mono', 
                  isCashSufficient ? 'text-emerald-700' : 'text-rose-600'
                ]"
              >
                Rp {{ isCashSufficient ? changeAmount.toLocaleString('id-ID') : (totalAmount - cashGiven).toLocaleString('id-ID') }}
              </p>
            </div>
          </div>
        </div>

        <!-- TAB 2: MODE UTANG / BON -->
        <div v-else class="px-5 py-2 space-y-3.5">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Nama Pelanggan:
            </label>
            <input 
              type="text" 
              v-model="customerQuery"
              placeholder="Ketik nama pelanggan..."
              class="w-full h-12 px-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/15 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
            />
          </div>

          <!-- Tombol Tambah Pelanggan Baru -->
          <div v-if="customerQuery.trim() && !selectedCustomer" class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div class="text-xs text-slate-700 font-medium">
              Nama baru: <strong class="text-[#0a193d]">{{ customerQuery }}</strong>
            </div>
            <button 
              @click="createAndSelectCustomer"
              class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5" /> Pilih Nama Ini
            </button>
          </div>

          <!-- Daftar Pelanggan Tersimpan -->
          <div>
            <p class="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Pilih Pelanggan Tersimpan:</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              <button 
                v-for="c in filteredCustomers" 
                :key="c.id"
                @click="selectCustomer(c)"
                :class="[
                  'p-3 text-left rounded-2xl border cursor-pointer transition-all flex items-center justify-between',
                  selectedCustomer?.id === c.id 
                    ? 'border-[#0a193d] bg-sky-50/50 font-bold text-[#0a193d] ring-2 ring-[#0a193d]/10' 
                    : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700'
                ]"
              >
                <div class="min-w-0 pr-1">
                  <p class="text-xs font-bold truncate">{{ c.name }}</p>
                  <p class="text-[11px] text-red-600 font-semibold mt-0.5">
                    Sisa Bon: Rp {{ (c.totalDebt || 0).toLocaleString('id-ID') }}
                  </p>
                </div>
                <CheckCircle v-if="selectedCustomer?.id === c.id" class="w-4 h-4 text-[#0284c7] shrink-0" />
              </button>
            </div>
          </div>

          <!-- Catatan Transaksi Utang -->
          <div class="p-3 bg-red-50/60 rounded-2xl border border-red-100 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-red-600" />
            <span>Tagihan <strong>Rp {{ totalAmount.toLocaleString('id-ID') }}</strong> akan dicatat ke buku bon pelanggan.</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons Modal Footer -->
      <div class="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
        <button 
          @click="emit('close')"
          class="h-12 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
        >
          Batal
        </button>

        <button 
          :disabled="activeTab === 'cash' ? !isCashSufficient : (!selectedCustomer && !customerQuery.trim())"
          @click="submitPayment"
          class="flex-1 h-12 px-6 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <CheckCircle class="w-4 h-4 text-sky-400" />
          <span>{{ activeTab === 'cash' ? 'Selesaikan Pembayaran' : 'Catat ke Buku Utang' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

