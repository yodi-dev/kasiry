<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, X } from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  reason: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['submit', 'cancel'])

const pinInput = ref('')
const showPin = ref(false)
const inputRef = ref(null)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      pinInput.value = ''
      showPin.value = false
      nextTick(() => {
        inputRef.value?.focus?.()
      })
    }
  },
  { immediate: true }
)

const submitPin = () => {
  emit('submit', pinInput.value)
}

const handleKeydown = (e) => {
  if (!props.isOpen) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-60 bg-[#0a193d]/55 backdrop-blur-xs flex items-center justify-center p-4"
    @click.self="emit('cancel')"
  >
    <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center shrink-0">
            <Lock class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-[#0a193d]">Verifikasi Sandi Pemilik</h3>
            <p class="text-[11px] text-slate-500 leading-tight mt-0.5">
              Masukkan PIN / kata sandi untuk {{ reason || 'melanjutkan' }}
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('cancel')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          aria-label="Tutup"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <form @submit.prevent="submitPin" class="p-5 space-y-3.5">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            PIN / Kata Sandi Pemilik
          </label>
          <div class="relative">
            <input
              ref="inputRef"
              :type="showPin ? 'text' : 'password'"
              v-model="pinInput"
              autocomplete="current-password"
              placeholder="Masukkan sandi pemilik..."
              class="w-full h-11 pl-3.5 pr-10 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-2xl text-sm font-bold text-[#0a193d] outline-hidden transition-all"
            />
            <button
              type="button"
              @click="showPin = !showPin"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
              :aria-label="showPin ? 'Sembunyikan sandi' : 'Lihat sandi'"
            >
              <EyeOff v-if="showPin" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2"
        >
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            @click="emit('cancel')"
            class="h-11 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            class="flex-1 h-11 px-4 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldCheck class="w-4 h-4 text-sky-400" />
            <span>Buka Akses (15 Mnt)</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
