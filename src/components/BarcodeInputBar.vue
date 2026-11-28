<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Search, Camera, X, PlusCircle } from '@lucide/vue'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  modalOpen: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'floating' // 'floating' (Mobile) | 'inline' (Tablet & Desktop)
  }
})

const emit = defineEmits([
  'update:searchQuery', 
  'selectProduct', 
  'openCamera', 
  'triggerLazyInventory'
])

const inputRef = ref(null)
const isFocused = ref(false)
const activeIndex = ref(0)
const resultItemRefs = ref([])

const setResultItemRef = (el, idx) => {
  if (el) resultItemRefs.value[idx] = el
}

const scrollActiveResultIntoView = () => {
  nextTick(() => {
    const activeEl = resultItemRefs.value[activeIndex.value]
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

watch(
  () => [props.searchQuery, props.searchResults],
  () => {
    activeIndex.value = 0
    resultItemRefs.value = []
  }
)

const isVisibleInstance = () => {
  return Boolean(inputRef.value && inputRef.value.offsetParent !== null)
}

// Deteksi ketat apakah perangkat adalah Desktop non-sentuh berlayar lebar (boleh autofocus otomatis)
const isDesktopAutoFocus = () => {
  if (typeof window === 'undefined') return false
  const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches ||
    window.matchMedia?.('(any-pointer: coarse)')?.matches
  const hasTouch = (navigator.maxTouchPoints || 0) > 0
  return window.innerWidth >= 1024 && !isCoarse && !hasTouch
}

// Pada HP/layar sentuh, kunci virtual keyboard sampai input benar-benar disentuh pengguna
const touchUnlocked = ref(isDesktopAutoFocus())

const syncInputKeyboardLock = (allowSoftKeyboard) => {
  const el = inputRef.value
  if (!el) return
  if (allowSoftKeyboard || isDesktopAutoFocus()) {
    el.inputMode = 'search'
  } else {
    el.inputMode = 'none'
  }
}

const handleInputTouchIntent = () => {
  if (props.modalOpen) return
  touchUnlocked.value = true
  syncInputKeyboardLock(true)
}

const handleInputFocus = () => {
  // Pengaman ganda: jika di perangkat sentuh fokus datang tanpa sentuhan langsung pada input, langsung blur
  if (!isDesktopAutoFocus() && !touchUnlocked.value) {
    blurInput()
    return
  }
  isFocused.value = true
}

const handleInputBlur = () => {
  isFocused.value = false
  if (!isDesktopAutoFocus()) {
    touchUnlocked.value = false
    syncInputKeyboardLock(false)
  }
}

const focusInput = (force = false) => {
  if (props.modalOpen || !isVisibleInstance()) return
  if (!force && !isDesktopAutoFocus()) return
  nextTick(() => {
    if (props.modalOpen || !isVisibleInstance()) return
    if (inputRef.value) {
      const activeEl = document.activeElement
      const isOtherInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== inputRef.value
      if (!isOtherInput) {
        touchUnlocked.value = true
        syncInputKeyboardLock(true)
        inputRef.value.focus({ preventScroll: true })
        isFocused.value = true
      }
    }
  })
}

const blurInput = () => {
  if (!isDesktopAutoFocus()) {
    touchUnlocked.value = false
    syncInputKeyboardLock(false)
  }
  inputRef.value?.blur()
  isFocused.value = false
}

// Global keydown: hanya fokus otomatis input di Desktop ber-keyboard fisik (tidak memicu soft keyboard di HP)
const handleGlobalKeyDown = (e) => {
  if (props.modalOpen || !isVisibleInstance()) return
  if (!isDesktopAutoFocus()) return
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) return
  if (e.key === '/') {
    e.preventDefault()
    focusInput(true)
    return
  }
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== 'F2') {
    focusInput()
  }
}

const handleWindowFocus = () => {
  if (isDesktopAutoFocus()) {
    focusInput()
  }
}

// Autofocus hanya pada desktop non-sentuh; pastikan atribut lock aktif di perangkat sentuh saat mount
onMounted(() => {
  if (isDesktopAutoFocus()) {
    touchUnlocked.value = true
    syncInputKeyboardLock(true)
    focusInput()
    setTimeout(focusInput, 150)
  } else {
    touchUnlocked.value = false
    syncInputKeyboardLock(false)
  }
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('keydown', handleGlobalKeyDown)
})

defineExpose({
  focusInput,
  blurInput
})

const handleInput = (e) => {
  emit('update:searchQuery', e.target.value)
}

const clearInput = () => {
  emit('update:searchQuery', '')
  if (isDesktopAutoFocus()) {
    focusInput()
  } else {
    blurInput()
  }
}

const onSelect = (product) => {
  emit('selectProduct', product)
  emit('update:searchQuery', '')
  if (isDesktopAutoFocus()) {
    focusInput()
  } else {
    blurInput()
  }
}

const onTriggerUnknown = () => {
  const code = props.searchQuery.trim() || '8999999888123'
  emit('triggerLazyInventory', code)
  emit('update:searchQuery', '')
  if (!isDesktopAutoFocus()) {
    blurInput()
  }
}

const handleArrowNavigation = (direction, e) => {
  const count = props.searchResults?.length || 0
  if (props.searchQuery.trim().length === 0 || count === 0) return
  e?.preventDefault()
  if (direction === 'down') {
    activeIndex.value = (activeIndex.value + 1) % count
  } else if (direction === 'up') {
    activeIndex.value = (activeIndex.value - 1 + count) % count
  }
  scrollActiveResultIntoView()
}

const handleEnter = (e) => {
  // Jangan submit jika IME keyboard sedang menyusun kata/komposisi
  if (e?.isComposing || e?.keyCode === 229) return
  e?.preventDefault()
  if (props.searchResults && props.searchResults.length > 0) {
    const targetProduct = props.searchResults[activeIndex.value] || props.searchResults[0]
    onSelect(targetProduct)
  } else if (props.searchQuery.trim().length > 0) {
    onTriggerUnknown()
  }
}
</script>

<template>
  <div role="search" class="relative w-full">
    <!-- Form Input Barcode & Search -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1 min-w-0">
        <div 
          class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors"
          :class="isFocused ? 'text-sky-600' : 'text-slate-400'"
        >
          <Search aria-hidden="true" class="w-4 h-4" />
        </div>

        <input
          ref="inputRef"
          type="text"
          :value="searchQuery"
          :inputmode="touchUnlocked ? 'search' : 'none'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
          enterkeyhint="search"
          @pointerdown="handleInputTouchIntent"
          @touchstart.passive="handleInputTouchIntent"
          @input="handleInput"
          @keydown.down="handleArrowNavigation('down', $event)"
          @keydown.up="handleArrowNavigation('up', $event)"
          @keydown.enter="handleEnter"
          @keydown.esc="clearInput"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="searchQuery.trim().length > 0"
          :aria-activedescendant="searchQuery.trim().length > 0 && searchResults.length > 0 ? `search-option-${variant}-${activeIndex}` : undefined"
          :placeholder="variant === 'inline' ? 'Cari nama barang atau scan barcode...' : 'Cari barang / scan barcode...'"
          aria-label="Cari nama barang atau scan barcode"
          class="w-full h-11 sm:h-11 pl-10 pr-10 text-base lg:text-sm font-medium bg-white/95 backdrop-blur-md text-[#0a193d] placeholder:text-slate-400 rounded-2xl border-2 transition-all outline-none"
          :class="[
            variant === 'inline' ? 'shadow-xs' : 'shadow-md',
            isFocused ? 'border-sky-500 ring-4 ring-sky-500/20 bg-white' : 'border-slate-200/80 hover:border-slate-300'
          ]"
        />

        <!-- Shortcut badge di Desktop/Tablet saat kosong -->
        <span
          v-if="variant === 'inline' && !searchQuery && !isFocused"
          aria-hidden="true"
          class="hidden lg:inline-flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-400 pointer-events-none"
        >
          /
        </span>

        <button 
          v-if="searchQuery"
          type="button"
          @click="clearInput"
          aria-label="Bersihkan pencarian"
          class="touch-hit-target absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X aria-hidden="true" class="w-4 h-4" />
        </button>
      </div>

      <!-- Tombol Scan Barcode Kamera -->
      <button 
        type="button"
        @click="emit('openCamera')"
        aria-label="Buka kamera scanner barcode"
        class="h-11 min-w-11 px-3 sm:px-4 bg-[#0a193d] hover:bg-[#102b66] text-white rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 shrink-0 shadow-sm"
        title="Buka Kamera Barcode"
      >
        <Camera aria-hidden="true" class="w-4 h-4 text-sky-400" />
        <span class="hidden sm:inline text-xs font-semibold">Scan Kamera</span>
      </button>
    </div>

    <!-- Dropdown Hasil Pencarian Dinamis (Membuka ke Atas pada Mobile Floating, ke Bawah pada Tablet/Desktop Inline) -->
    <div 
      v-if="searchQuery.trim().length > 0"
      role="listbox"
      class="kasiry-scroll-pane absolute left-0 right-0 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 z-40 overflow-hidden divide-y divide-slate-100 max-h-[42dvh] sm:max-h-72 overflow-y-auto"
      :class="variant === 'inline' ? 'top-full mt-2' : 'bottom-full mb-2.5'"
    >
      <div 
        v-for="(product, idx) in searchResults" 
        :key="product.id"
        :id="`search-option-${variant}-${idx}`"
        :ref="el => setResultItemRef(el, idx)"
        role="option"
        :aria-selected="idx === activeIndex"
        @mouseenter="activeIndex = idx"
        @click="onSelect(product)"
        class="p-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors"
        :class="idx === activeIndex ? 'bg-sky-50 ring-1 ring-inset ring-sky-200' : 'hover:bg-sky-50/60'"
      >
        <div class="min-w-0 pr-2">
          <p class="font-semibold text-[#0a193d] text-sm leading-snug truncate">{{ product.name }}</p>
          <p v-if="product.barcode" class="text-[11px] text-slate-400 font-mono mt-0.5">
            {{ product.barcode }}
          </p>
        </div>
        <div class="text-right shrink-0">
          <p v-if="product.sellPrice > 0" class="font-bold text-sky-700 text-sm">
            Rp {{ product.sellPrice.toLocaleString('id-ID') }}
          </p>
          <span v-else class="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-bold">
            Atur Harga
          </span>
        </div>
      </div>

      <div class="p-2.5 px-3 bg-slate-50 flex items-center justify-between gap-2">
        <span class="text-xs text-slate-500">Barang belum ada?</span>
        <button 
          @click="onTriggerUnknown"
          class="h-7 px-2.5 bg-[#0a193d] hover:bg-[#102b66] text-white font-medium text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
          <PlusCircle class="w-3.5 h-3.5 text-sky-400" />
          <span>Tambah Baru</span>
        </button>
      </div>
    </div>
  </div>
</template>
