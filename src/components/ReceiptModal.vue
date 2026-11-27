<script setup>
import { ref } from 'vue'
import { X, Printer, Bluetooth, Check, ArrowRight, Share2, CheckCircle, AlertCircle } from '@lucide/vue'
import { useThermalPrinter } from '../composables/useThermalPrinter'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  receiptData: {
    type: Object,
    default: () => null
  },
  storeProfile: {
    type: Object,
    default: () => ({
      name: 'Warung Kasiry',
      phone: ''
    })
  }
})

const emit = defineEmits(['close', 'newTransaction'])

const {
  printerSettings,
  isBluetoothSupported,
  isPrinterConnected,
  isConnectingPrinter,
  isPrinting,
  connectedPrinterName,
  printerError,
  connectBluetoothPrinter,
  printReceiptThermal
} = useThermalPrinter()

const printNotice = ref('')

const printReceipt = async (forceBrowser = false) => {
  printNotice.value = ''
  const res = await printReceiptThermal(props.receiptData, props.storeProfile, { forceBrowser })
  if (res?.ok && res.method === 'bluetooth') {
    printNotice.value = `Struk berhasil dicetak ke ${connectedPrinterName.value || 'Printer Bluetooth'}!`
    setTimeout(() => {
      printNotice.value = ''
    }, 2800)
  }
}

