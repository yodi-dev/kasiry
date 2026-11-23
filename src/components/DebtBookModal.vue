<script setup>
import { ref, computed } from 'vue'
import { 
  X, 
  BookOpen, 
  MessageSquare, 
  Check, 
  DollarSign, 
  Search, 
  UserPlus, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  Wallet, 
  AlertCircle, 
  Phone,
  User,
  Info
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
  storeName: {
    type: String,
    default: 'Habiba Store'
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

// State untuk Tambah / Edit Pelanggan
const customerForm = ref({
  id: null,
  name: '',
  phone: '',
  totalDebt: ''
})

const unpaidCustomers = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) > 0)
})

const paidCustomers = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) <= 0)
})

const unpaidCount = computed(() => unpaidCustomers.value.length)
const paidCount = computed(() => paidCustomers.value.length)

const totalAllDebt = computed(() => {
  return props.customers.reduce((acc, c) => acc + (c.totalDebt || 0), 0)
})

const filteredList = computed(() => {
  let list = props.customers

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

// Simulasi sisa utang setelah pembayaran dihitung real-time
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

// Buka Form Tambah Pelanggan
const openAddForm = () => {
  customerForm.value = {
    id: null,
    name: '',
    phone: '',
    totalDebt: ''
  }
  currentView.value = 'add'
}

// Buka Form Edit Pelanggan
const openEditForm = (c) => {
  customerForm.value = {
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    totalDebt: c.totalDebt ? String(c.totalDebt) : '0'
  }
  currentView.value = 'add'
}

// Simpan Tambah / Edit Pelanggan
const handleSaveCustomer = () => {
  if (!customerForm.value.name.trim()) return

  const initialDebt = parseInt(String(customerForm.value.totalDebt).replace(/\D/g, '') || '0', 10)

  emit('addCustomer', {
    id: customerForm.value.id || null,
    name: customerForm.value.name.trim(),
    phone: customerForm.value.phone.trim(),
    totalDebt: initialDebt,
    lastDate: 'Hari ini'
  })

  currentView.value = 'list'
}

// Buka Tampilan Pembayaran / Cicil
const openPayView = (c) => {
  selectedCustomer.value = c
  paymentAmount.value = String(c.totalDebt || 0)
  currentView.value = 'pay'
}

const setQuickAmount = (val) => {
  paymentAmount.value = String(val)
}

const handleConfirmPayment = () => {
  const amt = parseInt(String(paymentAmount.value).replace(/\D/g, '') || '0', 10)
  if (amt <= 0 || !selectedCustomer.value) return

  emit('recordPayment', {
    customerId: selectedCustomer.value.id,
    amount: amt
  })

  currentView.value = 'list'
}

const handleDeleteCustomer = (c) => {
  if (confirm(`Hapus catatan pelanggan "${c.name}" dari buku utang?`)) {
    emit('deleteCustomer', c.id)
  }
}

// Format pengingat WhatsApp sopan khas warung UMKM
const shareWhatsAppReminder = (c) => {
  const msg = `Halo Bu/Pak ${c.name}, sekadar menginfokan catatan bon belanja di ${props.storeName} saat ini tercatat sebesar Rp ${(c.totalDebt || 0).toLocaleString('id-ID')}.\n\nJika ada waktu senggang, bisa mampir ya. Matur nuwun 🙏`
  
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
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Warm Amber Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs">
            <BookOpen v-if="currentView === 'list'" class="w-5 h-5 text-amber-400" />
            <UserPlus v-else-if="currentView === 'add'" class="w-5 h-5 text-sky-400" />
            <Wallet v-else class="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              {{ currentView === 'add' ? (customerForm.id ? 'Edit Data Tetangga' : 'Tambah Tetangga Baru') : currentView === 'pay' ? 'Catat Bayar / Cicil Bon' : 'Buku Utang Digital' }}
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ currentView === 'add' ? 'Lengkapi identitas tetangga & saldo awal' : currentView === 'pay' ? `Pelunasan piutang ${selectedCustomer?.name || ''}` : 'Catatan bon belanja tetangga & riwayat pembayaran' }}
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

      <!-- VIEW 1: DAFTAR BUKU UTANG (LIST VIEW) -->
      <div v-if="currentView === 'list'" class="flex flex-col flex-1 min-h-0">
        
        <!-- Ringkasan Total Piutang Warung -->
        <div class="p-4 bg-linear-to-br from-rose-50/70 via-white to-slate-50/60 border-b border-slate-100 shrink-0">
          <div class="p-4 bg-white rounded-2xl border border-rose-100/90 shadow-2xs flex items-center justify-between gap-3">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold tracking-wide uppercase">
                <AlertCircle class="w-3 h-3 text-rose-500" />
                Uang di Luar (Piutang)
              </span>
              <p class="text-xs text-slate-500 font-medium mt-1">
                {{ unpaidCount }} tetangga belum melunasi bon
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xl sm:text-2xl font-bold font-mono text-rose-600 leading-tight">
                Rp {{ totalAllDebt.toLocaleString('id-ID') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Controls: Search & Tombol Tambah Tetangga -->
        <div class="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <Search class="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="Cari nama atau no. WhatsApp tetangga..."
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
              <span class="hidden sm:inline">Tambah Tetangga</span>
              <span class="sm:hidden">Tambah</span>
            </button>
          </div>

          <!-- Filter Status Chips -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button 
              @click="activeFilter = 'unpaid'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5',
                activeFilter === 'unpaid' 
                  ? 'bg-rose-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              <span>Belum Lunas</span>
              <span class="px-1.5 py-0.2 bg-white/20 rounded-md text-[11px] font-mono">{{ unpaidCount }}</span>
            </button>

            <button 
              @click="activeFilter = 'all'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5',
                activeFilter === 'all' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              <span>Semua</span>
              <span class="px-1.5 py-0.2 bg-white/20 rounded-md text-[11px] font-mono">{{ customers.length }}</span>
            </button>

            <button 
              @click="activeFilter = 'paid'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5',
                activeFilter === 'paid' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              <span>Sudah Lunas</span>
              <span class="px-1.5 py-0.2 bg-white/20 rounded-md text-[11px] font-mono">{{ paidCount }}</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Customer Debt List -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          <!-- Empty State -->
          <div 
            v-if="filteredList.length === 0" 
            class="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <BookOpen class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Tidak ada catatan bon yang cocok</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau filter status</p>
          </div>

          <!-- Customer Card -->
          <div 
            v-for="c in filteredList" 
            :key="c.id"
            class="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            <!-- Kolom Kiri: Avatar & Info Pelanggan -->
            <div class="flex items-center gap-3 min-w-0">
              <!-- Avatar Initial -->
              <div 
                :class="[
                  'w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm uppercase shrink-0 border transition-colors',
                  (c.totalDebt || 0) > 0 
                    ? 'bg-rose-50 text-rose-700 border-rose-200/60 group-hover:bg-rose-100' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60 group-hover:bg-emerald-100'
                ]"
              >
                {{ c.name ? c.name.charAt(0) : 'T' }}
              </div>

              <!-- Detail Nama & Kontak -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-sm text-[#0a193d] truncate">{{ c.name }}</h4>
                  <span 
                    v-if="(c.totalDebt || 0) <= 0" 
                    class="text-[10px] bg-emerald-100/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60 shrink-0"
                  >
                    Lunas ✓
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-500">
                  <span v-if="c.phone" class="font-mono text-[11px] text-slate-600 flex items-center gap-1">
                    <Phone class="w-3 h-3 text-emerald-600" />
                    {{ c.phone }}
                  </span>
                  <span class="text-[11px] text-slate-400">
                    • Terakhir: {{ c.lastDate || 'Hari ini' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Kolom Kanan: Sisa Bon & Tombol Aksi -->
            <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
              <!-- Nominal Bon -->
              <div class="text-left sm:text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {{ (c.totalDebt || 0) > 0 ? 'Sisa Bon' : 'Status' }}
                </span>
                <span 
                  :class="[
                    'font-mono font-bold text-base leading-tight',
                    (c.totalDebt || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                  ]"
                >
                  Rp {{ (c.totalDebt || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-1.5 shrink-0">
                <!-- Tombol WhatsApp Reminder (Hanya muncul jika ada sisa bon) -->
                <button 
                  v-if="(c.totalDebt || 0) > 0"
                  @click="shareWhatsAppReminder(c)"
                  class="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Kirim pengingat WA sopan"
                >
                  <MessageSquare class="w-3.5 h-3.5 text-emerald-600" />
                  <span class="hidden sm:inline">WA</span>
                </button>

                <!-- Tombol Bayar / Cicil (Hanya muncul jika ada sisa bon) -->
                <button 
                  v-if="(c.totalDebt || 0) > 0"
                  @click="openPayView(c)"
                  class="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Catat bayar atau cicilan bon"
                >
                  <DollarSign class="w-3.5 h-3.5" />
                  <span>Bayar</span>
                </button>

                <!-- Tombol Edit Pelanggan -->
                <button 
                  @click="openEditForm(c)"
                  class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#0284c7] hover:border-sky-200 border border-transparent flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Edit data pelanggan"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                </button>

                <!-- Tombol Hapus Pelanggan -->
                <button 
                  @click="handleDeleteCustomer(c)"
                  class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 hover:border-rose-200 border border-transparent flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="Hapus pelanggan dari buku utang"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500 font-medium">
            Menampilkan {{ filteredList.length }} dari {{ customers.length }} tetangga
          </span>
          <button 
            @click="emit('close')"
            class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>

      <!-- VIEW 2: FORM TAMBAH / EDIT TETANGGA (IN-MODAL VIEW) -->
      <div v-else-if="currentView === 'add'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">
              {{ customerForm.id ? 'Perbarui Data Tetangga' : 'Identitas Tetangga Baru' }}
            </h4>
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
              Nama Tetangga / Pelanggan <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="customerForm.name"
                placeholder="Contoh: Bu RT Siti, Pak Joko, Mas Budi..."
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
            <p class="text-[11px] text-slate-400 mt-1">
              Digunakan saat ingin mengirim pengingat bon sopan via WhatsApp satu klik.
            </p>
          </div>

          <!-- Saldo Bon Awal (Buku Fisik Warung) -->
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
            <p class="text-[11px] text-slate-400 mt-1">
              Biarkan 0 jika belum ada catatan utang sebelumnya.
            </p>
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
            :disabled="!customerForm.name.trim()"
            class="h-11 px-6 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Check class="w-4 h-4 text-sky-400" />
            <span>Simpan Data</span>
          </button>
        </div>
      </div>

      <!-- VIEW 3: FORM CATAT PEMBAYARAN / CICIL UTANG (IN-MODAL VIEW) -->
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

        <!-- Info Ringkasan Pelanggan -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 text-rose-600 font-bold flex items-center justify-center text-sm shadow-2xs">
              {{ selectedCustomer?.name ? selectedCustomer.name.charAt(0) : 'T' }}
            </div>
            <div>
              <p class="text-xs font-bold text-[#0a193d]">{{ selectedCustomer?.name }}</p>
              <p class="text-[11px] text-slate-500 font-mono">
                Total Bon: <span class="text-rose-600 font-bold">Rp {{ (selectedCustomer?.totalDebt || 0).toLocaleString('id-ID') }}</span>
              </p>
            </div>
          </div>

          <div class="text-right">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Sisa Setelah Bayar</span>
            <span 
              :class="[
                'font-mono font-bold text-sm',
                isFullyPaidPreview ? 'text-emerald-600' : 'text-slate-800'
              ]"
            >
              {{ isFullyPaidPreview ? 'LUNAS ✓' : `Rp ${remainingDebtPreview.toLocaleString('id-ID')}` }}
            </span>
          </div>
        </div>

        <!-- Input Nominal Bayar -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Nominal Dibayarkan (Rp)
          </label>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-sm">
              Rp
            </span>
            <input 
              type="number" 
              v-model="paymentAmount"
              placeholder="0"
              class="w-full h-12 pl-12 pr-4 bg-white border-2 border-slate-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl text-xl font-bold font-mono text-emerald-700 text-right outline-hidden transition-all shadow-2xs"
            />
          </div>
        </div>

        <!-- Tombol Cepat Nominal -->
        <div>
          <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pilihan Cepat Nominal:</p>
          <div class="grid grid-cols-4 gap-2">
            <button 
              type="button"
              @click="setQuickAmount(selectedCustomer?.totalDebt || 0)"
              class="col-span-2 h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200/80 cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Check class="w-3.5 h-3.5 text-emerald-600" />
              <span>Lunas Semua (Rp {{ (selectedCustomer?.totalDebt || 0).toLocaleString('id-ID') }})</span>
            </button>
            <button 
              type="button"
              @click="setQuickAmount(10000)"
              class="h-10 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              10rb
            </button>
            <button 
              type="button"
              @click="setQuickAmount(20000)"
              class="h-10 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              20rb
            </button>
            <button 
              type="button"
              @click="setQuickAmount(50000)"
              class="col-span-2 h-10 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              50.000
            </button>
            <button 
              type="button"
              @click="setQuickAmount(100000)"
              class="col-span-2 h-10 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              100.000
            </button>
          </div>
        </div>

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
            :disabled="!paymentAmount || parseInt(paymentAmount) <= 0"
            class="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Check class="w-4 h-4" />
            <span>Simpan Pembayaran</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
