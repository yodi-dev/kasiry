<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronDown,
  Package,
  PackagePlus,
  Users,
  Wallet,
  Clock
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
  todayExpenseCount: {
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
  },
  activeShift: {
    type: Object,
    default: null
  },
  isActiveShiftStale: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'openDebtBook',
  'openDailyReport',
  'openExpense',
  'openRestock',
  'openShift',
  'openSettings',
  'openCamera',
  'openProductManage',
  'openCustomerManage',
  'drawerOpened',
  'drawerClosed'
])

const isDrawerOpen = ref(false)
const isDataMenuOpen = ref(false)
const dataMenuRef = ref(null)

const openDrawer = () => {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  isDataMenuOpen.value = false
  isDrawerOpen.value = true
  emit('drawerOpened')
}

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

const shiftChipInfo = computed(() => {
  if (!props.activeShift) {
    return {
      label: 'Belum Buka Shift',
      shortLabel: 'Buka Shift',
      badge: 'Tutup',
      badgeClass: 'bg-slate-100 text-slate-600',
      chipClass: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80',
      dotClass: 'bg-amber-500'
    }
  }
  const timeStr = props.activeShift.openedAt
    ? new Date(props.activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : ''
  const firstName = String(props.activeShift.cashierName || 'Kasir').trim().split(/\s+/)[0]
  if (props.isActiveShiftStale) {
    return {
      label: `Shift Kemarin • Tutup`,
      shortLabel: 'Shift Kemarin',
      badge: 'Kemarin',
      badgeClass: 'bg-amber-100 text-amber-800',
      chipClass: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300',
      dotClass: 'bg-amber-600 animate-pulse'
    }
  }
  return {
    label: `Shift ${firstName}${timeStr ? ` · ${timeStr}` : ''}`,
    shortLabel: `Shift ${timeStr}`,
    badge: 'Aktif',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    chipClass: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80',
    dotClass: 'bg-emerald-500'
  }
})

const triggerAction = (actionEvent) => {
  isDrawerOpen.value = false
  isDataMenuOpen.value = false
  emit(actionEvent)
}

const toggleDataMenu = () => {
  isDataMenuOpen.value = !isDataMenuOpen.value
}

const handleDocumentClick = (e) => {
  if (!isDataMenuOpen.value) return
  if (dataMenuRef.value && !dataMenuRef.value.contains(e.target)) {
    isDataMenuOpen.value = false
  }
}

const handleDocumentKeydown = (e) => {
  if (e.key === 'Escape' && isDataMenuOpen.value) {
    isDataMenuOpen.value = false
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleDocumentKeydown)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('keydown', handleDocumentKeydown)
  }
})

// Dropdown Stok & Data (Desktop/Tablet)
const dataMenuItems = [
  {
    event: 'openProductManage',
    label: 'Kelola Barang',
    description: 'Katalog, harga & kategori',
    icon: Package,
    iconBg: 'bg-sky-50 text-sky-700 border-sky-100'
  },
  {
    event: 'openRestock',
    label: 'Kulakan Stok',
    description: 'Belanja barang, modal & stok',
    icon: PackagePlus,
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100'
  },
  {
    event: 'openCustomerManage',
    label: 'Data Pelanggan',
    description: 'Pelanggan loyal & kontak WA',
    icon: Users,
    iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100'
  }
]

// Tombol operasional harian 1-klik di TopBar Desktop/Tablet
const quickNavItems = computed(() => [
  {
    event: 'openDebtBook',
    label: 'Buku Utang',
    shortLabel: 'Utang',
    icon: BookOpen,
    iconColor: 'text-rose-600 group-hover:text-rose-300',
    badge: props.totalDebtCount,
    badgeClass: 'bg-red-100 text-red-700'
  },
  {
    event: 'openExpense',
    label: 'Kas Keluar',
    shortLabel: 'Keluar',
    icon: Wallet,
    iconColor: 'text-amber-600 group-hover:text-amber-300',
    badge: props.todayExpenseCount,
    badgeClass: 'bg-amber-100 text-amber-800'
  },
  {
    event: 'openDailyReport',
    label: 'Laporan',
    shortLabel: 'Laporan',
    icon: BarChart3,
    iconColor: 'text-emerald-600 group-hover:text-emerald-300',
    badge: props.todayTxCount,
    badgeClass: 'bg-emerald-100 text-emerald-700'
  }
])

