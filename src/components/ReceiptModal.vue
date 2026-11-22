<script setup>
import { X, Printer, Check, ArrowRight } from '@lucide/vue'

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
      name: 'Habiba Store',
      phone: '081234567890'
    })
  }
})

const emit = defineEmits(['close', 'newTransaction'])

const printReceipt = () => {
  window.print()
}
</script>

<template>
  <div 
    v-if="isOpen && receiptData"
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
      <!-- Header Struk (Clean White & Emerald Check) -->
      <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
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

      <!-- Kertas Struk Thermal Preview -->
      <div class="flex-1 overflow-y-auto p-5 font-mono text-xs text-slate-700 space-y-2.5 bg-slate-50/50 border-b border-dashed border-slate-200">
        <!-- Kop Warung -->
        <div class="text-center space-y-0.5">
          <h4 class="font-bold text-sm text-slate-900 tracking-wider uppercase">{{ storeProfile.name }}</h4>
          <p class="text-[11px] text-slate-500">WA: {{ storeProfile.phone }}</p>
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
              <p class="text-[10px] text-slate-500">{{ item.qty }} x Rp {{ item.sellPrice.toLocaleString('id-ID') }}</p>
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

          <template v-else>
            <div class="flex justify-between font-semibold text-red-600 text-xs">
              <span>STATUS:</span>
              <span>DICATAT DI BUKU UTANG</span>
            </div>
          </template>
        </div>

        <!-- Footer Struk -->
        <div class="text-center pt-2 text-[10px] text-slate-500 space-y-0.5">
          <p class="font-medium">Matur Nuwun Atas Kunjungannya!</p>
          <p>Kasiry POS • www.kasiry.id</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="p-3 bg-white flex items-center justify-between gap-2 shrink-0">
        <button 
          @click="printReceipt"
          class="h-10 px-3 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200 transition-colors"
        >
          <Printer class="w-3.5 h-3.5 text-slate-500" />
          <span>Cetak</span>
        </button>

        <button 
          @click="emit('newTransaction')"
          class="flex-1 h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <span>Transaksi Baru</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
