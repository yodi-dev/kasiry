<script setup>
import { ref, computed } from 'vue'
import { 
  X, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Camera, 
  Store, 
  ChevronRight,
  Package
} from '@lucide/vue'

const props = defineProps({
  storeName: {
    type: String,
    default: 'Habiba Store'
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  totalDebtCount: {
    type: Number,
    default: 4
  },
  isGoogleConnected: {
    type: Boolean,
    default: false
  },
  googleUser: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'openDebtBook', 
  'openDailyReport', 
  'openSettings', 
  'openCamera',
  'openProductManage'
])

const isDrawerOpen = ref(false)

const todayFormatted = computed(() => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  }).format(new Date())
})

const triggerAction = (actionEvent) => {
  isDrawerOpen.value = false
  emit(actionEvent)
}
</script>

<template>
  <header class="w-full max-w-5xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
    <!-- Left: Sleek 2-Line Hamburger Menu Icon (matches reference) -->
    <button 
      @click="isDrawerOpen = true"
      class="w-10 h-10 rounded-2xl bg-white/70 hover:bg-white text-[#0a193d] flex flex-col items-start justify-center gap-1.5 px-2.5 shadow-xs border border-white/80 cursor-pointer transition-all"
      aria-label="Buka Menu"
    >
      <span class="w-5 h-0.5 bg-[#0a193d] rounded-full"></span>
      <span class="w-3.5 h-0.5 bg-[#0a193d] rounded-full"></span>
    </button>

    <!-- Center: Brand Title -->
    <div class="text-center">
      <h1 class="text-sm font-bold text-[#0a193d] tracking-tight">{{ storeName }}</h1>
      <p class="text-[11px] text-slate-500 font-medium">{{ todayFormatted }}</p>
    </div>

    <!-- Right: User/Store Profile Avatar (matches reference) -->
    <div class="relative cursor-pointer" @click="emit('openSettings')" role="button" title="Profil & Pengaturan Toko">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] p-0.5 shadow-sm border border-white/80 flex items-center justify-center overflow-hidden">
        <img 
          v-if="isGoogleConnected && googleUser?.picture" 
          :src="googleUser.picture" 
          referrerpolicy="no-referrer"
          class="w-full h-full rounded-[14px] object-cover"
        />
        <div v-else class="w-full h-full rounded-[14px] bg-[#0a193d] flex items-center justify-center text-white text-xs font-bold font-mono">
          {{ storeName ? storeName.substring(0, 2).toUpperCase() : 'HS' }}
        </div>
      </div>
      <!-- Online / Cloud Sync Status Dot -->
      <span 
        class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] text-white"
        :class="isGoogleConnected ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-slate-400'"
        :title="isGoogleConnected ? 'Cloud Sync Aktif' : isOnline ? 'Online' : 'Offline'"
      ></span>
    </div>

    <!-- Navigation Drawer -->
    <div 
      v-if="isDrawerOpen" 
      class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex justify-start transition-opacity duration-200"
      @click.self="isDrawerOpen = false"
    >
      <div 
        class="w-full max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200"
      >
        <div>
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Menu Kasiry</span>
            <button 
              @click="isDrawerOpen = false"
              class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 border-b border-slate-100 bg-[#edf5fd]/60">
            <p class="text-xs text-slate-500 font-medium">Toko:</p>
            <p class="text-base font-bold text-[#0a193d] mt-0.5">{{ storeName }}</p>
          </div>

          <nav class="p-3 space-y-1">
            <button 
              @click="triggerAction('openProductManage')"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
                  <Package class="w-4 h-4" />
                </div>
                <p class="text-sm font-semibold text-[#0a193d]">Kelola Barang</p>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-400" />
            </button>

            <button 
              @click="triggerAction('openDebtBook')"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                  <BookOpen class="w-4 h-4" />
                </div>
                <p class="text-sm font-semibold text-[#0a193d]">Buku Utang</p>
              </div>
              <div class="flex items-center gap-1.5">
                <span v-if="totalDebtCount > 0" class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {{ totalDebtCount }}
                </span>
                <ChevronRight class="w-4 h-4 text-slate-400" />
              </div>
            </button>

            <button 
              @click="triggerAction('openDailyReport')"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                  <BarChart3 class="w-4 h-4" />
                </div>
                <p class="text-sm font-semibold text-[#0a193d]">Laporan Kasir</p>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-400" />
            </button>

            <button 
              @click="triggerAction('openCamera')"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 text-[#0a193d] flex items-center justify-center shrink-0 border border-slate-200">
                  <Camera class="w-4 h-4" />
                </div>
                <p class="text-sm font-semibold text-[#0a193d]">Scan Kamera</p>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-400" />
            </button>

            <button 
              @click="triggerAction('openSettings')"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-100 text-[#0a193d] flex items-center justify-center shrink-0 border border-slate-200">
                  <Store class="w-4 h-4 text-[#0284c7]" />
                </div>
                <div>
                  <p class="text-sm font-semibold text-[#0a193d]">Profil & Pengaturan</p>
                  <p class="text-[11px] text-slate-400">Identitas, Google Sync & Cadangan</p>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-slate-400" />
            </button>
          </nav>
        </div>

        <div class="p-4 border-t border-slate-100 text-xs text-slate-500">
          <p class="font-bold text-slate-700">{{ storeName }}</p>
          <p class="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span>Crafted with ❤️ by</span>
            <a 
              href="https://awanbeo.my.id" 
              target="_blank" 
              rel="noopener noreferrer"
              class="font-bold text-[#0284c7] hover:underline"
            >
              awanbeo (awanbeo.my.id)
            </a>
          </p>
        </div>
      </div>
    </div>
  </header>
</template>
