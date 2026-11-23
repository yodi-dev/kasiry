<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Users, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  ArrowLeft, 
  Phone, 
  User, 
  MessageSquare, 
  Receipt, 
  ShoppingBag, 
  MapPin, 
  ChevronRight,
  AlertCircle
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
  storeName: {
    type: String,
    default: 'Habiba Store'
  }
})

const emit = defineEmits(['close', 'saveCustomer', 'deleteCustomer'])

// currentView: 'list' | 'form' | 'detail'
const currentView = ref('list')

const searchQuery = ref('')
const activeFilter = ref('all') // 'all' | 'with_debt' | 'no_debt'
const selectedCustomer = ref(null)

const customerForm = ref({
  id: null,
  name: '',
  phone: '',
  address: '',
  totalDebt: ''
})

// Reset tampilan ke list setiap kali modal dibuka
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentView.value = 'list'
    selectedCustomer.value = null
    searchQuery.value = ''
  }
})

const handleClose = () => {
  currentView.value = 'list'
  selectedCustomer.value = null
  emit('close')
}

const customersWithDebt = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) > 0)
})

const customersWithoutDebt = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) <= 0)
})

const totalCustomerDebt = computed(() => {
  return props.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)
})

const filteredCustomers = computed(() => {
  let list = props.customers

  if (activeFilter.value === 'with_debt') {
    list = customersWithDebt.value
  } else if (activeFilter.value === 'no_debt') {
    list = customersWithoutDebt.value
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list

  return list.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.phone && c.phone.includes(q)) ||
    (c.address && c.address.toLowerCase().includes(q))
  )
})

// Hitung total belanja & jumlah transaksi per pelanggan
const getCustomerStats = (customerId, customerName) => {
  if (!props.transactions || props.transactions.length === 0) {
    return { count: 0, totalSpent: 0 }
  }

  const matches = props.transactions.filter(t => 
    (customerId && t.customerId === customerId) || 
    (customerName && t.customerName === customerName)
  )

  const totalSpent = matches.reduce((sum, t) => sum + (t.totalAmount || 0), 0)
  return {
    count: matches.length,
    totalSpent
  }
}

