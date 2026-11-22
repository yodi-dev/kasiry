<script setup>
import { ref, computed } from 'vue'
import { X, BookOpen, MessageSquare, Check, DollarSign, Search } from '@lucide/vue'

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
    default: 'Warung Berkah Bu Tejo'
  }
})

const emit = defineEmits(['close', 'recordPayment'])

const searchQuery = ref('')
const selectedCustomer = ref(null)
const paymentAmount = ref('')
const showPayDialog = ref(false)

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.customers
  return props.customers.filter(c => c.name.toLowerCase().includes(q))
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

// Format pengingat WhatsApp sopan
const shareWhatsAppReminder = (c) => {
  const msg = `Halo ${c.name}, sekadar menginfokan catatan bon belanja di ${props.storeName} saat ini tercatat sebesar Rp ${c.totalDebt.toLocaleString('id-ID')}. Jika ada waktu senggang, bisa mampir ya. Matur nuwun.`
  const url = `https://wa.me/${c.phone ? c.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`
  window.open(url, '_blank')
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <!-- Header (Clean White & Slate) -->
      <div class="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
            <BookOpen class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-900 leading-tight">Buku Utang Digital</h3>
            <p class="text-xs text-slate-500 font-normal">Catatan bon belanja tetangga & pembayaran</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Total Piutang Warung Banner -->
      <div class="mx-4 my-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Uang di Luar (Piutang):</p>
          <p class="text-xs text-slate-500 font-normal mt-0.5">Dari {{ customers.length }} orang tetangga</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-red-600">Rp {{ totalAllDebt.toLocaleString('id-ID') }}</p>
        </div>
      </div>

      <!-- Pencarian Pelanggan -->
      <div class="px-4 pb-2 shrink-0">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Cari nama pelanggan..."
            class="w-full h-10 pl-9 pr-3 text-sm font-normal bg-white border border-slate-200 rounded-xl focus:border-slate-800 outline-hidden"
          />
        </div>
      </div>

      <!-- List Pengutang -->
      <div class="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div 
          v-for="c in filteredList" 
          :key="c.id"
          class="p-3 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
        >
          <div class="min-w-0">
            <h4 class="font-medium text-slate-900 text-sm leading-tight truncate">{{ c.name }}</h4>
            <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 font-normal">
              <span v-if="c.phone" class="font-mono text-[11px]">{{ c.phone }}</span>
              <span>Terakhir: {{ c.lastDate || 'Kemarin' }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div class="text-left sm:text-right">
              <span class="text-[10px] font-medium text-slate-400 block uppercase">Sisa Bon</span>
              <span class="font-semibold text-red-600 text-sm sm:text-base">
                Rp {{ c.totalDebt.toLocaleString('id-ID') }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                @click="shareWhatsAppReminder(c)"
                class="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Kirim pengingat WA"
              >
                <MessageSquare class="w-3.5 h-3.5 text-emerald-700" />
                <span class="hidden sm:inline">WA</span>
              </button>

              <button 
                @click="openPayModal(c)"
                class="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <DollarSign class="w-3.5 h-3.5" />
                <span>Bayar/Cicil</span>
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
          Tutup
        </button>
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

        <div class="grid grid-cols-2 gap-2">
          <button 
            @click="paymentAmount = String(selectedCustomer?.totalDebt || 0)"
            class="h-9 bg-emerald-50 text-emerald-800 font-medium text-xs rounded-lg border border-emerald-200 cursor-pointer"
          >
            Lunas Semua
          </button>
          <button 
            @click="paymentAmount = '10000'"
            class="h-9 bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 cursor-pointer"
          >
            Rp 10.000
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
