<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  BookOpen, 
  MessageSquare, 
  Check, 
  Search, 
  UserPlus, 
  ArrowLeft, 
  Phone, 
  User, 
  Calendar, 
  Receipt,
  Banknote,
  QrCode
} from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  customers: {
    type: Array,
    default: () => []
  },
  transactions: {
    type: Array,
    default: () => []
  },
  digitalProducts: {
    type: Array,
    default: () => []
  },
  fetchCustomerTransactions: {
    type: Function,
    default: null
  },
  storeName: {
    type: String,
    default: 'Warung Kasiry'
  }
})

const emit = defineEmits(['close', 'recordPayment', 'addCustomer', 'deleteCustomer'])

// currentView: 'list' | 'add' | 'pay'
const currentView = ref('list')

const searchQuery = ref('')
const activeFilter = ref('unpaid') // 'unpaid' | 'all' | 'paid'

// State untuk Pembayaran Cicilan / Pelunasan
const selectedCustomer = ref(null)
const paymentAmount = ref('')
const payMethod = ref('TUNAI')
const fullCustomerHistory = ref([])

// State untuk Tambah Pelanggan Baru
const customerForm = ref({
  name: '',
  phone: '',
  totalDebt: ''
})

// Selalu reset ke tampilan daftar saat modal dibuka
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentView.value = 'list'
    selectedCustomer.value = null
    fullCustomerHistory.value = []
    paymentAmount.value = ''
    payMethod.value = 'TUNAI'
    searchQuery.value = ''
  }
}, { immediate: true })

const handleClose = () => {
  currentView.value = 'list'
  selectedCustomer.value = null
  fullCustomerHistory.value = []
  paymentAmount.value = ''
  payMethod.value = 'TUNAI'
  emit('close')
}

// Kecualikan pelanggan default sistem "Umum" dari daftar Buku Utang
const realCustomers = computed(() => {
  return props.customers.filter(c => c.name?.toLowerCase() !== 'umum')
})

const unpaidCustomers = computed(() => {
  return realCustomers.value.filter(c => (c.totalDebt || 0) > 0)
})

const paidCustomers = computed(() => {
  return realCustomers.value.filter(c => (c.totalDebt || 0) <= 0)
})

const unpaidCount = computed(() => unpaidCustomers.value.length)
const paidCount = computed(() => paidCustomers.value.length)

const totalAllDebt = computed(() => {
  return realCustomers.value.reduce((acc, c) => acc + (c.totalDebt || 0), 0)
})

const filteredList = computed(() => {
  let list = realCustomers.value

  if (activeFilter.value === 'unpaid') {
    list = unpaidCustomers.value
  } else if (activeFilter.value === 'paid') {
    list = paidCustomers.value
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list

  return list.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.phone && c.phone.includes(q))
  )
})

// Format tanggal bon yang jelas dan mudah dipahami
const formatCustomerDate = (c) => {
  if (!c) return '-'
  if (c.updatedAt) {
    const d = new Date(c.updatedAt)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      return `Hari ini, ${timeStr}`
    }
    return d.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }
  return c.lastDate || 'Hari ini'
}

// Format nomor HP agar rapi dan mudah dibaca
const formatPhone = (phone) => {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length >= 10) {
    return clean.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
  }
  return phone
}

