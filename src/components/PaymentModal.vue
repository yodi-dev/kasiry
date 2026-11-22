<script setup>
import { ref, computed, watch } from 'vue'
import { X, CheckCircle, Banknote, UserCheck, Plus, AlertCircle } from '@lucide/vue'

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
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header (Design System: Deep Navy & Clean Subtitle) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 class="text-base font-bold text-[#0a193d] leading-tight">Metode Pembayaran</h3>
          <p class="text-xs text-slate-500 font-medium mt-0.5">Pilih bayar tunai atau catat ke buku utang</p>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher: Tunai vs Utang/Bon (Minimalis) -->
      <div class="px-5 pt-3 pb-2 flex gap-2">
        <button 
          @click="activeTab = 'cash'"
          :class="[
            'flex-1 h-10 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border',
            activeTab === 'cash' 
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          ]"
        >
          <Banknote class="w-4 h-4" />
          <span>Tunai</span>
        </button>

        <button 
          @click="activeTab = 'debt'"
          :class="[
            'flex-1 h-10 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border',
            activeTab === 'debt' 
              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          ]"
        >
          <UserCheck class="w-4 h-4" />
          <span>Utang / Bon</span>
        </button>
      </div>

      <!-- Total Belanja Banner (Neutral Slate) -->
      <div class="mx-5 my-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Tagihan:</span>
        <span class="text-xl sm:text-2xl font-bold text-slate-900">
          Rp {{ totalAmount.toLocaleString('id-ID') }}
        </span>
      </div>

      <!-- TAB 1: MODE TUNAI -->
      <div v-if="activeTab === 'cash'" class="px-5 py-3 space-y-3.5">
        <!-- Input Nominal Diterima -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            Uang Diterima dari Pembeli:
          </label>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center font-medium text-slate-400 text-sm">Rp</span>
            <input 
              type="text" 
              :value="cashInputStr ? parseInt(cashInputStr).toLocaleString('id-ID') : ''"
              @input="onManualCashInput"
              placeholder="0"
              class="w-full h-12 pl-10 pr-3.5 bg-white border border-slate-300 focus:border-emerald-600 rounded-xl text-lg sm:text-xl font-semibold text-slate-900 outline-hidden transition-all text-right"
            />
          </div>
        </div>

        <!-- Tombol Uang Pas & Pembulatan Terdekat -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <!-- Uang Pas -->
          <button 
            @click="setExactCash"
            class="h-10 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg border border-emerald-200/80 cursor-pointer transition-colors"
          >
            Uang Pas
          </button>

          <!-- Saran Pembulatan -->
          <button 
            v-for="sug in roundedSuggestions" 
            :key="sug"
            @click="setCashAmount(sug)"
            class="h-10 px-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer transition-colors"
          >
            Rp {{ (sug / 1000) }}rb
          </button>
        </div>

        <!-- Pecahan Nominal Uang Standar Rupiah -->
        <div>
          <p class="text-[11px] font-medium text-slate-500 mb-1.5 uppercase">Tambah Pecahan Uang:</p>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button 
              v-for="bill in standardBills" 
              :key="bill"
              @click="addCash(bill)"
              class="h-9 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg cursor-pointer border border-slate-200/80 transition-colors"
            >
              +{{ bill >= 1000 ? `${bill/1000}rb` : bill }}
            </button>
          </div>
        </div>

        <!-- Display Uang Kembalian -->
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500">Uang Kembalian</p>
            <p v-if="!isCashSufficient" class="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5" /> Kurang Rp {{ (totalAmount - cashGiven).toLocaleString('id-ID') }}
            </p>
          </div>
          <div class="text-right">
            <p :class="['text-xl sm:text-2xl font-bold', isCashSufficient ? 'text-emerald-700' : 'text-slate-400']">
              Rp {{ changeAmount.toLocaleString('id-ID') }}
            </p>
          </div>
        </div>
      </div>

      <!-- TAB 2: MODE UTANG / BON -->
      <div v-else class="px-5 py-3 space-y-3.5">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            Nama Pelanggan yang Berutang:
          </label>
          <input 
            type="text" 
            v-model="customerQuery"
            placeholder="Ketik nama pelanggan..."
            class="w-full h-11 px-3 bg-white border border-slate-300 focus:border-slate-800 rounded-xl text-sm font-medium text-slate-900 outline-hidden transition-all"
          />
        </div>

        <!-- Tombol Tambah Pelanggan Baru -->
        <div v-if="customerQuery.trim() && !selectedCustomer" class="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div class="text-xs text-slate-700 font-normal">
            Nama baru: <strong class="text-slate-900">{{ customerQuery }}</strong>
          </div>
          <button 
            @click="createAndSelectCustomer"
            class="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus class="w-3.5 h-3.5" /> Pilih Nama Ini
          </button>
        </div>

        <!-- Daftar Pelanggan Tersimpan -->
        <div>
          <p class="text-[11px] font-medium text-slate-500 mb-1.5 uppercase">Pelanggan Tersimpan:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
            <button 
              v-for="c in filteredCustomers" 
              :key="c.id"
              @click="selectCustomer(c)"
              :class="[
                'p-2.5 text-left rounded-xl border cursor-pointer transition-all flex items-center justify-between',
                selectedCustomer?.id === c.id 
                  ? 'border-slate-900 bg-slate-50 font-semibold text-slate-900' 
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              ]"
            >
              <div class="min-w-0 pr-1">
                <p class="text-xs font-medium truncate">{{ c.name }}</p>
                <p class="text-[10px] text-red-600 font-normal mt-0.5">
                  Sisa Utang: Rp {{ c.totalDebt.toLocaleString('id-ID') }}
                </p>
              </div>
              <CheckCircle v-if="selectedCustomer?.id === c.id" class="w-4 h-4 text-emerald-700 shrink-0" />
            </button>
          </div>
        </div>

        <!-- Catatan Transaksi Utang -->
        <p class="text-xs text-slate-500 font-normal">
          Transaksi ini akan menambahkan tagihan sebesar <strong>Rp {{ totalAmount.toLocaleString('id-ID') }}</strong> ke buku utang.
        </p>
      </div>

      <!-- Action Buttons Modal -->
      <div class="p-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-end gap-2">
        <button 
          @click="emit('close')"
          class="h-11 px-4 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm rounded-xl border border-slate-200 cursor-pointer transition-colors"
        >
          Batal
        </button>

        <button 
          :disabled="activeTab === 'cash' ? !isCashSufficient : (!selectedCustomer && !customerQuery.trim())"
          @click="submitPayment"
          class="h-11 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed transition-all"
        >
          {{ activeTab === 'cash' ? 'Simpan Transaksi' : 'Catat ke Buku Utang' }}
        </button>
      </div>
    </div>
  </div>
</template>
