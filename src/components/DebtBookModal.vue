<script setup>
import { ref, computed } from 'vue'
import { X, BookOpen, MessageSquare, Check, DollarSign, Search, UserPlus, Trash2 } from '@lucide/vue'

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

const searchQuery = ref('')
const selectedCustomer = ref(null)
const paymentAmount = ref('')
const showPayDialog = ref(false)
const showAddModal = ref(false)
const activeFilter = ref('unpaid') // 'all' | 'unpaid' | 'paid'

// Form tambah pelanggan baru
const newName = ref('')
const newPhone = ref('')
const newDebt = ref('')

const unpaidCount = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) > 0).length
})

const paidCount = computed(() => {
  return props.customers.filter(c => (c.totalDebt || 0) <= 0).length
})

const filteredList = computed(() => {
  let list = props.customers

  if (activeFilter.value === 'unpaid') {
    list = list.filter(c => (c.totalDebt || 0) > 0)
  } else if (activeFilter.value === 'paid') {
    list = list.filter(c => (c.totalDebt || 0) <= 0)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.phone && c.phone.includes(q))
  )
})

const totalAllDebt = computed(() => {
  return props.customers.reduce((acc, c) => acc + (c.totalDebt || 0), 0)
})

const openPayModal = (c) => {
  selectedCustomer.value = c
  paymentAmount.value = String(c.totalDebt)
  showPayDialog.value = true
}

const confirmPay = () => {
  const amt = parseInt(paymentAmount.value.replace(/\D/g, '') || '0', 10)
  if (amt <= 0 || !selectedCustomer.value) return
  emit('recordPayment', {
    customerId: selectedCustomer.value.id,
    amount: amt
  })
  showPayDialog.value = false
}

const handleAddCustomer = () => {
  if (!newName.value.trim()) return
  const initialDebt = parseInt(newDebt.value.replace(/\D/g, '') || '0', 10)

  emit('addCustomer', {
    name: newName.value.trim(),
    phone: newPhone.value.trim(),
    totalDebt: initialDebt,
    lastDate: 'Hari ini'
  })

  newName.value = ''
  newPhone.value = ''
  newDebt.value = ''
  showAddModal.value = false
}

const handleDelete = (c) => {
  if (confirm(`Hapus catatan pelanggan "${c.name}" dari buku utang?`)) {
    emit('deleteCustomer', c.id)
  }
}

