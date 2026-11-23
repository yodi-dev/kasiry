<script setup>
import { computed } from 'vue'
import { X, BarChart3, MessageSquare, Download, TrendingUp, DollarSign, ShoppingBag, AlertCircle } from '@lucide/vue'

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
      topProducts: []
    })
  },
  storeName: {
    type: String,
    default: 'Habiba Store'
  }
})

const emit = defineEmits(['close', 'downloadExcel'])

const todayFormatted = computed(() => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())
})

// Format pesan WhatsApp
const generateWhatsAppText = () => {
  const totalCash = (props.stats.todaySales || 0) + (props.stats.todayDebtPaid || 0)
  let text = `*📊 LAPORAN KASIR ${props.storeName.toUpperCase()}*\n`
  text += `📅 Tanggal: ${todayFormatted.value}\n`
  text += `--------------------------------\n`
  text += `💵 *Total Uang Kas Masuk:* Rp ${totalCash.toLocaleString('id-ID')}\n`
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
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <!-- Header (Design System: Deep Navy & Clean Subtitle) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60">
            <BarChart3 class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Laporan Kasir Hari Ini</h3>
            <p class="text-xs text-slate-500 font-medium">{{ todayFormatted }}</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content Scrollable -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- 4 Kotak Ringkasan Kas (Warna Muted & Rapi) -->
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Total Uang Kas Masuk -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide block">Total Kas Masuk</span>
            <p class="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              Rp {{ ((stats.todaySales || 0) + (stats.todayDebtPaid || 0)).toLocaleString('id-ID') }}
            </p>
            <p class="text-[11px] text-slate-500 font-normal mt-0.5 truncate">
              Tunai: Rp {{ (stats.todaySales || 0).toLocaleString('id-ID') }}
              <span v-if="stats.todayDebtPaid > 0"> • Bon: Rp {{ stats.todayDebtPaid.toLocaleString('id-ID') }}</span>
            </p>
          </div>

          <!-- Perkiraan Untung Bersih -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide block">Untung Bersih</span>
            <p class="text-lg sm:text-xl font-bold text-emerald-700 mt-1">
              Rp {{ (stats.todayProfit || 0).toLocaleString('id-ID') }}
            </p>
            <p class="text-[11px] text-slate-500 font-normal mt-0.5">Estimasi selisih modal</p>
          </div>

          <!-- Total Transaksi -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-xs font-medium text-slate-500 uppercase block">Transaksi</span>
            <p class="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">
              {{ stats.transactionCount || 0 }} Kali
            </p>
            <p class="text-[11px] text-slate-500 font-normal">Struk dibuat</p>
          </div>

          <!-- Bon Baru -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-xs font-medium text-slate-500 uppercase block">Bon Baru</span>
            <p class="text-base sm:text-lg font-semibold text-red-600 mt-0.5">
              Rp {{ (stats.todayNewDebt || 0).toLocaleString('id-ID') }}
            </p>
            <p class="text-[11px] text-slate-500 font-normal">Utang dicatat</p>
          </div>
        </div>

        <!-- Barang Terlaris Top 5 -->
        <div>
          <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Barang Paling Laris Hari Ini:
          </h4>
          <div class="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <div 
              v-for="(item, idx) in stats.topProducts" 
              :key="item.name"
              class="p-2.5 px-3 flex items-center justify-between text-xs sm:text-sm"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center shrink-0">
                  {{ idx + 1 }}
                </span>
                <span class="font-medium text-slate-800 truncate">{{ item.name }}</span>
              </div>
              <div class="text-right shrink-0">
                <span class="text-slate-500 font-normal mr-2">{{ item.qty }} pcs</span>
                <span class="font-semibold text-slate-900">Rp {{ item.subtotal.toLocaleString('id-ID') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tombol Aksi Ekspor -->
        <div class="pt-2 space-y-2">
          <!-- Kirim ke WhatsApp -->
          <button 
            @click="shareToWhatsApp"
            class="w-full h-11 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
          >
            <MessageSquare class="w-4 h-4" />
            <span>Kirim Ringkasan ke WhatsApp</span>
          </button>

          <!-- Unduh File Excel (.xlsx) -->
          <button 
            @click="emit('downloadExcel')"
            class="w-full h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download class="w-3.5 h-3.5 text-slate-500" />
            <span>Unduh Laporan Excel (.xlsx)</span>
          </button>
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
  </div>
</template>
