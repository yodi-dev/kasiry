<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { X, CheckCircle, Banknote, UserCheck, Plus, AlertCircle, CreditCard, User, Search, ChevronRight } from '@lucide/vue'

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
  },
  transactions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'processCashPayment', 'processDebtPayment', 'saveCustomer'])

// Active Tab: 'cash' | 'debt'
const activeTab = ref('cash')

// Cash Mode State
const cashGiven = ref(0)
const cashInputStr = ref('')
const selectedCashCustomer = ref(null)
const cashCustomerQuery = ref('')
const isCustomerDropdownOpen = ref(false)
const isAddingCustomer = ref(false)
const newCustName = ref('')
const newCustPhone = ref('')

// Debt Mode State
const customerQuery = ref('')
const selectedCustomer = ref(null)

// Element Refs untuk fokus kursor otomatis
const customerSearchInputRef = ref(null)
const quickAddNameInputRef = ref(null)
const debtCustomerInputRef = ref(null)

// Buka pencarian pelanggan dan langsung aktifkan kursor
const openCustomerDropdown = () => {
  isCustomerDropdownOpen.value = true
  nextTick(() => {
    customerSearchInputRef.value?.focus()
  })
}

// Watcher dropdown pelanggan: aktifkan kursor setiap kali dropdown terbuka
watch(isCustomerDropdownOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      customerSearchInputRef.value?.focus()
    })
  }
})

// Watcher form tambah pelanggan cepat
watch(isAddingCustomer, (isAdding) => {
  if (isAdding) {
    nextTick(() => {
      quickAddNameInputRef.value?.focus()
    })
  }
})

// Watcher pergantian tab (mode utang otomatis fokus ke input pelanggan)
watch(activeTab, (tab) => {
  if (tab === 'debt') {
    nextTick(() => {
      debtCustomerInputRef.value?.focus()
    })
  }
})

// Dapatkan objek pelanggan "Umum" bawaan
const getUmumCustomer = () => {
  return props.savedCustomers.find(c => c.name.toLowerCase() === 'umum') || {
    id: null,
    name: 'Umum',
    phone: '',
    totalDebt: 0
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    activeTab.value = 'cash'
    cashGiven.value = props.totalAmount
    cashInputStr.value = String(props.totalAmount)
    selectedCustomer.value = null
    customerQuery.value = ''

    // Default setiap transaksi tunai ke pelanggan "Umum"
    selectedCashCustomer.value = getUmumCustomer()
    cashCustomerQuery.value = ''
    isCustomerDropdownOpen.value = false
    isAddingCustomer.value = false
    newCustName.value = ''
    newCustPhone.value = ''
  }
})

// Sinkronkan jika data savedCustomers tiba atau pelanggan baru mendapat ID dari IndexedDB
watch(() => props.savedCustomers, (newCustomers) => {
  if (selectedCashCustomer.value && !selectedCashCustomer.value.id && selectedCashCustomer.value.name) {
    const targetName = selectedCashCustomer.value.name.trim().toLowerCase()
    const found = newCustomers.find(c => c.name?.toLowerCase() === targetName)
    if (found) selectedCashCustomer.value = found
  }
}, { deep: true })

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

// Menghitung frekuensi transaksi belanja pelanggan
const getCustomerTxCount = (cust) => {
  if (!props.transactions || props.transactions.length === 0 || !cust) return 0
  const cid = cust.id
  const cname = cust.name
  return props.transactions.filter(t => 
    (cid && (t.customerId === cid || t.customer?.id === cid)) ||
    (cname && (t.customerName === cname || t.customer?.name === cname))
  ).length
}

// Filter pelanggan di mode kas (diurutkan berdasarkan yang paling sering belanja)
const filteredCashCustomers = computed(() => {
  const sorted = [...props.savedCustomers].sort((a, b) => {
    // Umum selalu di posisi pertama
    if (a.name.toLowerCase() === 'umum') return -1
    if (b.name.toLowerCase() === 'umum') return 1

    const countA = getCustomerTxCount(a)
    const countB = getCustomerTxCount(b)
    if (countB !== countA) {
      return countB - countA // Yang paling sering belanja di atas
    }
    return a.name.localeCompare(b.name, 'id')
  })

  const q = cashCustomerQuery.value.trim().toLowerCase()
  if (!q) return sorted.slice(0, 10)
  return sorted.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.phone && c.phone.includes(q))
  )
})