// Format pengingat WhatsApp sopan khas warung
const shareWhatsAppReminder = (c) => {
  const msg = `Halo Bu/Pak ${c.name}, sekadar menginfokan catatan bon belanja di ${props.storeName} saat ini tercatat sebesar Rp ${c.totalDebt.toLocaleString('id-ID')}.\n\nJika ada waktu senggang, bisa mampir ya. Matur nuwun 🙏`
  
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
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <!-- Header (Design System: Deep Navy & Clean Subtitle) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100/60">
            <BookOpen class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Buku Utang Digital</h3>
            <p class="text-xs text-slate-500 font-medium">Catatan bon belanja tetangga & pembayaran</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Total Piutang Warung Banner -->
      <div class="mx-4 my-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Uang di Luar (Piutang):</p>
          <p class="text-xs text-slate-500 font-normal mt-0.5">Dari {{ unpaidCount }} orang tetangga yang belum lunas</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-red-600">Rp {{ totalAllDebt.toLocaleString('id-ID') }}</p>
        </div>
      </div>

      <!-- Filter Tabs & Tombol Tambah Tetangga -->
      <div class="px-4 pb-2 shrink-0 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button 
            @click="activeFilter = 'unpaid'"
            :class="[
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              activeFilter === 'unpaid' ? 'bg-white text-red-600 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Belum Lunas ({{ unpaidCount }})
          </button>
          <button 
            @click="activeFilter = 'all'"
            :class="[
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              activeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Semua ({{ customers.length }})
          </button>
          <button 
            @click="activeFilter = 'paid'"
            :class="[
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              activeFilter === 'paid' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Lunas ({{ paidCount }})
          </button>
        </div>

        <button 
          @click="showAddModal = true"
          class="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>+ Tambah Tetangga</span>
        </button>
      </div>

      <!-- Pencarian Pelanggan -->
      <div class="px-4 pb-2 shrink-0">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Cari nama atau no. WA tetangga..."
            class="w-full h-10 pl-9 pr-3 text-sm font-normal bg-white border border-slate-200 rounded-xl focus:border-slate-800 outline-hidden"
          />
        </div>
      </div>

      <!-- List Pengutang -->
      <div class="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div 
          v-if="filteredList.length === 0" 
          class="text-center py-8 text-slate-400 text-xs"
        >
          Tidak ada data pelanggan yang cocok.
        </div>

        <div 
          v-for="c in filteredList" 
          :key="c.id"
          class="p-3 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-medium text-slate-900 text-sm leading-tight truncate">{{ c.name }}</h4>
              <span 
                v-if="(c.totalDebt || 0) <= 0" 
                class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium"
              >
                Lunas ✓
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 font-normal">
              <span v-if="c.phone" class="font-mono text-[11px] text-slate-600">WA: {{ c.phone }}</span>
              <span>• Terakhir: {{ c.lastDate || 'Hari ini' }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div class="text-left sm:text-right">
              <span class="text-[10px] font-medium text-slate-400 block uppercase">Sisa Bon</span>
              <span 
                :class="[
                  'font-bold text-sm sm:text-base',
                  (c.totalDebt || 0) > 0 ? 'text-red-600' : 'text-slate-400'
                ]"
              >
                Rp {{ (c.totalDebt || 0).toLocaleString('id-ID') }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                v-if="(c.totalDebt || 0) > 0"
                @click="shareWhatsAppReminder(c)"
                class="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Kirim pengingat WA sopan"
              >
                <MessageSquare class="w-3.5 h-3.5 text-emerald-700" />
                <span class="hidden sm:inline">WA</span>
              </button>

              <button 
                v-if="(c.totalDebt || 0) > 0"
                @click="openPayModal(c)"
                class="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <DollarSign class="w-3.5 h-3.5" />
                <span>Bayar/Cicil</span>
              </button>

              <button 
                @click="handleDelete(c)"
                class="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                title="Hapus pelanggan"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-slate-50/70 border-t border-slate-200 flex justify-end shrink-0">
        <button 
          @click="emit('close')"
          class="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 cursor-pointer text-xs"
        >
          Selesai
        </button>
      </div>
    </div>

    <!-- Sub-Modal: Tambah Pelanggan Baru -->
    <div 
      v-if="showAddModal"
      class="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4"
    >
      <div class="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-slate-200 space-y-3">
        <div class="flex justify-between items-center">
          <h4 class="font-semibold text-slate-900 text-sm">Tambah Tetangga / Pelanggan</h4>
          <button @click="showAddModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-2.5">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Nama Tetangga / Pelanggan: *
            </label>
            <input 
              type="text" 
              v-model="newName"
              placeholder="Contoh: Bu RT Siti, Pak Joko..."
              class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-slate-800 rounded-xl text-sm font-medium text-slate-900 outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Nomor WhatsApp / HP (Opsional):
            </label>
            <input 
              type="text" 
              v-model="newPhone"
              placeholder="081234567890"
              class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-slate-800 rounded-xl text-sm font-mono text-slate-900 outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Saldo Bon Awal (Rp, jika ada dari buku fisik):
            </label>
            <input 
              type="number" 
              v-model="newDebt"
              placeholder="0"
              class="w-full h-10 px-3 bg-white border border-slate-300 focus:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 text-right outline-hidden"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button 
            @click="showAddModal = false"
            class="h-9 px-3 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg cursor-pointer"
          >
            Batal
          </button>
          <button 
            @click="handleAddCustomer"
            class="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Check class="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
      </div>
    </div>

    <!-- Sub-Modal: Input Nominal Pembayaran Cicilan / Pelunasan -->
    <div 
      v-if="showPayDialog"
      class="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4"
    >
      <div class="bg-white rounded-2xl w-full max-w-sm p-4 shadow-xl border border-slate-200 space-y-3">
        <div class="flex justify-between items-center">
          <h4 class="font-semibold text-slate-900 text-sm">Catat Pembayaran Utang</h4>
          <button @click="showPayDialog = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <p class="text-xs text-slate-500">Pelanggan:</p>
          <p class="font-medium text-slate-900 text-sm">{{ selectedCustomer?.name }}</p>
          <p class="text-xs text-red-600 font-semibold mt-0.5">
            Total Bon: Rp {{ selectedCustomer?.totalDebt.toLocaleString('id-ID') }}
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Nominal Dibayarkan (Rp):
          </label>
          <input 
            type="number" 
            v-model="paymentAmount"
            class="w-full h-11 px-3 bg-white border border-slate-300 focus:border-emerald-700 rounded-xl text-base font-semibold text-slate-900 text-right outline-hidden"
          />
        </div>

        <div class="grid grid-cols-4 gap-1.5">
          <button 
            @click="paymentAmount = String(selectedCustomer?.totalDebt || 0)"
            class="h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs rounded-lg border border-emerald-200 cursor-pointer col-span-2"
          >
            Lunas Semua
          </button>
          <button 
            @click="paymentAmount = '10000'"
            class="h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer"
          >
            10rb
          </button>
          <button 
            @click="paymentAmount = '20000'"
            class="h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer"
          >
            20rb
          </button>
          <button 
            @click="paymentAmount = '50000'"
            class="h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer col-span-2"
          >
            50rb
          </button>
          <button 
            @click="paymentAmount = '100000'"
            class="h-8 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer col-span-2"
          >
            100rb
          </button>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button 
            @click="showPayDialog = false"
            class="h-9 px-3 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg cursor-pointer"
          >
            Batal
          </button>
          <button 
            @click="confirmPay"
            class="h-9 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <Check class="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
