<script setup>
import { ref, computed } from 'vue'
import { 
  X, 
  BarChart3, 
  MessageSquare, 
  Download, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertCircle, 
  Receipt, 
  Clock, 
  Calendar,
  Wallet
} from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  stats: {
    type: Object,
    default: () => ({
      todaySales: 1485000,
      todayProfit: 285000,
      transactionCount: 42,
      todayNewDebt: 60000,
      todayDebtPaid: 0,
      topProducts: []
    })
  },
  transactions: {
    type: Array,
    default: () => []
  },
  storeName: {
    type: String,
    default: 'Habiba Store'
  },
  isExporting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'downloadExcel'])

// Active Tab: 'summary' | 'history'
const activeTab = ref('summary')

const todayFormatted = computed(() => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())
})

// Daftar transaksi hari ini diurutkan dari yang terbaru
const todayTransactions = computed(() => {
  if (!props.transactions || props.transactions.length === 0) return []
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayTimestamp = startOfDay.getTime()

  return props.transactions
    .filter(t => (t.createdAt || 0) >= todayTimestamp)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// Format pesan WhatsApp laporan harian
const generateWhatsAppText = () => {
  const totalCash = (props.stats.todaySales || 0) + (props.stats.todayDebtPaid || 0)
  let text = `*📊 LAPORAN KASIR ${props.storeName.toUpperCase()}*\n`
  text += `📅 Tanggal: ${todayFormatted.value}\n`
  text += `--------------------------------\n`
  text += `💵 *Total Kas Masuk:* Rp ${totalCash.toLocaleString('id-ID')}\n`
  text += `   • Penjualan Tunai: Rp ${(props.stats.todaySales || 0).toLocaleString('id-ID')}\n`
  if (props.stats.todayDebtPaid > 0) {
    text += `   • Pelunasan Bon: Rp ${props.stats.todayDebtPaid.toLocaleString('id-ID')}\n`
  }
  text += `📈 *Perkiraan Untung Bersih:* Rp ${(props.stats.todayProfit || 0).toLocaleString('id-ID')}\n`
  text += `🧾 *Jumlah Transaksi:* ${props.stats.transactionCount || 0} struk\n`
  if (props.stats.todayNewDebt > 0) {
    text += `📋 *Bon/Utang Baru:* Rp ${props.stats.todayNewDebt.toLocaleString('id-ID')}\n`
  }
  text += `--------------------------------\n`
  text += `⭐ *Barang Paling Laris Hari Ini:*\n`
  if (props.stats.topProducts && props.stats.topProducts.length > 0) {
    props.stats.topProducts.forEach((p, idx) => {
      text += `${idx + 1}. ${p.name} (${p.qty}x) = Rp ${p.subtotal.toLocaleString('id-ID')}\n`
    })
  } else {
    text += `(Belum ada data barang terjual hari ini)\n`
  }
  text += `--------------------------------\n`
  text += `Dicatat otomatis via Kasiry POS.`
  return text
}

const shareToWhatsApp = () => {
  const text = generateWhatsAppText()
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <BarChart3 class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              Laporan Penjualan Hari Ini
            </h3>
            <p class="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <Calendar class="w-3.5 h-3.5 text-slate-400" />
              <span>{{ todayFormatted }}</span>
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

      <!-- 2. Segmented Pill Tab Switcher -->
      <div class="px-5 pt-3.5 pb-1 shrink-0 bg-white border-b border-slate-100">
        <div class="p-1 bg-slate-100 rounded-2xl flex gap-1">
          <button 
            @click="activeTab = 'summary'"
            :class="[
              'flex-1 h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all',
              activeTab === 'summary' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <BarChart3 class="w-4 h-4" />
            <span>Ringkasan Kas</span>
          </button>

          <button 
            @click="activeTab = 'history'"
            :class="[
              'flex-1 h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all',
              activeTab === 'history' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Receipt class="w-4 h-4" />
            <span>Riwayat Transaksi ({{ todayTransactions.length }})</span>
          </button>
        </div>
      </div>

      <!-- 3. Modal Body Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        
        <!-- TAB 1: RINGKASAN KAS & STATISTIK -->
        <div v-if="activeTab === 'summary'" class="space-y-4">
          <!-- 4 Kartu Indikator Keuangan -->
          <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
            <!-- Total Uang Kas Masuk -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Kas Masuk</span>
              <p class="text-xl sm:text-2xl font-bold font-mono text-[#0a193d] mt-1 leading-tight">
                Rp {{ ((stats.todaySales || 0) + (stats.todayDebtPaid || 0)).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1 truncate">
                Tunai: Rp {{ (stats.todaySales || 0).toLocaleString('id-ID') }}
                <span v-if="stats.todayDebtPaid > 0"> • Bon: Rp {{ stats.todayDebtPaid.toLocaleString('id-ID') }}</span>
              </p>
            </div>

            <!-- Perkiraan Untung Bersih (Laba) -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Untung Bersih (Laba)</span>
              <p class="text-xl sm:text-2xl font-bold font-mono text-emerald-700 mt-1 leading-tight">
                Rp {{ (stats.todayProfit || 0).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1">Estimasi selisih modal</p>
            </div>

            <!-- Total Transaksi -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Transaksi</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-[#0a193d] mt-1 leading-tight">
                {{ stats.transactionCount || 0 }} Struk
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1">Struk kasir tercatat</p>
            </div>

            <!-- Bon Baru -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bon / Utang Baru</span>
              <p class="text-lg sm:text-xl font-bold font-mono text-rose-600 mt-1 leading-tight">
                Rp {{ (stats.todayNewDebt || 0).toLocaleString('id-ID') }}
              </p>
              <p class="text-[11px] text-slate-500 font-medium mt-1">Dicatat di buku utang</p>
            </div>
          </div>

          <!-- Top 5 Produk Paling Laris -->
          <div>
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <TrendingUp class="w-4 h-4 text-[#0284c7]" />
              <span>Barang Paling Laris Hari Ini</span>
            </h4>

            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              <div 
                v-if="!stats.topProducts || stats.topProducts.length === 0"
                class="p-6 text-center text-slate-400 text-xs"
              >
                <ShoppingBag class="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p class="font-medium text-slate-500">Belum ada barang terjual hari ini</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Transaksi penjualan hari ini akan otomatis muncul di sini</p>
              </div>

              <div 
                v-for="(item, idx) in stats.topProducts" 
                :key="item.name"
                class="p-3 sm:p-3.5 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-50/80 transition-colors"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span 
                    :class="[
                      'w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border',
                      idx === 0 
                        ? 'bg-amber-50 text-amber-800 border-amber-200/70' 
                        : idx === 1 
                        ? 'bg-slate-100 text-slate-700 border-slate-200' 
                        : 'bg-slate-50 text-slate-500 border-slate-200/60'
                    ]"
                  >
                    {{ idx + 1 }}
                  </span>
                  <span class="font-bold text-[#0a193d] truncate">{{ item.name }}</span>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-slate-500 font-medium mr-2 font-mono text-xs">{{ item.qty }} pcs</span>
                  <span class="font-bold font-mono text-[#0a193d]">Rp {{ item.subtotal.toLocaleString('id-ID') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tombol Aksi Ekspor & Berbagi -->
          <div class="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- Kirim ke WhatsApp -->
            <button 
              @click="shareToWhatsApp"
              class="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs"
            >
              <MessageSquare class="w-4 h-4" />
              <span>Kirim Ringkasan ke WhatsApp</span>
            </button>

            <!-- Unduh File Excel (.xlsx) -->
            <button 
              @click="emit('downloadExcel')"
              :disabled="isExporting"
              class="h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-2xs disabled:opacity-60 disabled:cursor-wait"
            >
              <span v-if="isExporting" class="w-4 h-4 rounded-full border-2 border-[#0284c7] border-t-transparent animate-spin"></span>
              <Download v-else class="w-4 h-4 text-slate-500" />
              <span>{{ isExporting ? 'Menyiapkan Excel...' : 'Unduh Laporan Excel (.xlsx)' }}</span>
            </button>
          </div>
        </div>

        <!-- TAB 2: RIWAYAT TRANSAKSI HARI INI -->
        <div v-else-if="activeTab === 'history'" class="space-y-2.5">
          <div 
            v-if="todayTransactions.length === 0" 
            class="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400"
          >
            <Receipt class="w-10 h-10 mb-2 text-slate-300" />
            <p class="text-xs font-semibold text-slate-500">Belum ada transaksi hari ini</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Semua nota pembayaran kasir hari ini akan tercatat di sini</p>
          </div>

          <!-- Daftar Struk Hari Ini -->
          <div 
            v-for="tx in todayTransactions" 
            :key="tx.invoiceNumber"
            class="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl transition-all shadow-2xs space-y-2"
          >
            <!-- Header Struk -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono font-bold text-xs text-[#0a193d]">{{ tx.invoiceNumber }}</span>
                <span 
                  :class="[
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    tx.paymentMethod === 'TUNAI' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' 
                      : 'bg-rose-50 text-rose-800 border-rose-200/60'
                  ]"
                >
                  {{ tx.paymentMethod }}
                </span>
                <span v-if="tx.customerName" class="text-xs text-slate-500 font-semibold truncate">
                  • {{ tx.customerName }}
                </span>
              </div>

              <div class="flex items-center gap-1 text-slate-400 font-mono text-xs shrink-0">
                <Clock class="w-3.5 h-3.5" />
                <span>{{ formatTime(tx.createdAt) }}</span>
              </div>
            </div>

            <!-- Item-item Struk -->
            <div v-if="tx.items && tx.items.length > 0" class="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <div v-for="item in tx.items" :key="item.id" class="flex items-center justify-between py-0.5">
                <span class="truncate mr-2">• {{ item.name }} (x{{ item.qty }})</span>
                <span class="font-mono text-slate-700 shrink-0">Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}</span>
              </div>
            </div>

            <!-- Total Akhir Struk -->
            <div class="flex items-center justify-between pt-1 text-xs">
              <span class="text-slate-500 font-medium">Total Pembayaran:</span>
              <span class="font-mono font-bold text-sm text-[#0a193d]">
                Rp {{ tx.totalAmount.toLocaleString('id-ID') }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- 4. Modal Footer -->
      <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
        <span class="text-xs text-slate-500 font-medium">
          Laporan diperbarui otomatis secara real-time
        </span>
        <button 
          @click="emit('close')"
          class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
        >
          Tutup
        </button>
      </div>

    </div>
  </div>
</template>