const selectCashCustomer = (c) => {
  selectedCashCustomer.value = c
  cashCustomerQuery.value = ''
  isCustomerDropdownOpen.value = false
}

// Buka form cepat tambah pelanggan
const openQuickAddForm = () => {
  isAddingCustomer.value = true
  isCustomerDropdownOpen.value = false
  newCustName.value = cashCustomerQuery.value.trim()
  newCustPhone.value = ''
  nextTick(() => {
    quickAddNameInputRef.value?.focus()
  })
}

// Batal tambah cepat
const cancelQuickAdd = () => {
  isAddingCustomer.value = false
  newCustName.value = ''
  newCustPhone.value = ''
}

// Simpan pelanggan cepat
const handleSaveQuickCustomer = () => {
  const name = newCustName.value.trim()
  if (!name) return

  const existing = props.savedCustomers.find(c => c.name?.toLowerCase() === name.toLowerCase())
  if (existing) {
    selectedCashCustomer.value = existing
    isAddingCustomer.value = false
    isCustomerDropdownOpen.value = false
    newCustName.value = ''
    newCustPhone.value = ''
    return
  }

  const newCust = {
    id: null,
    name,
    phone: newCustPhone.value.trim(),
    totalDebt: 0
  }

  emit('saveCustomer', newCust)
  selectedCashCustomer.value = newCust
  isAddingCustomer.value = false
  isCustomerDropdownOpen.value = false
  newCustName.value = ''
  newCustPhone.value = ''
}

// Buat dan pilih pelanggan dari teks pencarian
const createAndSelectCashCustomer = () => {
  const newName = cashCustomerQuery.value.trim()
  if (!newName) return

  const existing = props.savedCustomers.find(c => c.name?.toLowerCase() === newName.toLowerCase())
  if (existing) {
    selectCashCustomer(existing)
    return
  }

  const newCust = { id: null, name: newName, totalDebt: 0, phone: '' }
  emit('saveCustomer', newCust)
  selectedCashCustomer.value = newCust
  cashCustomerQuery.value = ''
  isCustomerDropdownOpen.value = false
}

// Reset pelanggan kembali ke "Umum"
const resetToUmum = () => {
  selectedCashCustomer.value = getUmumCustomer()
  isCustomerDropdownOpen.value = false
  isAddingCustomer.value = false
  cashCustomerQuery.value = ''
}

// Filter pelanggan di mode utang (diurutkan frekuensi belanja, mengecualikan "Umum")
const filteredCustomers = computed(() => {
  const nonUmum = props.savedCustomers.filter(c => c.name.toLowerCase() !== 'umum')
  const sorted = [...nonUmum].sort((a, b) => {
    const countA = getCustomerTxCount(a)
    const countB = getCustomerTxCount(b)
    if (countB !== countA) {
      return countB - countA // Frekuensi belanja terbanyak di atas
    }
    return a.name.localeCompare(b.name, 'id')
  })

  const q = customerQuery.value.trim().toLowerCase()
  if (!q) return sorted
  return sorted.filter(c => 
    c.name.toLowerCase().includes(q) ||
    (c.phone && c.phone.includes(q))
  )
})

const isDebtQueryUmum = computed(() => {
  return customerQuery.value.trim().toLowerCase() === 'umum'
})

const isDebtReady = computed(() => {
  if (selectedCustomer.value) {
    return selectedCustomer.value.name?.toLowerCase() !== 'umum'
  }
  const q = customerQuery.value.trim()
  return q.length > 0 && q.toLowerCase() !== 'umum'
})

const onDebtCustomerQueryInput = () => {
  if (selectedCustomer.value && customerQuery.value.trim().toLowerCase() !== selectedCustomer.value.name.toLowerCase()) {
    selectedCustomer.value = null
  }
}

const selectCustomer = (c) => {
  selectedCustomer.value = c
  customerQuery.value = c.name
}