const shareToWhatsApp = () => {
  if (!props.receiptData) return
  const r = props.receiptData
  const store = props.storeProfile

  let itemsText = ''
  r.items.forEach(item => {
    const tierNote = item.priceTier && item.priceTier !== 'ecer'
      ? ` (${item.priceLabel || item.priceTier})`
      : ''
    itemsText += `- ${item.name} (${item.qty}x @ ${item.sellPrice.toLocaleString('id-ID')}${tierNote}) = Rp ${(item.sellPrice * item.qty).toLocaleString('id-ID')}\n`
  })

  const bayarText = r.paymentMethod === 'TUNAI'
    ? `Tunai: Rp ${r.cashGiven.toLocaleString('id-ID')}\nKembali: Rp ${r.changeAmount.toLocaleString('id-ID')}`
    : r.paymentMethod === 'QRIS'
      ? `Metode: QRIS (Lunas Non-Tunai)`
      : `Status: DICATAT DI BUKU UTANG (BON)\nPelanggan: ${r.customer?.name || '-'}`

  const cleanPhone = (store?.phone || '').trim()
  const cleanFooter = (printerSettings.value?.footerText || '').trim() || 'Matur nuwun atas kunjungannya!'
  const text = `*NOTA ${store.name.toUpperCase()}*\n` +
    (cleanPhone ? `WA: ${cleanPhone}\n` : '') +
    `--------------------------------\n` +
    `No: ${r.invoiceNumber}\n` +
    `Waktu: ${r.time}\n` +
    `--------------------------------\n` +
    itemsText +
    `--------------------------------\n` +
    `*TOTAL: Rp ${r.totalAmount.toLocaleString('id-ID')}*\n` +
    bayarText + `\n` +
    `--------------------------------\n` +
    cleanFooter

  const encoded = encodeURIComponent(text)
  const phone = prompt('Nomor WhatsApp Pembeli (Boleh kosong untuk pilih kontak di WA):', '')
  if (phone !== null) {
    let targetWa = phone.trim().replace(/\D/g, '')
    if (targetWa.startsWith('0')) {
      targetWa = '62' + targetWa.slice(1)
    }
    const url = targetWa ? `https://wa.me/${targetWa}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }
}
</script>

<template>
  <div 
    v-if="isOpen && receiptData"
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div
      class="bg-white rounded-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      :class="printerSettings.paperWidth === '80mm' ? 'max-w-md' : 'max-w-sm'"
    >
      <!-- Header Struk (Clean White & Emerald Check - disembunyikan saat cetak) -->
      <div class="print:hidden px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Check class="w-3.5 h-3.5" />
          </div>
          <h3 class="font-bold text-sm text-[#0a193d]">Transaksi Selesai</h3>
        </div>
        <button 
          @click="emit('close')"
          class="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Strip Status Printer Thermal Bluetooth (Print hidden) -->
      <div class="print:hidden px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-[11px] shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :class="isPrinterConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'"
          ></span>
          <span class="font-semibold text-slate-700 truncate">
            <template v-if="isPrinterConnected">
              BT: {{ connectedPrinterName }} ({{ printerSettings.paperWidth }})
            </template>
            <template v-else>
              Struk {{ printerSettings.paperWidth }} • {{ isBluetoothSupported ? 'Cetak Browser / BT' : 'Cetak Browser' }}
            </template>
          </span>
        </div>

        <button
          v-if="!isPrinterConnected && isBluetoothSupported"
          type="button"
          :disabled="isConnectingPrinter"
          @click="connectBluetoothPrinter"
          class="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#0284c7] border border-sky-200 font-bold flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Bluetooth class="w-3 h-3" />
          <span>{{ isConnectingPrinter ? 'Menghubungkan...' : 'Hubungkan BT' }}</span>
        </button>
      </div>

      <div
        v-if="printNotice"
        class="print:hidden mx-4 mt-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 flex items-center gap-1.5 shrink-0"
      >
        <CheckCircle class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{{ printNotice }}</span>
      </div>

      <div
        v-if="printerError"
        class="print:hidden mx-4 mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 flex items-center gap-1.5 shrink-0"
      >
        <AlertCircle class="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>{{ printerError }}</span>
      </div>

      <!-- Kertas Struk Thermal Preview (Dioptimasi untuk Printer Thermal 58mm / 80mm & Layar HP) -->
      <div
        class="thermal-receipt-paper flex-1 overflow-y-auto p-5 font-mono text-xs text-slate-700 space-y-2.5 bg-slate-50/50 border-b border-dashed border-slate-200"
        :class="printerSettings.paperWidth === '80mm' ? 'thermal-80mm' : ''"
      >
        <!-- Kop Warung -->
        <div class="text-center space-y-0.5">
          <h4 class="font-bold text-sm text-slate-900 tracking-wider uppercase">{{ storeProfile.name }}</h4>
          <p v-if="storeProfile.phone" class="text-[11px] text-slate-500">WA: {{ storeProfile.phone }}</p>
          <p class="text-[10px] text-slate-400">--------------------------------</p>
        </div>

        <!-- Meta Nota -->
        <div class="text-[11px] space-y-0.5">
          <div class="flex justify-between">
            <span>No: {{ receiptData.invoiceNumber }}</span>
            <span>{{ receiptData.time }}</span>
          </div>
          <div class="flex justify-between">
            <span>Metode: {{ receiptData.paymentMethod }}</span>
            <span v-if="receiptData.customer">Pelanggan: {{ receiptData.customer.name }}</span>
          </div>
          <p class="text-[10px] text-slate-400 text-center">================================</p>
        </div>

        <!-- Rincian Item -->
        <div class="space-y-1.5 divide-y divide-dashed divide-slate-200">
          <div 
            v-for="item in receiptData.items" 
            :key="item.id"
            class="pt-1.5 flex justify-between items-start"
          >
            <div class="min-w-0 pr-1">
              <p class="font-medium text-slate-900 truncate">{{ item.name }}</p>
              <p class="text-[10px] text-slate-500">
                {{ item.qty }} x Rp {{ item.sellPrice.toLocaleString('id-ID') }}
                <span v-if="item.priceTier && item.priceTier !== 'ecer'" class="font-bold">
                  ({{ item.priceLabel || item.priceTier }})
                </span>
              </p>
            </div>
            <div class="text-right shrink-0 font-medium">
              Rp {{ (item.sellPrice * item.qty).toLocaleString('id-ID') }}
            </div>
          </div>
        </div>

        <p class="text-[10px] text-slate-400 text-center pt-1">--------------------------------</p>

        <!-- Total, Bayar, Kembalian -->
        <div class="space-y-1 text-xs">
          <div class="flex justify-between font-bold text-sm text-slate-900">
            <span>TOTAL:</span>
            <span>Rp {{ receiptData.totalAmount.toLocaleString('id-ID') }}</span>
          </div>
          
          <template v-if="receiptData.paymentMethod === 'TUNAI'">
            <div class="flex justify-between text-slate-600">
              <span>Uang Diterima:</span>
              <span>Rp {{ receiptData.cashGiven.toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between font-semibold text-emerald-700 text-xs sm:text-sm">
              <span>KEMBALIAN:</span>
              <span>Rp {{ receiptData.changeAmount.toLocaleString('id-ID') }}</span>
            </div>
          </template>

          <template v-else-if="receiptData.paymentMethod === 'QRIS'">
            <div class="flex justify-between text-slate-600">
              <span>Bayar Pas (QRIS):</span>
              <span>Rp {{ receiptData.totalAmount.toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between font-semibold text-[#0284c7] text-xs">
              <span>STATUS:</span>
              <span>LUNAS (NON-TUNAI)</span>
            </div>
          </template>

          <template v-else>
            <div class="flex justify-between font-semibold text-red-600 text-xs">
              <span>STATUS:</span>
              <span>DICATAT DI BUKU UTANG</span>
            </div>
          </template>
        </div>

        <!-- Footer Struk -->
        <div class="text-center pt-2 text-[10px] text-slate-500 space-y-0.5">
          <p v-if="printerSettings.footerText" class="font-medium">{{ printerSettings.footerText }}</p>
          <p>Kasiry</p>
        </div>
      </div>

      <!-- Action Buttons (disembunyikan saat cetak) -->
      <div class="print:hidden p-3 bg-white flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 flex-wrap">
        <button 
          type="button"
          :disabled="isPrinting"
          @click="printReceipt(false)"
          class="h-10 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200 transition-colors disabled:opacity-50"
          :title="isPrinterConnected ? 'Cetak langsung ke printer thermal Bluetooth' : 'Cetak struk ke printer thermal/browser'"
        >
          <Bluetooth v-if="isPrinterConnected" class="w-3.5 h-3.5 text-emerald-600" />
          <Printer v-else class="w-3.5 h-3.5 text-slate-500" />
          <span>{{ isPrinting ? 'Mencetak...' : (isPrinterConnected ? 'Cetak BT' : 'Cetak') }}</span>
        </button>

        <button
          v-if="isPrinterConnected"
          type="button"
          @click="printReceipt(true)"
          class="h-10 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-[11px] rounded-xl cursor-pointer border border-slate-200 transition-colors"
          title="Cetak lewat dialog cetak browser / USB"
        >
          Browser
        </button>

        <button 
          type="button"
          @click="shareToWhatsApp"
          class="h-10 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-emerald-200 transition-colors"
          title="Kirim nota belanja digital via WhatsApp"
        >
          <Share2 class="w-3.5 h-3.5 text-emerald-700" />
          <span>WA</span>
        </button>

        <button 
          type="button"
          @click="emit('newTransaction')"
          class="flex-1 h-10 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-colors min-w-[115px]"
        >
          <span>Transaksi Baru</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  @page {
    margin: 0;
  }
  body,
  body * {
    visibility: hidden !important;
  }
  .thermal-receipt-paper,
  .thermal-receipt-paper * {
    visibility: visible !important;
  }
  .thermal-receipt-paper {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 58mm !important;
    max-width: 58mm !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 3mm !important;
    background: #ffffff !important;
    color: #000000 !important;
    border: none !important;
    box-shadow: none !important;
    font-size: 11px !important;
    line-height: 1.25 !important;
  }
  .thermal-receipt-paper.thermal-80mm {
    width: 80mm !important;
    max-width: 80mm !important;
    font-size: 12px !important;
  }
}
</style>
