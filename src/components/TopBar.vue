<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Camera, 
  Store, 
  ChevronRight, 
  Package, 
  Users 
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
  todayTxCount: {
    type: Number,
    default: 0
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
  'openProductManage', 
  'openCustomerManage',
  'drawerClosed'
])

const isDrawerOpen = ref(false)

const closeDrawer = () => {
  isDrawerOpen.value = false
  emit('drawerClosed')
}

watch(isDrawerOpen, (newVal) => {
  if (!newVal) {
    emit('drawerClosed')
  }
})

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

const navItems = computed(() => [
  {
    event: 'openProductManage',
    label: 'Kelola Barang',
    shortLabel: 'Barang',
    icon: Package,
    iconBg: 'bg-sky-50 text-sky-700 border-sky-100',
    badge: 0,
    badgeClass: ''
  },
  {
    event: 'openCustomerManage',
    label: 'Data Pelanggan',
    shortLabel: 'Pelanggan',
    icon: Users,
    iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
    badge: 0,
    badgeClass: ''
  },
  {
    event: 'openDebtBook',
    label: 'Buku Utang',
    shortLabel: 'Utang',
    icon: BookOpen,
    iconBg: 'bg-red-50 text-red-600 border-red-100',
    badge: props.totalDebtCount,
    badgeClass: 'bg-red-100 text-red-700'
  },
  {
    event: 'openDailyReport',
    label: 'Laporan Kasir',
    shortLabel: 'Laporan',
    icon: BarChart3,
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    badge: props.todayTxCount,
    badgeClass: 'bg-emerald-100 text-emerald-700'
  },
  {
    event: 'openSettings',
    label: 'Pengaturan & Cadangan',
    shortLabel: 'Setelan',
    icon: Settings,
    iconBg: 'bg-slate-100 text-slate-700 border-slate-200/80',
    badge: 0,
    badgeClass: ''
  }
])
</script>