const createAndSelectCustomer = () => {
  const newName = customerQuery.value.trim()
  if (!newName || newName.toLowerCase() === 'umum') return

  const existing = props.savedCustomers.find(c => c.name?.toLowerCase() === newName.toLowerCase())
  if (existing) {
    selectCustomer(existing)
    return
  }

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
      changeAmount: changeAmount.value,
      customer: selectedCashCustomer.value || getUmumCustomer()
    })
  } else {
    if (!isDebtReady.value) return
    const qName = customerQuery.value.trim()
    let cust = selectedCustomer.value
    if (!cust) {
      const existing = props.savedCustomers.find(
        c => c.name?.toLowerCase() === qName.toLowerCase() && c.name?.toLowerCase() !== 'umum'
      )
      cust = existing || {
        id: Date.now(),
        name: qName,
        phone: '',
        totalDebt: 0
      }
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
          <!-- Bagian Data Pelanggan (Default: Umum) -->
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <!-- Header Judul (Tanpa teks opsional) -->
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User class="w-3.5 h-3.5 text-slate-400" />
                <span>Pelanggan:</span>
              </label>

              <!-- Tombol Cepat Tambah Pelanggan di samping judul -->
              <button 
                v-if="!isAddingCustomer"
                type="button"
                @click="openQuickAddForm"
                class="text-[11px] font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
                title="Daftarkan pelanggan baru langsung di sini"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Tambah Pelanggan</span>
              </button>
            </div>

            <!-- 1. Kondisi: Sedang Tambah Pelanggan Cepat (Inline Form) -->
            <div v-if="isAddingCustomer" class="p-3 bg-white border border-[#0284c7] rounded-xl space-y-2.5 shadow-2xs animate-in fade-in zoom-in-95 duration-100">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[#0a193d]">Tambah Pelanggan Baru</span>
                <button 
                  type="button" 
                  @click="cancelQuickAdd"
                  class="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Tutup"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>

              <div class="space-y-2">
                <input 
                  ref="quickAddNameInputRef"
                  type="text" 
                  v-model="newCustName" 
                  placeholder="Nama Pelanggan (contoh: Bu Siti, Mas Joko)..." 
                  class="w-full h-9 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0284c7] rounded-xl outline-hidden text-[#0a193d]"
                  @keydown.enter.prevent="handleSaveQuickCustomer"
                />
                <input 
                  type="text" 
                  v-model="newCustPhone" 
                  placeholder="Nomor WhatsApp / HP (contoh: 08123...)" 
                  class="w-full h-9 px-3 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0284c7] rounded-xl outline-hidden text-[#0a193d]"
                  @keydown.enter.prevent="handleSaveQuickCustomer"
                />
              </div>

              <div class="flex items-center justify-end gap-2 pt-1">
                <button 
                  type="button" 
                  @click="cancelQuickAdd"
                  class="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  @click="handleSaveQuickCustomer"
                  :disabled="!newCustName.trim()"
                  class="h-8 px-3.5 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Plus class="w-3.5 h-3.5 text-sky-400" />
                  <span>Simpan & Pilih</span>
                </button>
              </div>
            </div>

            <!-- 2. Kondisi: Tampilan Pelanggan Terpilih (Sentuh data pelanggan untuk ganti) -->
            <div 
              v-else-if="!isCustomerDropdownOpen" 
              @click="openCustomerDropdown"
              class="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-[#0284c7] rounded-xl text-xs shadow-2xs cursor-pointer transition-all group active:scale-[0.99]"
              title="Sentuh untuk ganti pelanggan"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-sky-50 group-hover:bg-[#0a193d] text-[#0284c7] group-hover:text-white font-bold flex items-center justify-center shrink-0 text-xs border border-sky-100/80 group-hover:border-[#0a193d] transition-colors">
                  {{ selectedCashCustomer?.name ? selectedCashCustomer.name.charAt(0).toUpperCase() : 'U' }}
                </div>
                <div class="min-w-0 truncate">
                  <h4 class="font-bold text-[#0a193d] group-hover:text-[#0284c7] text-sm truncate transition-colors leading-tight">
                    {{ selectedCashCustomer?.name || 'Umum' }}
                  </h4>
                  <p v-if="selectedCashCustomer?.phone" class="text-slate-400 font-mono text-[11px] truncate mt-0.5">
                    {{ selectedCashCustomer.phone }}
                  </p>
                </div>
              </div>

              <!-- Indikator Sentuh / Chevron Kanan -->
              <div class="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-sky-50 text-slate-400 group-hover:text-[#0284c7] flex items-center justify-center transition-colors shrink-0">
                <ChevronRight class="w-4 h-4" />
              </div>
            </div>

            <!-- 3. Kondisi: Dropdown Pencarian / Pemilihan Pelanggan -->
            <div v-else class="space-y-2 bg-white p-2.5 rounded-xl border border-[#0284c7] shadow-2xs">
              <div class="relative">
                <Search class="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input 
                  ref="customerSearchInputRef"
                  type="text" 
                  v-model="cashCustomerQuery"
                  placeholder="Ketik nama pelanggan untuk mencari..."
                  class="w-full h-9 pl-8 pr-8 text-xs font-semibold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0284c7] rounded-xl outline-hidden text-[#0a193d]"
                  @keydown.esc="isCustomerDropdownOpen = false"
                />
                <button 
                  type="button"
                  @click="isCustomerDropdownOpen = false"
                  class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <!-- Daftar Pelanggan yang Cocok -->
              <div class="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                <!-- Opsi Cepat Kembali ke "Umum" -->
                <button 
                  type="button"
                  @click="resetToUmum"
                  class="w-full p-2 px-2.5 text-left hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer"
                >
                  <span class="font-bold text-[#0a193d]">Umum</span>
                  <span v-if="selectedCashCustomer?.name?.toLowerCase() === 'umum'" class="text-[10px] text-[#0284c7] font-bold">Terpilih</span>
                </button>

                <!-- Pelanggan Tersimpan Lainnya -->
                <button 
                  v-for="c in filteredCashCustomers.filter(c => c.name.toLowerCase() !== 'umum')" 
                  :key="c.id"
                  type="button"
                  @click="selectCashCustomer(c)"
                  class="w-full p-2 px-2.5 text-left hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-bold text-[#0a193d] group-hover:text-[#0284c7] truncate">{{ c.name }}</span>
                    <span v-if="getCustomerTxCount(c) > 0" class="text-[10px] font-semibold px-1.5 py-0.5 bg-sky-50 text-[#0284c7] rounded-md shrink-0">
                      {{ getCustomerTxCount(c) }}x belanja
                    </span>
                  </div>
                  <span v-if="c.phone" class="text-[11px] text-slate-400 font-mono shrink-0 ml-2">{{ c.phone }}</span>
                </button>

                <!-- Opsi Tambah Pelanggan Baru Berdasarkan Ketikan -->
                <button 
                  v-if="cashCustomerQuery.trim()"
                  type="button"
                  @click="createAndSelectCashCustomer"
                  class="w-full p-2 px-2.5 text-left bg-sky-50/70 hover:bg-sky-100 text-[#0284c7] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span class="truncate">Tambah & Pilih: "{{ cashCustomerQuery }}"</span>
                </button>
              </div>
            </div>
          </div>

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
              ref="debtCustomerInputRef"
              type="text" 
              v-model="customerQuery"
              @input="onDebtCustomerQueryInput"
              placeholder="Ketik nama pelanggan..."
              class="w-full h-12 px-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/15 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
            />
          </div>

          <!-- Peringatan jika mengetik "Umum" pada mode Utang -->
          <div v-if="isDebtQueryUmum" class="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
            <AlertCircle class="w-4 h-4 shrink-0 text-amber-600" />
            <span>Pelanggan <strong>"Umum"</strong> khusus transaksi tunai dan tidak dapat dicatat sebagai utang/bon.</span>
          </div>

          <!-- Tombol Tambah Pelanggan Baru -->
          <div 
            v-else-if="customerQuery.trim() && !selectedCustomer && !filteredCustomers.some(c => c.name.toLowerCase() === customerQuery.trim().toLowerCase())" 
            class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
          >
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
                  <div class="flex items-center gap-1.5">
                    <p class="text-xs font-bold truncate">{{ c.name }}</p>
                    <span v-if="getCustomerTxCount(c) > 0" class="text-[9px] font-semibold px-1.5 py-0.5 bg-sky-50 text-[#0284c7] rounded shrink-0">
                      {{ getCustomerTxCount(c) }}x
                    </span>
                  </div>
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
          :disabled="activeTab === 'cash' ? !isCashSufficient : !isDebtReady"
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