// Ambil riwayat bon belanja pelanggan (barang kasir + pulsa/token utang)
const customerDebtTransactions = computed(() => {
  if (!selectedCustomer.value) return []
  const cid = selectedCustomer.value.id
  const cname = selectedCustomer.value.name
  const source = fullCustomerHistory.value.length > 0 ? fullCustomerHistory.value : (props.transactions || [])
  const goodsDebts = source
    .filter(t =>
      t && !t.deleted &&
      (t.customerId === cid || t.customerName === cname) &&
      (t.paymentMethod === 'UTANG / BON' || Number(t.debtAmount || 0) > 0 || String(t.paymentMethod || '').includes('SEBAGIAN BON'))
    )

  const digitalDebts = (props.digitalProducts || [])
    .filter(d =>
      d && !d.deleted &&
      d.paymentMethod === 'UTANG / BON' &&
      ((cid && d.customerId === cid) || (cname && d.customerName === cname))
    )
    .map(d => ({
      invoiceNumber: d.digitalNumber || `DIG-${d.id}`,
      createdAt: d.createdAt,
      paymentMethod: 'UTANG / BON',
      totalAmount: Number(d.sellPrice || 0),
      debtAmount: Number(d.sellPrice || 0),
      paidAmount: 0,
      items: [
        {
          id: `dig-${d.id}`,
          name: `${d.productName || 'Pulsa / PLN'}${d.targetNumber ? ` (${d.targetNumber})` : ''}`,
          qty: 1,
          sellPrice: Number(d.sellPrice || 0)
        }
      ]
    }))

  return [...goodsDebts, ...digitalDebts]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

// Perhitungan sisa utang saat pembayaran
const remainingDebtPreview = computed(() => {
  if (!selectedCustomer.value) return 0
  const current = selectedCustomer.value.totalDebt || 0
  const pay = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  return Math.max(0, current - pay)
})

const isFullyPaidPreview = computed(() => {
  if (!selectedCustomer.value) return false
  const current = selectedCustomer.value.totalDebt || 0
  const pay = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  return pay >= current && current > 0
})

const changeDebtPreview = computed(() => {
  if (!selectedCustomer.value) return 0
  const current = selectedCustomer.value.totalDebt || 0
  const pay = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  return Math.max(0, pay - current)
})

// Buka form tambah
const openAddForm = () => {
  customerForm.value = {
    name: '',
    phone: '',
    totalDebt: ''
  }
  currentView.value = 'add'
}

// Simpan Tambah Pelanggan
const handleSaveCustomer = () => {
  const trimmedName = customerForm.value.name.trim()
  if (!trimmedName || trimmedName.toLowerCase() === 'umum') return

  const initialDebt = parseInt(String(customerForm.value.totalDebt).replace(/\D/g, '') || '0', 10)

  emit('addCustomer', {
    name: trimmedName,
    phone: customerForm.value.phone.trim(),
    totalDebt: initialDebt,
    lastDate: 'Hari ini'
  })

  currentView.value = 'list'
}

const isQrisDebtOverpaid = computed(() => {
  if (!selectedCustomer.value || payMethod.value !== 'QRIS') return false
  const current = selectedCustomer.value.totalDebt || 0
  const pay = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  return pay > current
})

const canConfirmDebtPayment = computed(() => {
  const amt = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  if (amt <= 0 || !selectedCustomer.value) return false
  if (payMethod.value === 'QRIS' && isQrisDebtOverpaid.value) return false
  return true
})

const selectPayMethod = (method) => {
  payMethod.value = method
  if (method === 'QRIS' && selectedCustomer.value) {
    const current = selectedCustomer.value.totalDebt || 0
    const amt = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
    if (amt <= 0 || amt > current) {
      paymentAmount.value = String(current)
    }
  }
}

// Buka Tampilan Bayar & muat histori bon lengkap dari IndexedDB bila tersedia
const openPayView = async (c) => {
  selectedCustomer.value = c
  fullCustomerHistory.value = []
  payMethod.value = 'TUNAI'
  paymentAmount.value = String(c.totalDebt || 0)
  currentView.value = 'pay'
  if (typeof props.fetchCustomerTransactions === 'function') {
    const targetId = c.id
    try {
      const history = await props.fetchCustomerTransactions(c.id, c.name)
      if (selectedCustomer.value?.id === targetId && Array.isArray(history)) {
        fullCustomerHistory.value = history
      }
    } catch {
      // Tetap gunakan transaksi 90 hari aktif sebagai fallback
    }
  }
}

// Pecahan uang kertas standar (persis seperti di Kasa / PaymentModal)
const standardBills = [2000, 5000, 10000, 20000, 50000, 100000]

// Hitung saran pembulatan ke atas terdekat (persis seperti di Kasa)
const roundedSuggestions = computed(() => {
  const tot = selectedCustomer.value?.totalDebt || 0
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

const setExactPayment = () => {
  const tot = selectedCustomer.value?.totalDebt || 0
  paymentAmount.value = String(tot)
}

const setPaymentAmount = (amount) => {
  paymentAmount.value = String(amount)
}

const addPaymentAmount = (amount) => {
  const current = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  paymentAmount.value = String(current + amount)
}

const onManualPaymentInput = (e) => {
  const num = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
  paymentAmount.value = num > 0 ? String(num) : ''
}

const handleConfirmPayment = () => {
  if (!canConfirmDebtPayment.value) return
  const amt = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)

  emit('recordPayment', {
    customerId: selectedCustomer.value.id,
    amount: amt,
    paymentMethod: payMethod.value
  })

  currentView.value = 'list'
}

// WhatsApp pengingat sopan
const shareWhatsAppReminder = (c) => {
  const msg = `Halo Bu/Pak ${c.name}, sekadar menginfokan catatan bon belanja di ${props.storeName} saat ini tercatat sebesar Rp ${(c.totalDebt || 0).toLocaleString('id-ID')}.\n\nJika ada waktu senggang, bisa mampir ya. Terima kasih 🙏`
  
  let phone = (c.phone || '').trim().replace(/\D/g, '')
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1)
  }

  if (!phone) {
    const inputPhone = prompt(`Masukkan nomor WhatsApp untuk ${c.name} (contoh: 08123...):`, '')
    if (inputPhone !== null && inputPhone.trim()) {
      let cleanInput = inputPhone.trim().replace(/\D/g, '')
      if (cleanInput.startsWith('0')) cleanInput = '62' + cleanInput.slice(1)
      phone = cleanInput
    }
  }

  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`
  window.open(url, '_blank')
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
      
      <!-- 1. Header Modal -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <!-- Tombol Kembali saat di sub-view (Tambah / Bayar) -->
          <button 
            v-if="currentView !== 'list'"
            @click="currentView = 'list'"
            class="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Kembali ke Daftar Buku Utang"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          
          <div v-else class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen class="w-5 h-5 text-sky-400" />
          </div>

          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              {{ currentView === 'add' ? 'Tambah Pelanggan Baru' : currentView === 'pay' ? 'Catat Pembayaran Bon' : 'Buku Utang Digital' }}
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ currentView === 'add' ? 'Catat data pelanggan & saldo bon awal' : currentView === 'pay' ? `Pelunasan bon ${selectedCustomer?.name || ''}` : 'Catatan bon belanja pelanggan & pembayaran' }}
            </p>
          </div>
        </div>

        <!-- Tombol X: jika sedang di sub-view, kembali ke daftar; jika di daftar, tutup modal -->
        <button 
          @click="currentView !== 'list' ? currentView = 'list' : handleClose()"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          :title="currentView !== 'list' ? 'Kembali ke Daftar Buku Utang' : 'Tutup'"
          aria-label="Tutup atau Kembali"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- VIEW 1: DAFTAR BUKU UTANG (LIST VIEW) -->
      <div v-if="currentView === 'list'" class="flex flex-col flex-1 min-h-0">
        
        <!-- Ringkasan Total Piutang Belum Lunas -->
        <div class="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div class="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Piutang Belum Lunas</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ unpaidCount }} pelanggan belum melunasi bon</p>
            </div>
            <div class="text-right">
              <p class="text-xl sm:text-2xl font-bold font-mono text-[#0a193d]">
                Rp {{ totalAllDebt.toLocaleString('id-ID') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Controls: Search, Filter & Tambah Pelanggan -->
        <div class="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <Search class="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="Cari nama atau nomor WhatsApp..."
                class="w-full h-11 pl-10 pr-8 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs sm:text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
              />
              <button 
                v-if="searchQuery" 
                @click="searchQuery = ''"
                class="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <button 
              @click="openAddForm"
              class="h-11 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
            >
              <UserPlus class="w-4 h-4 text-sky-400" />
              <span class="hidden sm:inline">Tambah Pelanggan</span>
              <span class="sm:hidden">Tambah</span>
            </button>
          </div>

          <!-- Filter Status Chips -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button 
              @click="activeFilter = 'unpaid'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'unpaid' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Belum Lunas ({{ unpaidCount }})
            </button>

            <button 
              @click="activeFilter = 'all'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'all' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Semua ({{ realCustomers.length }})
            </button>

            <button 
              @click="activeFilter = 'paid'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'paid' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Lunas ({{ paidCount }})
            </button>
          </div>
        </div>

        <!-- Daftar Pelanggan: Nama, Tanggal di bawahnya, Nominal & Tombol Bayar di sampingnya -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          <!-- Empty State -->
          <div 
            v-if="filteredList.length === 0" 
            class="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <BookOpen class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Tidak ada catatan bon yang cocok</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau filter status</p>
          </div>

          <!-- Baris Pelanggan (Nama, Tanggal di Bawahnya, Nominal & Tombol Bayar di Sampingnya) -->
          <div 
            v-for="c in filteredList" 
            :key="c.id"
            class="p-3.5 sm:p-4 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl transition-all shadow-2xs flex items-center justify-between gap-3"
          >
            <!-- Kolom Kiri: Nama & Tanggal di Bawahnya -->
            <div class="min-w-0 flex-1 space-y-1">
              <h4 class="font-bold text-base text-[#0a193d] leading-tight truncate">
                {{ c.name }}
              </h4>
              
              <!-- Tanggal ditampilkan jelas di bawah nama (Baris 1) -->
              <p class="text-xs text-slate-500 font-medium flex items-center gap-1.5 truncate">
                <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{{ formatCustomerDate(c) }}</span>
              </p>

              <!-- Nomor HP di baris terpisah agar tidak tumpang tindih (Baris 2) -->
              <p v-if="c.phone" class="text-xs text-slate-400 font-mono flex items-center gap-1.5 truncate">
                <Phone class="w-3 h-3 text-slate-400 shrink-0" />
                <span>{{ formatPhone(c.phone) }}</span>
              </p>
            </div>

            <!-- Kolom Kanan: Nominal Utang & Tombol Bayar di Sampingnya -->
            <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {{ (c.totalDebt || 0) > 0 ? 'Sisa Bon' : 'Status' }}
                </span>
                <span 
                  :class="[
                    'font-mono font-bold text-base sm:text-lg block leading-tight',
                    (c.totalDebt || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                  ]"
                >
                  Rp {{ (c.totalDebt || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- Tombol Bayar (langsung di samping nominal) -->
              <button 
                v-if="(c.totalDebt || 0) > 0"
                @click="openPayView(c)"
                class="h-10 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-xs shrink-0"
              >
                Bayar
              </button>
              
              <span 
                v-else 
                class="h-9 px-3 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200/60 flex items-center shrink-0"
              >
                Lunas ✓
              </span>
            </div>

          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500 font-medium">
            Menampilkan {{ filteredList.length }} dari {{ realCustomers.length }} pelanggan
          </span>
          <button 
            @click="handleClose"
            class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>

      <!-- VIEW 2: FORM TAMBAH PELANGGAN -->
      <div v-else-if="currentView === 'add'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">Tambah Pelanggan Baru</h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Buku Utang</span>
          </button>
        </div>

        <!-- Form Inputs -->
        <div class="space-y-3.5">
          <!-- Nama Lengkap / Panggilan -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Pelanggan <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="customerForm.name"
                placeholder="Contoh: Bu RT Siti, Pak Joko..."
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Nomor WhatsApp -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nomor WhatsApp / HP (Opsional)
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="customerForm.phone"
                placeholder="Contoh: 081234567890"
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-mono font-semibold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Saldo Bon Awal -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Saldo Bon Awal (Rp, jika ada dari buku tulis)
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-xs">
                Rp
              </span>
              <input 
                type="number" 
                v-model="customerForm.totalDebt"
                placeholder="0"
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-base font-bold text-[#0a193d] text-right font-mono outline-hidden transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Tombol Aksi Form -->
        <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button 
            @click="currentView = 'list'"
            class="h-11 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button 
            @click="handleSaveCustomer"
            :disabled="!customerForm.name.trim() || customerForm.name.trim().toLowerCase() === 'umum'"
            class="h-11 px-6 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Check class="w-4 h-4 text-sky-400" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      <!-- VIEW 3: FORM CATAT PEMBAYARAN BON -->
      <div v-else-if="currentView === 'pay'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">Catat Pembayaran Bon</h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Buku Utang</span>
          </button>
        </div>

        <!-- Info Ringkasan Pelanggan & Tanggal -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-bold text-[#0a193d]">{{ selectedCustomer?.name }}</p>
              <p class="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Tanggal bon: {{ formatCustomerDate(selectedCustomer) }}</span>
              </p>
              <p v-if="selectedCustomer?.phone" class="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                <Phone class="w-3 h-3 text-slate-400 shrink-0" />
                <span>{{ formatPhone(selectedCustomer.phone) }}</span>
              </p>
            </div>

            <div class="text-right">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Bon Saat Ini</span>
              <span class="font-mono font-bold text-base text-[#0a193d]">
                Rp {{ (selectedCustomer?.totalDebt || 0).toLocaleString('id-ID') }}
              </span>
            </div>
          </div>

          <!-- Opsi Kirim Pesan Pengingat WA jika ada no HP -->
          <div v-if="(selectedCustomer?.totalDebt || 0) > 0" class="pt-2 border-t border-slate-200/70 flex items-center justify-between">
            <span class="text-xs text-slate-500">Kirim rincian bon ke WhatsApp?</span>
            <button 
              type="button"
              @click="shareWhatsAppReminder(selectedCustomer)"
              class="h-7 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <MessageSquare class="w-3 h-3 text-emerald-600" />
              <span>Kirim WA</span>
            </button>
          </div>
        </div>

        <!-- Rincian Barang yang Diutang (Jika ada catatan transaksi) -->
        <div v-if="customerDebtTransactions.length > 0" class="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/70 space-y-2">
          <p class="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt class="w-3.5 h-3.5 text-slate-400" />
            <span>Rincian Bon Belanja Terakhir:</span>
          </p>
          <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            <div 
              v-for="tx in customerDebtTransactions" 
              :key="tx.invoiceNumber"
              class="p-2 bg-white rounded-xl border border-slate-200/60 text-xs"
            >
              <div class="flex items-center justify-between font-semibold text-[#0a193d] mb-1">
                <span>
                  {{ tx.invoiceNumber }}
                  <span v-if="Number(tx.debtAmount || 0) > 0 && Number(tx.paidAmount || 0) > 0" class="text-[10px] text-amber-700 font-bold ml-1">
                    (Bon Rp {{ tx.debtAmount.toLocaleString('id-ID') }})
                  </span>
                </span>
                <span class="font-mono">Rp {{ tx.totalAmount.toLocaleString('id-ID') }}</span>
              </div>
              <ul class="text-[11px] text-slate-500 space-y-0.5 pl-1">
                <li v-for="item in tx.items" :key="item.id" class="flex justify-between">
                  <span>• {{ item.name }} (x{{ item.qty }})</span>
                  <span class="font-mono">Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Metode Pelunasan (Tunai Laci vs QRIS Non-Tunai) -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Metode Pembayaran Bon:
          </label>
          <div class="p-1 bg-slate-100 rounded-2xl flex gap-1">
            <button
              type="button"
              @click="selectPayMethod('TUNAI')"
              :class="[
                'flex-1 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
                payMethod === 'TUNAI'
                  ? 'bg-[#0a193d] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              <Banknote class="w-3.5 h-3.5" />
              <span>Tunai</span>
            </button>
            <button
              type="button"
              @click="selectPayMethod('QRIS')"
              :class="[
                'flex-1 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
                payMethod === 'QRIS'
                  ? 'bg-[#0284c7] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              <QrCode class="w-3.5 h-3.5" />
              <span>QRIS (Non-Tunai)</span>
            </button>
          </div>
        </div>

        <!-- Input Nominal Bayar (Formatted dengan pemisah ribuan persis di Kasa) -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Nominal Dibayarkan:
            </label>
            <span class="text-xs font-medium text-slate-500">
              Sisa Bon: 
              <span :class="['font-mono font-bold', isFullyPaidPreview ? 'text-emerald-700' : 'text-[#0a193d]']">
                {{ isFullyPaidPreview ? 'Lunas ✓' : `Rp ${remainingDebtPreview.toLocaleString('id-ID')}` }}
              </span>
              <span v-if="payMethod === 'TUNAI' && changeDebtPreview > 0" class="ml-2 text-emerald-700 font-bold font-mono">
                • Kembalian: Rp {{ changeDebtPreview.toLocaleString('id-ID') }}
              </span>
            </span>
          </div>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-4 flex items-center font-bold text-slate-400 text-base">
              Rp
            </span>
            <input 
              type="text" 
              :value="paymentAmount ? parseInt(paymentAmount).toLocaleString('id-ID') : ''"
              @input="onManualPaymentInput"
              placeholder="0"
              class="w-full h-13 pl-12 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/15 rounded-2xl text-xl sm:text-2xl font-bold text-[#0a193d] outline-hidden transition-all text-right font-mono"
            />
          </div>
        </div>

        <!-- Peringatan QRIS bila melebihi sisa bon -->
        <div
          v-if="payMethod === 'QRIS' && isQrisDebtOverpaid"
          class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800"
        >
          <span>QRIS maksimal sebesar sisa bon (tanpa kembalian tunai).</span>
          <button
            type="button"
            @click="setExactPayment"
            class="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 font-bold rounded-lg shrink-0 cursor-pointer"
          >
            Pas-kan
          </button>
        </div>

        <!-- Mode QRIS: Cukup info + tombol Lunas Semua (Uang Pas) -->
        <div v-if="payMethod === 'QRIS'" class="flex items-center justify-between gap-2 p-3 bg-sky-50/70 rounded-2xl border border-sky-200/70">
          <div class="text-xs text-[#0a193d]">
            <p class="font-bold">Pelunasan Non-Tunai QRIS</p>
            <p class="text-[11px] text-slate-600">Bisa bayar pas atau cicil. Tidak masuk uang tunai laci.</p>
          </div>
          <button
            type="button"
            @click="setExactPayment"
            class="h-10 px-3.5 bg-white hover:bg-sky-100 text-[#0284c7] font-bold text-xs rounded-xl border border-sky-200 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            Lunas Semua (Pas)
          </button>
        </div>

        <!-- Tombol Lunas Semua & Pecahan Tunai -->
        <template v-else>
          <!-- Tombol Lunas Semua (Uang Pas) & Pembulatan Terdekat (Persis di Kasa) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- Lunas Semua / Uang Pas -->
            <button 
              type="button"
              @click="setExactPayment"
              class="h-11 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200/80 cursor-pointer transition-all active:scale-95 shadow-2xs flex items-center justify-center gap-1.5"
            >
              <span>Lunas Semua</span>
            </button>

            <!-- Saran Pembulatan -->
            <button 
              type="button"
              v-for="sug in roundedSuggestions" 
              :key="sug"
              @click="setPaymentAmount(sug)"
              class="h-11 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all active:scale-95 shadow-2xs font-mono"
            >
              Rp {{ (sug / 1000) }}rb
            </button>
          </div>

          <!-- Pecahan Nominal Uang Standar Rupiah (+2rb, +5rb, +10rb, dst Persis di Kasa) -->
          <div>
            <p class="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tambah Pecahan Uang Kertas:</p>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button 
                type="button"
                v-for="bill in standardBills" 
                :key="bill"
                @click="addPaymentAmount(bill)"
                class="h-10 bg-slate-100 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 text-slate-800 font-bold text-xs rounded-xl cursor-pointer border border-transparent transition-all active:scale-95 font-mono"
              >
                +{{ bill >= 1000 ? (bill / 1000) + 'rb' : bill }}
              </button>
            </div>
          </div>
        </template>

        <!-- Tombol Aksi Pembayaran -->
        <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button 
            @click="currentView = 'list'"
            class="h-11 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button 
            @click="handleConfirmPayment"
            :disabled="!canConfirmDebtPayment"
            class="h-11 px-6 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Check class="w-4 h-4 text-sky-400" />
            <span>{{ payMethod === 'QRIS' ? 'Simpan Bayar QRIS' : 'Simpan Pembayaran' }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