// Drawer HP: tetap 1-tap per item tanpa dropdown, terkelompok berdasarkan domain operasional
const drawerGroups = computed(() => [
  {
    title: 'Keuangan & Kasir',
    items: [
      {
        event: 'openShift',
        label: props.activeShift ? 'Tutup / Info Shift' : 'Buka Shift Kasir',
        icon: Clock,
        iconBg: props.activeShift
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-100',
        badge: shiftChipInfo.value.badge,
        badgeClass: shiftChipInfo.value.badgeClass
      },
      {
        event: 'openExpense',
        label: 'Kas Keluar',
        icon: Wallet,
        iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
        badge: props.todayExpenseCount,
        badgeClass: 'bg-amber-100 text-amber-800'
      },
      {
        event: 'openDebtBook',
        label: 'Buku Utang',
        icon: BookOpen,
        iconBg: 'bg-red-50 text-red-600 border-red-100',
        badge: props.totalDebtCount,
        badgeClass: 'bg-red-100 text-red-700'
      },
      {
        event: 'openDailyReport',
        label: 'Laporan Kasir',
        icon: BarChart3,
        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        badge: props.todayTxCount,
        badgeClass: 'bg-emerald-100 text-emerald-700'
      }
    ]
  },
  {
    title: 'Stok & Pelanggan',
    items: [
      {
        event: 'openProductManage',
        label: 'Kelola Barang',
        icon: Package,
        iconBg: 'bg-sky-50 text-sky-700 border-sky-100',
        badge: 0,
        badgeClass: ''
      },
      {
        event: 'openRestock',
        label: 'Kulakan Stok',
        icon: PackagePlus,
        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        badge: 0,
        badgeClass: ''
      },
      {
        event: 'openCustomerManage',
        label: 'Data Pelanggan',
        icon: Users,
        iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
        badge: 0,
        badgeClass: ''
      }
    ]
  },
  {
    title: 'Sistem',
    items: [
      {
        event: 'openSettings',
        label: 'Pengaturan & Cadangan',
        icon: Settings,
        iconBg: 'bg-slate-100 text-slate-700 border-slate-200/80',
        badge: 0,
        badgeClass: ''
      }
    ]
  }
])
</script>