// Ambil riwayat seluruh transaksi pelanggan (Tunai maupun Utang)
const customerTransactions = computed(() => {
  if (!selectedCustomer.value || !props.transactions) return []
  const cid = selectedCustomer.value.id
  const cname = selectedCustomer.value.name

  return props.transactions
    .filter(t => 
      (cid && t.customerId === cid) || 
      (cname && t.customerName === cname)
    )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const formatPhone = (phone) => {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length >= 10) {
    return clean.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
  }
  return phone
}

const formatDateTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Buka Form Tambah
const openAddForm = () => {
  customerForm.value = {
    id: null,
    name: '',
    phone: '',
    address: '',
    totalDebt: ''
  }
  currentView.value = 'form'
}

// Buka Form Edit
const openEditForm = (c) => {
  customerForm.value = {
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    address: c.address || '',
    totalDebt: c.totalDebt ? String(c.totalDebt) : '0'
  }
  currentView.value = 'form'
}

// Buka Detail Pelanggan
const openDetailView = (c) => {
  selectedCustomer.value = c
  currentView.value = 'detail'
}

// Simpan Tambah / Edit
const handleSave = () => {
  if (!customerForm.value.name.trim()) return

  const debtVal = parseInt(String(customerForm.value.totalDebt).replace(/\D/g, '') || '0', 10)

  const savedData = {
    id: customerForm.value.id || null,
    name: customerForm.value.name.trim(),
    phone: customerForm.value.phone.trim(),
    address: customerForm.value.address.trim(),
    totalDebt: debtVal,
    lastDate: 'Hari ini'
  }

  emit('saveCustomer', savedData)

  if (selectedCustomer.value && selectedCustomer.value.id === savedData.id) {
    selectedCustomer.value = { ...selectedCustomer.value, ...savedData }
  }

  currentView.value = 'list'
}

// Hapus Pelanggan dengan Proteksi Utang
const handleDelete = (c) => {
  if ((c.totalDebt || 0) > 0) {
    alert(`Pelanggan "${c.name}" masih memiliki sisa bon sebesar Rp ${c.totalDebt.toLocaleString('id-ID')}.\n\nPelanggan dengan utang aktif tidak dapat dihapus sebelum bon dilunasi di Buku Utang.`)
    return
  }

  if (confirm(`Hapus data pelanggan "${c.name}"?`)) {
    emit('deleteCustomer', c.id)
    if (selectedCustomer.value?.id === c.id) {
      selectedCustomer.value = null
      currentView.value = 'list'
    }
  }
}

// Chat WhatsApp ke Pelanggan
const openWhatsAppChat = (c) => {
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

  const msg = `Halo Bu/Pak ${c.name}, salam dari ${props.storeName} 🙏`
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
      
      <!-- 1. Header Modal (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <!-- Tombol Kembali jika di sub-view (Form / Detail) -->
          <button 
            v-if="currentView !== 'list'"
            @click="currentView = 'list'"
            class="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Kembali ke Daftar Pelanggan"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          
          <div v-else class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Users class="w-5 h-5 text-sky-400" />
          </div>

          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              {{ currentView === 'form' ? (customerForm.id ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru') : currentView === 'detail' ? 'Detail & Riwayat Belanja' : 'Data & Pelanggan Toko' }}
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ currentView === 'form' ? 'Lengkapi identitas & kontak pelanggan' : currentView === 'detail' ? `${selectedCustomer?.name || ''}` : `Total ${customers.length} pelanggan terdaftar` }}
            </p>
          </div>
        </div>

        <!-- Tombol X Pintar -->
        <button 
          @click="currentView !== 'list' ? currentView = 'list' : handleClose()"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          :title="currentView !== 'list' ? 'Kembali ke Daftar Pelanggan' : 'Tutup'"
          aria-label="Tutup atau Kembali"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- VIEW 1: DAFTAR PELANGGAN (LIST VIEW) -->
      <div v-if="currentView === 'list'" class="flex flex-col flex-1 min-h-0">
        
        <!-- Ringkasan Pelanggan & Bon -->
        <div class="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pelanggan</p>
              <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-0.5">
                {{ customers.length }} <span class="text-xs font-sans font-medium text-slate-500">Orang</span>
              </p>
            </div>
            <div class="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bon Aktif</p>
              <p :class="['text-lg sm:text-xl font-bold font-mono mt-0.5', totalCustomerDebt > 0 ? 'text-rose-600' : 'text-emerald-600']">
                Rp {{ totalCustomerDebt.toLocaleString('id-ID') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Controls: Pencarian, Tambah Pelanggan & Filter -->
        <div class="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <Search class="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="Cari nama, nomor WhatsApp, atau alamat..."
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
              @click="activeFilter = 'all'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'all' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Semua ({{ customers.length }})
            </button>

            <button 
              @click="activeFilter = 'with_debt'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'with_debt' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Ada Bon ({{ customersWithDebt.length }})
            </button>

            <button 
              @click="activeFilter = 'no_debt'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all',
                activeFilter === 'no_debt' 
                  ? 'bg-[#0a193d] text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              ]"
            >
              Tanpa Bon ({{ customersWithoutDebt.length }})
            </button>
          </div>
        </div>

        <!-- Scrollable Customer List: Bersih, Jelas, Nyaman & Tidak Ramai -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          <!-- Empty State -->
          <div 
            v-if="filteredCustomers.length === 0" 
            class="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Users class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Tidak ada data pelanggan yang cocok</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau tambah pelanggan baru</p>
          </div>

          <!-- Customer Item Card: Desain Lega & Interaktif -->
          <div 
            v-for="c in filteredCustomers" 
            :key="c.id"
            @click="openDetailView(c)"
            class="p-3.5 sm:p-4 bg-white hover:bg-slate-50/90 border border-slate-200/80 rounded-2xl transition-all shadow-2xs flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group active:scale-[0.99]"
          >
            <!-- Kolom Kiri: Avatar + Nama + Kontak & Alamat Terpisah -->
            <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
              <!-- Avatar Inisial Lembut & Elegan -->
              <div class="w-11 h-11 rounded-2xl bg-sky-50 group-hover:bg-[#0a193d] text-[#0284c7] group-hover:text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 border border-sky-100/80 group-hover:border-[#0a193d] transition-all shadow-2xs">
                {{ c.name ? c.name.charAt(0) : 'P' }}
              </div>

              <!-- Info Nama & Kontak (Setiap info di barisnya sendiri) -->
              <div class="min-w-0 flex-1 space-y-1">
                <!-- Baris 1: Nama Pelanggan & Badge Bon (Jika ada) -->
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-sm sm:text-base text-[#0a193d] truncate group-hover:text-[#0284c7] transition-colors leading-tight">
                    {{ c.name }}
                  </h4>
                  <span 
                    v-if="(c.totalDebt || 0) > 0" 
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 font-mono shrink-0"
                  >
                    Bon: Rp {{ (c.totalDebt || 0).toLocaleString('id-ID') }}
                  </span>
                </div>

                <!-- Baris 2: Nomor WhatsApp & Tombol Chat Langsung -->
                <div v-if="c.phone" class="text-xs text-slate-500 font-mono flex items-center gap-1.5 truncate">
                  <Phone class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span class="truncate">{{ formatPhone(c.phone) }}</span>
                  <button 
                    type="button" 
                    @click.stop="openWhatsAppChat(c)"
                    class="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2 py-0.5 rounded-full transition-colors shrink-0 ml-1 cursor-pointer"
                    title="Kirim pesan WhatsApp langsung"
                  >
                    <MessageSquare class="w-3 h-3 text-emerald-600" />
                    <span>Chat WA</span>
                  </button>
                </div>
                <p v-else class="text-[11px] text-slate-400 italic">
                  Nomor HP belum diisi
                </p>

                <!-- Baris 3: Alamat / Catatan Lokasi Rumah -->
                <p v-if="c.address" class="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span class="truncate">{{ c.address }}</span>
                </p>
              </div>
            </div>

            <!-- Kolom Kanan: Ringkasan Total Belanja & Panah Detail -->
            <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Belanja
                </span>
                <span class="font-mono font-bold text-xs sm:text-sm text-[#0a193d] block leading-tight">
                  Rp {{ getCustomerStats(c.id, c.name).totalSpent.toLocaleString('id-ID') }}
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5 font-medium">
                  {{ getCustomerStats(c.id, c.name).count }}x transaksi
                </span>
              </div>

              <!-- Chevron Panah Navigasi Detail -->
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 group-hover:bg-[#0a193d] group-hover:text-white text-slate-400 flex items-center justify-center transition-all shadow-2xs">
                <ChevronRight class="w-4 h-4" />
              </div>
            </div>

          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500 font-medium">
            Menampilkan {{ filteredCustomers.length }} dari {{ customers.length }} pelanggan
          </span>
          <button 
            @click="handleClose"
            class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>

      <!-- VIEW 2: FORM TAMBAH / EDIT PELANGGAN -->
      <div v-else-if="currentView === 'form'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">
              {{ customerForm.id ? 'Perbarui Profil Pelanggan' : 'Data Pelanggan Baru' }}
            </h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Daftar</span>
          </button>
        </div>

        <!-- Form Inputs -->
        <div class="space-y-3.5">
          <!-- Nama Lengkap Pelanggan -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Lengkap Pelanggan <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="customerForm.name"
                placeholder="Contoh: Bu Siti Rohmah, Pak Joko..."
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Nomor WhatsApp / HP -->
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

          <!-- Alamat / Catatan Tempat Tinggal -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Alamat / Catatan Rumah (Opsional)
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <MapPin class="w-4 h-4" />
              </span>
              <input 
                type="text" 
                v-model="customerForm.address"
                placeholder="Contoh: Depan musala RT 02, Blok B No. 12..."
                class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-xs font-semibold text-[#0a193d] outline-hidden transition-all"
              />
            </div>
          </div>

          <!-- Saldo Bon Awal -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Saldo Bon Awal (Rp, jika ada)
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
            @click="handleSave"
            :disabled="!customerForm.name.trim()"
            class="h-11 px-6 bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Check class="w-4 h-4 text-sky-400" />
            <span>Simpan Pelanggan</span>
          </button>
        </div>
      </div>

      <!-- VIEW 3: DETAIL & RIWAYAT BELANJA PELANGGAN -->
      <div v-else-if="currentView === 'detail'" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <!-- Sub-header Navigasi -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="font-bold text-sm text-[#0a193d]">Detail & Riwayat Belanja</h4>
          </div>
          <button 
            @click="currentView = 'list'"
            class="text-xs font-bold text-[#0284c7] hover:text-[#0a193d] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Kembali ke Daftar</span>
          </button>
        </div>

        <!-- Profil Ringkas Pelanggan & Tombol Aksi -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-sky-50 text-[#0284c7] font-bold text-lg flex items-center justify-center shrink-0 border border-sky-100 shadow-2xs">
                {{ selectedCustomer?.name ? selectedCustomer.name.charAt(0) : 'P' }}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-base text-[#0a193d] truncate">{{ selectedCustomer?.name }}</h4>
                <p v-if="selectedCustomer?.phone" class="text-xs text-slate-500 font-mono mt-0.5">
                  {{ formatPhone(selectedCustomer.phone) }}
                </p>
                <p v-if="selectedCustomer?.address" class="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin class="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{{ selectedCustomer.address }}</span>
                </p>
              </div>
            </div>

            <!-- Tombol Aksi di Layar Detail (Lega & Jelas) -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                type="button"
                @click="openWhatsAppChat(selectedCustomer)"
                class="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <MessageSquare class="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>

              <button 
                type="button"
                @click="openEditForm(selectedCustomer)"
                class="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <Edit2 class="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              <button 
                type="button"
                @click="handleDelete(selectedCustomer)"
                :class="[
                  'h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border shadow-2xs',
                  (selectedCustomer?.totalDebt || 0) > 0 
                    ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' 
                    : 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200 cursor-pointer'
                ]"
                :title="(selectedCustomer?.totalDebt || 0) > 0 ? 'Tidak bisa dihapus karena masih ada bon' : 'Hapus Pelanggan'"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>

          <!-- Statistik Ringkas Belanja -->
          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
            <div class="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Belanja</span>
              <span class="font-mono font-bold text-xs sm:text-sm text-[#0a193d] mt-0.5 block">
                Rp {{ getCustomerStats(selectedCustomer?.id, selectedCustomer?.name).totalSpent.toLocaleString('id-ID') }}
              </span>
            </div>
            <div class="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transaksi</span>
              <span class="font-mono font-bold text-xs sm:text-sm text-[#0a193d] mt-0.5 block">
                {{ getCustomerStats(selectedCustomer?.id, selectedCustomer?.name).count }} Kali
              </span>
            </div>
            <div class="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sisa Bon</span>
              <span :class="['font-mono font-bold text-xs sm:text-sm mt-0.5 block', (selectedCustomer?.totalDebt || 0) > 0 ? 'text-rose-600' : 'text-slate-400']">
                Rp {{ (selectedCustomer?.totalDebt || 0).toLocaleString('id-ID') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Daftar Riwayat Transaksi -->
        <div>
          <p class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Receipt class="w-3.5 h-3.5 text-slate-500" />
            <span>Semua Riwayat Transaksi ({{ customerTransactions.length }})</span>
          </p>

          <div v-if="customerTransactions.length === 0" class="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <ShoppingBag class="w-8 h-8 mb-1.5 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Belum ada riwayat transaksi belanja</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Saat melakukan pembayaran di kasir, pilih nama pelanggan ini agar tercatat otomatis</p>
          </div>

          <div v-else class="space-y-2 max-h-72 overflow-y-auto pr-1">
            <div 
              v-for="tx in customerTransactions" 
              :key="tx.invoiceNumber"
              class="p-3.5 bg-white border border-slate-200/80 rounded-2xl space-y-1.5 shadow-2xs"
            >
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold text-[#0a193d]">{{ tx.invoiceNumber }}</span>
                  <span 
                    :class="[
                      'text-[10px] font-bold px-2 py-0.2 rounded-full border',
                      tx.paymentMethod === 'TUNAI' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                        : 'bg-rose-50 text-rose-800 border-rose-200/60'
                    ]"
                  >
                    {{ tx.paymentMethod }}
                  </span>
                </div>
                <span class="text-slate-400 font-mono text-[11px]">{{ formatDateTime(tx.createdAt) }}</span>
              </div>

              <!-- Daftar Item Transaksi -->
              <div v-if="tx.items && tx.items.length > 0" class="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl">
                <div v-for="item in tx.items" :key="item.id" class="flex justify-between py-0.5 text-[11px]">
                  <span class="truncate mr-2">• {{ item.name }} (x{{ item.qty }})</span>
                  <span class="font-mono font-medium text-slate-700 shrink-0">Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}</span>
                </div>
              </div>

              <div class="flex justify-between text-xs pt-1 border-t border-slate-100 font-bold">
                <span class="text-slate-500">Total Belanja:</span>
                <span class="font-mono text-[#0a193d]">Rp {{ tx.totalAmount.toLocaleString('id-ID') }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