<template>
  <header class="w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-3 sm:pt-3.5 pb-1.5 shrink-0">
    <div class="flex items-center justify-between gap-2 md:gap-3 md:bg-white/75 md:backdrop-blur-md md:rounded-2xl md:border md:border-white/90 md:shadow-xs md:px-4 md:py-2">
      <!-- Mobile Left: Sleek 2-Line Hamburger Menu Icon -->
      <button 
        type="button"
        @click="isDrawerOpen = true"
        class="md:hidden w-11 h-11 rounded-2xl bg-white/80 hover:bg-white text-[#0a193d] flex flex-col items-start justify-center gap-1.5 px-3 shadow-xs border border-white/80 cursor-pointer transition-all shrink-0"
        aria-label="Buka Menu"
      >
        <span aria-hidden="true" class="w-5 h-0.5 bg-[#0a193d] rounded-full"></span>
        <span aria-hidden="true" class="w-3.5 h-0.5 bg-[#0a193d] rounded-full"></span>
      </button>

      <!-- Brand Identity Lockup (Mobile: Centered | Tablet & Desktop: Left with Mini Avatar) -->
      <div class="min-w-0 flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5">
        <button
          type="button"
          @click="emit('openSettings')"
          class="hidden md:flex relative shrink-0 rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7]"
          aria-label="Profil Toko dan Status Sinkron"
          :title="isGoogleConnected ? 'Cloud Sync Aktif — Klik untuk Pengaturan' : 'Pengaturan Toko & Cadangan'"
        >
          <div class="size-9 rounded-xl bg-linear-to-tr from-[#0284c7] to-[#38bdf8] p-0.5 shadow-xs border border-white/80 flex items-center justify-center overflow-hidden">
            <img 
              v-if="isGoogleConnected && googleUser?.picture" 
              :src="googleUser.picture" 
              :alt="googleUser?.name || storeName"
              referrerpolicy="no-referrer"
              class="w-full h-full rounded-[10px] object-cover"
            />
            <div v-else class="w-full h-full rounded-[10px] bg-[#0a193d] flex items-center justify-center text-white text-xs font-bold font-mono">
              {{ storeName ? storeName.substring(0, 2).toUpperCase() : 'HS' }}
            </div>
          </div>
          <span 
            aria-hidden="true"
            class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
            :class="isGoogleConnected ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-slate-400'"
          ></span>
        </button>

        <div class="min-w-0 text-center md:text-left leading-tight">
          <div class="flex items-center justify-center md:justify-start gap-1.5">
            <span class="text-[10px] font-bold tracking-[0.14em] uppercase text-[#0284c7]">Kasiry</span>
            <span 
              class="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              :class="isGoogleConnected ? 'bg-emerald-50 text-emerald-700' : isOnline ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'"
            >
              <span aria-hidden="true" class="size-1.5 rounded-full" :class="isGoogleConnected ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-slate-400'"></span>
              {{ isGoogleConnected ? 'Cloud Aktif' : isOnline ? 'Online' : 'Offline' }}
            </span>
          </div>
          <h1 class="text-sm sm:text-base font-bold text-[#0a193d] tracking-tight truncate max-w-[190px] sm:max-w-[240px]">{{ storeName }}</h1>
          <p class="text-[11px] text-slate-500 font-medium md:hidden">{{ todayFormatted }}</p>
        </div>
      </div>

      <!-- Tablet & Desktop Quick Command Navigation (1-Klik Akses Semua Fitur POS) -->
      <nav class="hidden md:flex items-center gap-1 lg:gap-1.5 shrink-0" aria-label="Navigasi Kasir">
        <button
          v-for="item in navItems"
          :key="item.event"
          type="button"
          @click="emit(item.event)"
          class="h-9 px-2.5 lg:px-3 rounded-xl bg-white/80 hover:bg-[#0a193d] text-[#0a193d] hover:text-white border border-slate-200/70 hover:border-[#0a193d] shadow-2xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all group"
          :title="item.label"
        >
          <component :is="item.icon" aria-hidden="true" class="size-3.5 text-[#0284c7] group-hover:text-sky-300 shrink-0 transition-colors" />
          <span class="lg:hidden">{{ item.shortLabel }}</span>
          <span class="hidden lg:inline whitespace-nowrap">{{ item.label }}</span>
          <span 
            v-if="item.badge > 0"
            class="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none tabular-nums"
            :class="item.badgeClass"
          >
            {{ item.badge }}
          </span>
        </button>
      </nav>

      <!-- Mobile Right: User/Store Profile Avatar -->
      <button 
        type="button"
        class="md:hidden relative cursor-pointer shrink-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7]" 
        @click="emit('openSettings')" 
        aria-label="Profil dan Pengaturan Toko"
        title="Profil & Pengaturan Toko"
      >
        <div class="w-11 h-11 rounded-2xl bg-linear-to-tr from-[#0284c7] to-[#38bdf8] p-0.5 shadow-sm border border-white/80 flex items-center justify-center overflow-hidden">
          <img 
            v-if="isGoogleConnected && googleUser?.picture" 
            :src="googleUser.picture" 
            :alt="googleUser?.name || storeName"
            referrerpolicy="no-referrer"
            class="w-full h-full rounded-[14px] object-cover"
          />
          <div v-else class="w-full h-full rounded-[14px] bg-[#0a193d] flex items-center justify-center text-white text-xs font-bold font-mono">
            {{ storeName ? storeName.substring(0, 2).toUpperCase() : 'HS' }}
          </div>
        </div>
        <!-- Online / Cloud Sync Status Dot -->
        <span 
          aria-hidden="true"
          class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] text-white"
          :class="isGoogleConnected ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-slate-400'"
          :title="isGoogleConnected ? 'Cloud Sync Aktif' : isOnline ? 'Online' : 'Offline'"
        ></span>
      </button>
    </div>

    <!-- Mobile Navigation Drawer -->
    <div 
      v-if="isDrawerOpen" 
      class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex justify-start transition-opacity duration-200"
      @click.self="closeDrawer"
    >
      <div 
        class="w-full max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200"
      >
        <div>
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Toko</p>
              <p class="text-base font-bold text-[#0a193d]">{{ storeName }}</p>
            </div>
            <button 
              type="button"
              @click="closeDrawer"
              class="w-10 h-10 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Tutup Menu"
            >
              <X aria-hidden="true" class="w-5 h-5" />
            </button>
          </div>

          <nav class="p-3 space-y-1" aria-label="Menu Utama">
            <button 
              v-for="item in navItems"
              :key="'drawer-' + item.event"
              type="button"
              @click="triggerAction(item.event)"
              class="w-full p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border" :class="item.iconBg">
                  <component :is="item.icon" aria-hidden="true" class="w-4 h-4" />
                </div>
                <p class="text-sm font-semibold text-[#0a193d]">{{ item.label }}</p>
              </div>
              <div class="flex items-center gap-1.5">
                <span v-if="item.badge > 0" class="px-2 py-0.5 text-xs font-bold rounded-full tabular-nums" :class="item.badgeClass">
                  {{ item.badge }}
                </span>
                <ChevronRight aria-hidden="true" class="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </nav>
        </div>

        <div class="p-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <div>
            <p class="font-bold text-slate-700">Kasiry</p>
            <p class="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <span>Crafted with ❤️ by</span>
              <a 
                href="https://awanbeo.my.id" 
                target="_blank" 
                rel="noopener noreferrer"
                class="font-bold text-[#0284c7] hover:underline"
              >
                awanbeo
              </a>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2.5 pt-1 text-[11px] text-slate-400">
            <a href="/privacy.html" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2">Kebijakan Privasi</a>
            <span aria-hidden="true">•</span>
            <a href="/terms.html" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2">Ketentuan Layanan</a>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
