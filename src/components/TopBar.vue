<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { APP_BRAND_NAME, APP_BRAND_TAGLINE, getStoreInitials } from '../utils/branding'
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
  Clock,
  ArrowLeftRight,
  Smartphone,
  Zap,
  Landmark,
  Lock,
  Unlock
} from '@lucide/vue'

const props = defineProps({
  storeName: {
    type: String,
    default: 'Warung Kasiry'
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  totalDebtCount: {
    type: Number,
    default: 0
  },
  todayTxCount: {
    type: Number,
    default: 0
  },
  todayExpenseCount: {
    type: Number,
    default: 0
  },
  todayCashServiceCount: {
    type: Number,
    default: 0
  },
  todayDigitalCount: {
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
  },
  isOwnerPinEnabled: {
    type: Boolean,
    default: false
  },
  isOwnerUnlocked: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'openDebtBook',
  'openDailyReport',
  'openFinance',
  'openExpense',
  'openCashService',
  'openDigitalProduct',
  'openRestock',
  'openShift',
  'openSettings',
  'openCamera',
  'openProductManage',
  'openCustomerManage',
  'unlockOwner',
  'lockOwner',
  'drawerOpened',
  'drawerClosed'
])

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.22.2'
const isDrawerOpen = ref(false)
const openMenuKey = ref(null) // 'data' | 'service' | 'finance' | null
const desktopMenusRef = ref(null)

const openDrawer = () => {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  openMenuKey.value = null
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

const connectionStatus = computed(() => {
  if (props.isGoogleConnected) {
    return {
      label: 'Cloud Aktif',
      tooltip: 'Cloud Sync Aktif — Klik untuk Pengaturan',
      dotClass: 'bg-emerald-500',
      pillClass: 'bg-emerald-50 text-emerald-700'
    }
  }
  if (props.isOnline) {
    return {
      label: 'Online',
      tooltip: 'Online (Data Lokal) — Klik untuk Pengaturan',
      dotClass: 'bg-sky-500',
      pillClass: 'bg-sky-50 text-sky-700'
    }
  }
  return {
    label: 'Offline',
    tooltip: 'Mode Offline — Tetap Bisa Transaksi',
    dotClass: 'bg-slate-400',
    pillClass: 'bg-slate-100 text-slate-600'
  }
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
  openMenuKey.value = null
  emit(actionEvent)
}

const toggleMenu = (menuKey) => {
  openMenuKey.value = openMenuKey.value === menuKey ? null : menuKey
}

const handleDocumentClick = (e) => {
  if (openMenuKey.value && desktopMenusRef.value && !desktopMenusRef.value.contains(e.target)) {
    openMenuKey.value = null
  }
}

const handleDocumentKeydown = (e) => {
  if (e.key === 'Escape') {
    openMenuKey.value = null
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

// Dropdown Layanan Konter (Desktop/Tablet)
const serviceMenuItems = computed(() => [
  {
    event: 'openDigitalProduct',
    label: 'Pulsa & Token PLN',
    description: 'Pulsa, paket data & token listrik',
    icon: Zap,
    iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
    badge: props.todayDigitalCount,
    badgeClass: 'bg-sky-100 text-sky-700'
  },
  {
    event: 'openCashService',
    label: 'Tarik Tunai & Transfer',
    description: 'Tarik tunai laci & transfer/top-up',
    icon: ArrowLeftRight,
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    badge: props.todayCashServiceCount,
    badgeClass: 'bg-emerald-100 text-emerald-700'
  }
])

const totalServiceBadgeCount = computed(
  () => Number(props.todayDigitalCount || 0) + Number(props.todayCashServiceCount || 0)
)

// Dropdown Keuangan, Buku Utang & Kas Keluar (Desktop/Tablet)
const financeMenuItems = computed(() => [
  {
    event: 'openFinance',
    label: 'Manajemen Keuangan & Tabungan',
    description: 'Saldo 5 kantong, tabungan & mutasi',
    icon: Landmark,
    iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
    badge: 0,
    badgeClass: ''
  },
  {
    event: 'openDebtBook',
    label: 'Buku Utang',
    description: 'Piutang pelanggan, cicilan & tagih WA',
    icon: BookOpen,
    iconBg: 'bg-red-50 text-red-600 border-red-100',
    badge: props.totalDebtCount,
    badgeClass: 'bg-red-100 text-red-700'
  },
  {
    event: 'openExpense',
    label: 'Kas Keluar',
    description: 'Biaya operasional, makan & ambil kas',
    icon: Wallet,
    iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
    badge: props.todayExpenseCount,
    badgeClass: 'bg-amber-100 text-amber-800'
  }
])

const totalFinanceBadgeCount = computed(
  () => Number(props.totalDebtCount || 0) + Number(props.todayExpenseCount || 0)
)

const desktopDropdownMenus = computed(() => [
  {
    key: 'data',
    label: 'Stok & Data',
    shortLabel: 'Stok',
    title: 'Kelola Barang & Data Pelanggan',
    icon: Package,
    panelWidthClass: 'w-60',
    badge: 0,
    badgeClass: '',
    items: dataMenuItems
  },
  {
    key: 'service',
    label: 'Layanan',
    shortLabel: 'Layanan',
    title: 'Pulsa, Token PLN & Tarik Tunai',
    icon: Zap,
    panelWidthClass: 'w-68',
    badge: totalServiceBadgeCount.value,
    badgeClass: 'bg-sky-100 text-sky-700',
    items: serviceMenuItems.value
  },
  {
    key: 'finance',
    label: 'Keuangan',
    shortLabel: 'Kas',
    title: 'Keuangan, Buku Utang & Kas Keluar',
    icon: Landmark,
    panelWidthClass: 'w-72',
    badge: totalFinanceBadgeCount.value,
    badgeClass: Number(props.totalDebtCount || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
    items: financeMenuItems.value
  }
])

// Tombol inti kasir 1-klik di TopBar Desktop/Tablet
const quickNavItems = computed(() => [
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
    title: 'Shift & Layanan Konter',
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
        event: 'openDigitalProduct',
        label: 'Pulsa & Token PLN',
        icon: Smartphone,
        iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
        badge: props.todayDigitalCount,
        badgeClass: 'bg-sky-100 text-sky-700'
      },
      {
        event: 'openCashService',
        label: 'Tarik Tunai & Transfer',
        icon: ArrowLeftRight,
        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        badge: props.todayCashServiceCount,
        badgeClass: 'bg-emerald-100 text-emerald-700'
      }
    ]
  },
  {
    title: 'Keuangan & Laporan',
    items: [
      {
        event: 'openFinance',
        label: 'Manajemen Keuangan & Tabungan',
        icon: Landmark,
        iconBg: 'bg-sky-50 text-[#0284c7] border-sky-100',
        badge: 0,
        badgeClass: ''
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
        event: 'openExpense',
        label: 'Kas Keluar',
        icon: Wallet,
        iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
        badge: props.todayExpenseCount,
        badgeClass: 'bg-amber-100 text-amber-800'
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

      <!-- Brand Identity Lockup (Opsi A: 2 Baris Rapi — Nama Toko + Tanggal/Shift; Status Cloud/Online di Dot Avatar) -->
      <div class="min-w-0 flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5">
        <button
          type="button"
          @click="emit('openSettings')"
          class="hidden md:flex relative shrink-0 rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7]"
          aria-label="Profil Toko dan Status Sinkron"
          :title="connectionStatus.tooltip"
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
              {{ getStoreInitials(storeName) }}
            </div>
          </div>
          <span
            aria-hidden="true"
            class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
            :class="connectionStatus.dotClass"
          ></span>
        </button>

        <div class="min-w-0 text-center md:text-left leading-tight">
          <h1 class="text-sm sm:text-base font-bold text-[#0a193d] tracking-tight truncate max-w-[205px] sm:max-w-[250px] md:max-w-[220px] lg:max-w-[260px]">
            {{ storeName }}
          </h1>
          <div class="flex items-center justify-center md:justify-start gap-1.5 mt-0.5">
            <span class="md:hidden lg:inline text-[11px] text-slate-500 font-medium whitespace-nowrap">{{ todayFormatted }}</span>
            <span aria-hidden="true" class="hidden lg:inline text-slate-300">•</span>
            <button
              type="button"
              @click="triggerAction('openShift')"
              class="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors"
              :class="shiftChipInfo.chipClass"
              :title="activeShift ? 'Lihat Info / Tutup Shift Kasir' : 'Klik untuk Buka Shift & Atur Modal Awal'"
            >
              <span aria-hidden="true" class="size-1.5 rounded-full" :class="shiftChipInfo.dotClass"></span>
              <span class="md:hidden whitespace-nowrap">{{ shiftChipInfo.shortLabel }}</span>
              <span class="hidden md:inline whitespace-nowrap">{{ shiftChipInfo.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tablet & Desktop Compact Command Navigation (Stok & Data ▾ | Layanan ▾ | Keuangan ▾ | Laporan | Gear) -->
      <nav class="hidden md:flex items-center gap-1.5 shrink-0" aria-label="Navigasi Kasir">
        <div ref="desktopMenusRef" class="flex items-center gap-1.5">
          <div
            v-for="menu in desktopDropdownMenus"
            :key="menu.key"
            class="relative"
          >
            <button
              type="button"
              @click="toggleMenu(menu.key)"
              :aria-expanded="openMenuKey === menu.key"
              aria-haspopup="menu"
              :class="[
                'h-9 px-2.5 lg:px-3 rounded-xl border shadow-2xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all group',
                openMenuKey === menu.key
                  ? 'bg-[#0a193d] text-white border-[#0a193d]'
                  : 'bg-white/85 hover:bg-[#0a193d] text-[#0a193d] hover:text-white border-slate-200/70 hover:border-[#0a193d]'
              ]"
              :title="menu.title"
            >
              <component
                :is="menu.icon"
                aria-hidden="true"
                :class="[
                  'size-3.5 shrink-0 transition-colors',
                  openMenuKey === menu.key ? 'text-sky-300' : 'text-[#0284c7] group-hover:text-sky-300'
                ]"
              />
              <span v-if="menu.shortLabel !== menu.label" class="lg:hidden">{{ menu.shortLabel }}</span>
              <span :class="menu.shortLabel !== menu.label ? 'hidden lg:inline whitespace-nowrap' : 'whitespace-nowrap'">{{ menu.label }}</span>
              <span
                v-if="menu.badge > 0"
                class="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none tabular-nums"
                :class="menu.badgeClass"
              >
                {{ menu.badge }}
              </span>
              <ChevronDown
                aria-hidden="true"
                :class="['size-3.5 transition-transform duration-150', openMenuKey === menu.key ? 'rotate-180 text-sky-300' : 'text-slate-400 group-hover:text-sky-300']"
              />
            </button>

            <div
              v-if="openMenuKey === menu.key"
              role="menu"
              :class="['absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100', menu.panelWidthClass]"
            >
              <button
                v-for="sub in menu.items"
                :key="sub.event"
                type="button"
                role="menuitem"
                @click="triggerAction(sub.event)"
                class="w-full p-2.5 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer group"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border" :class="sub.iconBg">
                    <component :is="sub.icon" aria-hidden="true" class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-[#0a193d] leading-tight">{{ sub.label }}</p>
                    <p class="text-[11px] text-slate-500 leading-tight mt-0.5">{{ sub.description }}</p>
                  </div>
                </div>
                <span
                  v-if="sub.badge > 0"
                  class="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none tabular-nums shrink-0"
                  :class="sub.badgeClass"
                >
                  {{ sub.badge }}
                </span>
              </button>
            </div>
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

        <!-- Tombol Gembok Mode Pemilik (hanya tampil bila sandi pemilik aktif) -->
        <button
          v-if="isOwnerPinEnabled"
          type="button"
          @click="triggerAction(isOwnerUnlocked ? 'lockOwner' : 'unlockOwner')"
          :class="[
            'w-9 h-9 rounded-xl border shadow-2xs flex items-center justify-center cursor-pointer transition-all shrink-0',
            isOwnerUnlocked
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
          ]"
          :aria-label="isOwnerUnlocked ? 'Kunci Mode Pemilik' : 'Buka Mode Pemilik'"
          :title="isOwnerUnlocked ? 'Mode Pemilik Terbuka — Klik untuk Kunci Kembali' : 'Mode Kasir Terkunci — Klik untuk Buka Akses Pemilik'"
        >
          <Unlock v-if="isOwnerUnlocked" aria-hidden="true" class="size-4" />
          <Lock v-else aria-hidden="true" class="size-4" />
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
        :title="connectionStatus.tooltip"
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
            {{ getStoreInitials(storeName) }}
          </div>
        </div>
        <!-- Online / Cloud Sync Status Dot -->
        <span
          aria-hidden="true"
          class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] text-white"
          :class="connectionStatus.dotClass"
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
          <div class="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Toko</p>
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="connectionStatus.pillClass"
                >
                  <span aria-hidden="true" class="size-1.5 rounded-full" :class="connectionStatus.dotClass"></span>
                  {{ connectionStatus.label }}
                </span>
              </div>
              <p class="text-base font-bold text-[#0a193d] truncate mt-0.5">{{ storeName }}</p>
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
            <div class="flex items-center justify-between gap-2">
              <p class="font-bold text-[#0a193d]">{{ APP_BRAND_NAME }}</p>
              <span class="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold">v{{ appVersion }}</span>
            </div>
            <p class="mt-0.5 text-[11px] text-slate-500">
              {{ APP_BRAND_TAGLINE }} · oleh
              <a
                href="https://awanbeo.my.id"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-[#0284c7] hover:underline"
              >Awanbeo</a>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2.5 pt-1 text-[11px] text-slate-400">
            <a href="/privacy" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2">Kebijakan Privasi</a>
            <span aria-hidden="true">•</span>
            <a href="/terms" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2">Ketentuan Layanan</a>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