<template>
  <header class="relative z-40 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-3 sm:pt-3.5 pb-1.5 shrink-0">
    <div class="flex items-center justify-between gap-2 md:gap-3 md:bg-white/75 md:backdrop-blur-md md:rounded-2xl md:border md:border-white/90 md:shadow-xs md:px-4 md:py-2">
      <!-- Mobile Left: Sleek 2-Line Hamburger Menu Icon -->
      <button
        type="button"
        @click="openDrawer"
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
          <div class="flex items-center justify-center md:justify-start gap-1.5 flex-wrap">
            <span class="text-[10px] font-bold tracking-[0.14em] uppercase text-[#0284c7]">Kasiry</span>
            <span
              class="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              :class="isGoogleConnected ? 'bg-emerald-50 text-emerald-700' : isOnline ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'"
            >
              <span aria-hidden="true" class="size-1.5 rounded-full" :class="isGoogleConnected ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-slate-400'"></span>
              {{ isGoogleConnected ? 'Cloud Aktif' : isOnline ? 'Online' : 'Offline' }}
            </span>
            <button
              type="button"
              @click="triggerAction('openShift')"
              class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors"
              :class="shiftChipInfo.chipClass"
              :title="activeShift ? 'Lihat Info / Tutup Shift Kasir' : 'Klik untuk Buka Shift & Atur Modal Awal'"
            >
              <span aria-hidden="true" class="size-1.5 rounded-full" :class="shiftChipInfo.dotClass"></span>
              <span class="whitespace-nowrap">{{ shiftChipInfo.label }}</span>
            </button>
          </div>
          <h1 class="text-sm sm:text-base font-bold text-[#0a193d] tracking-tight truncate max-w-[190px] sm:max-w-[230px]">{{ storeName }}</h1>
          <div class="md:hidden flex items-center justify-center gap-1.5 mt-0.5">
            <span class="text-[11px] text-slate-500 font-medium">{{ todayFormatted }}</span>
            <button
              type="button"
              @click="triggerAction('openShift')"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors"
              :class="shiftChipInfo.chipClass"
            >
              <span aria-hidden="true" class="size-1.5 rounded-full" :class="shiftChipInfo.dotClass"></span>
              <span>{{ shiftChipInfo.shortLabel }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tablet & Desktop Compact Command Navigation (Stok & Data ▾ | Buku Utang | Kas Keluar | Laporan | Gear) -->
      <nav class="hidden md:flex items-center gap-1.5 shrink-0" aria-label="Navigasi Kasir">
        <!-- Dropdown Stok & Data -->
        <div ref="dataMenuRef" class="relative">
          <button
            type="button"
            @click="toggleDataMenu"
            :aria-expanded="isDataMenuOpen"
            aria-haspopup="menu"
            :class="[
              'h-9 px-2.5 lg:px-3 rounded-xl border shadow-2xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all group',
              isDataMenuOpen
                ? 'bg-[#0a193d] text-white border-[#0a193d]'
                : 'bg-white/85 hover:bg-[#0a193d] text-[#0a193d] hover:text-white border-slate-200/70 hover:border-[#0a193d]'
            ]"
            title="Kelola Barang & Data Pelanggan"
          >
            <Package
              aria-hidden="true"
              :class="[
                'size-3.5 shrink-0 transition-colors',
                isDataMenuOpen ? 'text-sky-300' : 'text-[#0284c7] group-hover:text-sky-300'
              ]"
            />
            <span class="lg:hidden">Stok</span>
            <span class="hidden lg:inline whitespace-nowrap">Stok &amp; Data</span>
            <ChevronDown
              aria-hidden="true"
              :class="['size-3.5 transition-transform duration-150', isDataMenuOpen ? 'rotate-180 text-sky-300' : 'text-slate-400 group-hover:text-sky-300']"
            />
          </button>

          <!-- Dropdown Panel -->
          <div
            v-if="isDataMenuOpen"
            role="menu"
            class="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              v-for="sub in dataMenuItems"
              :key="sub.event"
              type="button"
              role="menuitem"
              @click="triggerAction(sub.event)"
              class="w-full p-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
            >
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border" :class="sub.iconBg">
                <component :is="sub.icon" aria-hidden="true" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-[#0a193d] leading-tight">{{ sub.label }}</p>
                <p class="text-[11px] text-slate-500 leading-tight mt-0.5">{{ sub.description }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- 1-Klik Tombol Operasional Harian -->
        <button
          v-for="item in quickNavItems"
          :key="item.event"
          type="button"
          @click="triggerAction(item.event)"
          class="h-9 px-2.5 lg:px-3 rounded-xl bg-white/85 hover:bg-[#0a193d] text-[#0a193d] hover:text-white border border-slate-200/70 hover:border-[#0a193d] shadow-2xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all group"
          :title="item.label"
        >
          <component :is="item.icon" aria-hidden="true" class="size-3.5 shrink-0 transition-colors" :class="item.iconColor" />
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

        <!-- Compact Icon-Only Gear Settings Button -->
        <button
          type="button"
          @click="triggerAction('openSettings')"
          class="w-9 h-9 rounded-xl bg-white/85 hover:bg-[#0a193d] text-slate-700 hover:text-white border border-slate-200/70 hover:border-[#0a193d] shadow-2xs flex items-center justify-center cursor-pointer transition-all shrink-0"
          aria-label="Pengaturan & Cadangan"
          title="Pengaturan & Cadangan"
        >
          <Settings aria-hidden="true" class="size-4" />
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

    <!-- Mobile Navigation Drawer (Grouped 1-Tap List) -->
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

          <nav class="p-3 space-y-3" aria-label="Menu Utama">
            <div v-for="group in drawerGroups" :key="group.title" class="space-y-1">
              <p class="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {{ group.title }}
              </p>
              <button
                v-for="item in group.items"
                :key="'drawer-' + item.event"
                type="button"
                @click="triggerAction(item.event)"
                class="w-full p-2.5 rounded-2xl hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border" :class="item.iconBg">
                    <component :is="item.icon" aria-hidden="true" class="w-4 h-4" />
                  </div>
                  <p class="text-sm font-semibold text-[#0a193d]">{{ item.label }}</p>
                </div>
                <div class="flex items-center gap-1.5">
                  <span v-if="item.badge !== 0 && item.badge !== ''" class="px-2 py-0.5 text-xs font-bold rounded-full tabular-nums" :class="item.badgeClass">
                    {{ item.badge }}
                  </span>
                  <ChevronRight aria-hidden="true" class="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
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
