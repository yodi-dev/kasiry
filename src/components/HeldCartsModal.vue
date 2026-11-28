<script setup>
import { X, Clock, Trash2, RotateCcw, ShoppingBag, PauseCircle } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  heldCarts: {
    type: Array,
    default: () => []
  },
  hasActiveCart: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'resume', 'remove'])

const formatTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

const tierLabel = (tier) => {
  if (tier === 'agen') return 'Agen'
  if (tier === 'grosir') return 'Grosir'
  return 'Ecer'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0a193d]/60 backdrop-blur-xs p-0 sm:p-4"
      @click.self="emit('close')"
    >
      <div
        class="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85dvh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="held-carts-title"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <PauseCircle aria-hidden="true" class="w-5 h-5" />
            </div>
            <div>
              <h2 id="held-carts-title" class="font-bold text-[#0a193d] text-base leading-tight">
                Antrean Keranjang ({{ heldCarts.length }})
              </h2>
              <p class="text-xs text-slate-500">
                Lanjutkan transaksi yang sempat ditunda
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
            aria-label="Tutup"
          >
            <X aria-hidden="true" class="w-4 h-4" />
          </button>
        </div>

        <!-- Info jika keranjang aktif tidak kosong -->
        <div
          v-if="hasActiveCart && heldCarts.length > 0"
          class="mx-5 mt-3 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200/80 text-xs text-sky-800 font-medium"
        >
          Keranjang aktif saat ini akan otomatis disimpan ke antrean jika Anda melanjutkan antrean lain.
        </div>

        <!-- List -->
        <div class="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          <div
            v-if="heldCarts.length === 0"
            class="py-12 text-center text-slate-400 flex flex-col items-center"
          >
            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <ShoppingBag aria-hidden="true" class="w-5 h-5" />
            </div>
            <p class="font-bold text-[#0a193d] text-sm">Belum Ada Keranjang Ditunda</p>
            <p class="text-xs text-slate-400 mt-1 max-w-[240px]">
              Tekan tombol <strong>Tunda</strong> di keranjang untuk menyimpan sementara pesanan pembeli.
            </p>
          </div>

          <div
            v-for="entry in heldCarts"
            :key="entry.id"
            class="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-sky-300 transition-colors space-y-2.5 shadow-2xs"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-[#0a193d] text-sm truncate">
                    {{ entry.label }}
                  </span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {{ tierLabel(entry.priceTier) }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span class="inline-flex items-center gap-1">
                    <Clock aria-hidden="true" class="w-3 h-3" />
                    {{ formatTime(entry.createdAt) }}
                  </span>
                  <span>•</span>
                  <span>{{ entry.items.length }} jenis ({{ entry.totalCount }} pcs)</span>
                </div>
              </div>
              <p class="font-black text-[#0a193d] text-sm sm:text-base tabular-nums shrink-0">
                Rp {{ Number(entry.totalAmount || 0).toLocaleString('id-ID') }}
              </p>
            </div>

            <!-- Preview ringkas item -->
            <p class="text-xs text-slate-500 truncate">
              {{ entry.items.map(i => `${i.name} ×${i.qty}`).join(', ') }}
            </p>

            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                @click="emit('remove', entry.id)"
                class="h-8 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 aria-hidden="true" class="w-3.5 h-3.5" />
                Hapus
              </button>
              <button
                type="button"
                @click="emit('resume', entry.id)"
                class="h-8 px-3.5 rounded-xl text-xs font-bold bg-[#0a193d] hover:bg-[#102b66] text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw aria-hidden="true" class="w-3.5 h-3.5" />
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
