<script setup>
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Store, 
  Cloud, 
  CheckCircle, 
  Database, 
  FileSpreadsheet, 
  RefreshCw, 
  User, 
  Phone, 
  Download, 
  Upload, 
  Check, 
  Smartphone, 
  HardDrive,
  ShieldCheck,
  AlertCircle,
  Clock,
  KeyRound,
  Printer,
  Bluetooth,
  Usb,
  Cable,
  WifiOff
} from '@lucide/vue'
import { useThermalPrinter } from '../composables/useThermalPrinter'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  storeProfile: {
    type: Object,
    default: () => ({
      name: 'Warung Kasiry',
      owner: 'Pemilik Toko',
      phone: ''
    })
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  isGoogleConnected: {
    type: Boolean,
    default: false
  },
  googleUser: {
    type: Object,
    default: null
  },
  lastSyncTime: {
    type: String,
    default: null
  },
  isSyncing: {
    type: Boolean,
    default: false
  },
  isConnecting: {
    type: Boolean,
    default: false
  },
  lastLocalBackupTime: {
    type: String,
    default: null
  },
  pendingQueueCount: {
    type: Number,
    default: 0
  },
  hasPendingDriveBackup: {
    type: Boolean,
    default: false
  },
  syncStatusMessage: {
    type: String,
    default: ''
  },
  customClientId: {
    type: String,
    default: ''
  },
  totalTransactionCount: {
    type: Number,
    default: 0
  },
  olderTransactionCount: {
    type: Number,
    default: 0
  },
  productCount: {
    type: Number,
    default: 0
  },
  customerCount: {
    type: Number,
    default: 0
  },
  getArchivableSummary: {
    type: Function,
    default: null
  }
})

const emit = defineEmits([
  'close', 
  'updateProfile', 
  'connectGoogle', 
  'disconnectGoogle', 
  'syncNow', 
  'openGoogleSheet', 
  'exportBackup', 
  'importBackup',
  'updateClientId',
  'archiveOldData',
  'resetStoreData'
])

// 3 Tabs: 'profile' (Profil Toko) | 'printer' (Printer Thermal) | 'backup' (Cadangan & Google)
const activeTab = ref('profile')
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.20.2'

const formName = ref(props.storeProfile?.name || 'Warung Kasiry')
const formOwner = ref(props.storeProfile?.owner || 'Pemilik Toko')
const formPhone = ref(props.storeProfile?.phone || '')
const formClientId = ref(props.customClientId || '')
const showClientIdConfig = ref(false)
const clientIdSaved = ref(false)
const fileInputRef = ref(null)
const isSaved = ref(false)
const confirmingResetMode = ref(null) // 'empty' | 'starter' | null

// Pengaturan & Koneksi Printer Thermal (Bluetooth BLE, Kabel USB/OTG, Port Serial COM + Fallback Browser)
const {
  printerSettings,
  updatePrinterSettings,
  connectionType,
  isBluetoothSupported,
  isUsbSupported,
  isSerialSupported,
  isPrinterConnected,
  isConnectingPrinter,
  isPrinting,
  connectedPrinterName,
  printerError,
  connectBluetoothPrinter,
  connectUsbPrinter,
  connectSerialPrinter,
  disconnectPrinter,
  printTestThermal
} = useThermalPrinter()

const testPrintNotice = ref(null)

const connectPrinterByTransport = async (mode) => {
  testPrintNotice.value = null
  const connectors = {
    bluetooth: connectBluetoothPrinter,
    usb: connectUsbPrinter,
    serial: connectSerialPrinter
  }
  const ok = await connectors[mode]?.()
  if (ok) {
    const label = mode === 'usb' ? 'USB' : mode === 'serial' ? 'Serial COM' : 'Bluetooth'
    testPrintNotice.value = {
      type: 'success',
      text: `Terhubung ke ${connectedPrinterName.value || `Printer ${label}`} (${label}).`
    }
  }
}

const handleDisconnectPrinter = async () => {
  await disconnectPrinter()
  testPrintNotice.value = {
    type: 'info',
    text: 'Koneksi printer thermal diputus.'
  }
}

const handleTestPrint = async () => {
  testPrintNotice.value = null
  const res = await printTestThermal({
    name: formName.value || props.storeProfile?.name || 'Warung Kasiry',
    owner: formOwner.value || props.storeProfile?.owner || 'Pemilik Toko',
    phone: formPhone.value ?? props.storeProfile?.phone ?? ''
  })
  if (res?.ok) {
    const methodNames = { bluetooth: 'Bluetooth', usb: 'Kabel USB', serial: 'Port Serial/COM' }
    testPrintNotice.value = {
      type: 'success',
      text: res.method !== 'browser'
        ? `Tes cetak berhasil dikirim via ${methodNames[res.method] || res.method} (${connectedPrinterName.value || 'Printer'}).`
        : 'Dialog cetak browser dibuka dengan halaman tes khusus ukuran kertas struk.'
    }
  } else {
    testPrintNotice.value = {
      type: 'error',
      text: printerError.value || res?.error || 'Tes cetak gagal dijalankan.'
    }
  }
}

// Preview & Konfirmasi Restore Backup JSON sebelum menulis ke DB
const pendingImportPreview = ref(null)
const importError = ref('')

// State Kesehatan & Arsip Data Tahunan
const archiveRetentionDays = ref(180)
const archivableSummary = ref({
  countToArchive: 0,
  debtPaymentCount: 0,
  remainingCount: 0,
  cutoffDateLabel: ''
})
const confirmingArchive = ref(false)
const isArchiving = ref(false)

const refreshArchivePreview = async (days = archiveRetentionDays.value) => {
  if (typeof props.getArchivableSummary === 'function') {
    try {
      const res = await props.getArchivableSummary(days)
      const countToArchive = Number(res?.txCount ?? res?.countToArchive ?? 0)
      const debtPaymentCount = Number(res?.payCount ?? res?.debtPaymentCount ?? 0)
      const cutoffDateLabel = res?.cutoffTimestamp
        ? new Date(res.cutoffTimestamp).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        : ''
      archivableSummary.value = {
        countToArchive,
        debtPaymentCount,
        remainingCount: Math.max(0, props.totalTransactionCount - countToArchive),
        cutoffDateLabel
      }
      return
    } catch {
      // Abaikan error pratinjau
    }
  }
  archivableSummary.value = {
    countToArchive: days === 90 ? props.olderTransactionCount : 0,
    debtPaymentCount: 0,
    remainingCount: props.totalTransactionCount,
    cutoffDateLabel: ''
  }
}

const triggerArchiveOldData = () => {
  if (isArchiving.value) return
  isArchiving.value = true
  confirmingArchive.value = false
  emit('archiveOldData', {
    retentionDays: archiveRetentionDays.value,
    onComplete: async () => {
      isArchiving.value = false
      await refreshArchivePreview()
    }
  })
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    pendingImportPreview.value = null
    importError.value = ''
    confirmingArchive.value = false
    showClientIdConfig.value = false
    formClientId.value = props.customClientId || ''
    if (activeTab.value === 'backup') {
      refreshArchivePreview()
    }
  }
}, { immediate: true })

watch([activeTab, archiveRetentionDays, () => props.totalTransactionCount], ([tab]) => {
  if (props.isOpen && tab === 'backup') {
    refreshArchivePreview()
  }
})

watch(() => props.storeProfile, (newVal) => {
  if (newVal) {
    formName.value = newVal.name || 'Warung Kasiry'
    formOwner.value = newVal.owner || 'Pemilik Toko'
    formPhone.value = newVal.phone || ''
  }
}, { deep: true, immediate: true })

watch(() => props.isOpen, (open) => {
  if (open) {
    confirmingResetMode.value = null
  }
})

// Status pengingat cadangan file offline
const localBackupStatus = computed(() => {
  if (!props.lastLocalBackupTime) {
    return {
      isWarning: true,
      text: 'Belum pernah download file cadangan ke HP ini'
    }
  }
  const ts = new Date(props.lastLocalBackupTime).getTime()
  if (Number.isNaN(ts)) {
    return { isWarning: true, text: 'Belum pernah download cadangan' }
  }
  const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
  const formatted = new Date(ts).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
  if (diffDays >= 7) {
    return {
      isWarning: true,
      text: `Cadangan terakhir ${diffDays} hari lalu (${formatted}) • Sebaiknya unduh ulang`
    }
  }
  return {
    isWarning: false,
    text: `Terakhir dicadangkan: ${formatted}`
  }
})

const saveProfile = () => {
  emit('updateProfile', {
    name: formName.value.trim() || 'Warung Kasiry',
    owner: formOwner.value.trim() || 'Pemilik Toko',
    phone: formPhone.value.trim()
  })
  isSaved.value = true
  setTimeout(() => {
    isSaved.value = false
  }, 2000)
}

const saveCustomClientId = () => {
  emit('updateClientId', formClientId.value.trim())
  clientIdSaved.value = true
  setTimeout(() => {
    clientIdSaved.value = false
  }, 2000)
}

const triggerImportFile = () => {
  importError.value = ''
  fileInputRef.value?.click()
}

const onFileSelected = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  importError.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      const parsed = JSON.parse(content)
      if (!parsed || !parsed.data) {
        throw new Error('Struktur file JSON bukan cadangan Kasiry yang valid.')
      }
      const d = parsed.data
      const activeProds = Array.isArray(d.products) ? d.products.filter(p => !p.deleted) : []
      const activeCusts = Array.isArray(d.customers) ? d.customers.filter(c => !c.deleted) : []
      const txList = Array.isArray(d.transactions) ? d.transactions : []
      const activeExpenses = Array.isArray(d.expenses) ? d.expenses.filter(e => !e.deleted) : []
      const activeRestocks = Array.isArray(d.restocks) ? d.restocks.filter(r => !r.deleted) : []
      const activeShifts = Array.isArray(d.shifts) ? d.shifts.filter(s => !s.deleted) : []

      pendingImportPreview.value = {
        fileName: file.name,
        storeName: parsed.storeProfile?.name || d.settings?.find(s => s.key === 'storeProfile')?.value?.name || 'Toko Kasiry',
        exportedAt: parsed.exportedAt
          ? new Date(parsed.exportedAt).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Tidak diketahui',
        productCount: activeProds.length,
        customerCount: activeCusts.length,
        transactionCount: txList.length,
        expenseCount: activeExpenses.length,
        restockCount: activeRestocks.length,
        shiftCount: activeShifts.length,
        content
      }
    } catch (err) {
      pendingImportPreview.value = null
      importError.value = 'File tidak valid: ' + err.message
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

const confirmImport = (mode) => {
  if (!pendingImportPreview.value) return
  emit('importBackup', {
    content: pendingImportPreview.value.content,
    mode
  })
  pendingImportPreview.value = null
}

const cancelImport = () => {
  pendingImportPreview.value = null
  importError.value = ''
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100/90 overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs">
            <Store class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-[#0a193d] leading-tight">Profil &amp; Pengaturan</h3>
              <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
                v{{ appVersion }}
              </span>
            </div>
            <p class="text-xs text-slate-500 font-medium">Pengaturan pemilik toko &amp; cadangan data</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-9 h-9 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Tutup"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 2. Profile Summary Hero Banner (Always Visible) -->
      <div class="mx-5 mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0a193d] to-slate-900 text-white flex items-center justify-between shadow-xs shrink-0">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] p-0.5 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
            <img 
              v-if="isGoogleConnected && googleUser?.picture" 
              :src="googleUser.picture" 
              referrerpolicy="no-referrer"
              class="w-full h-full rounded-[14px] object-cover"
            />
            <div v-else class="w-full h-full rounded-[14px] bg-[#0a193d] flex items-center justify-center text-white text-base font-extrabold font-mono">
              {{ formName ? formName.substring(0, 2).toUpperCase() : 'WK' }}
            </div>
          </div>
          <div class="min-w-0">
            <h4 class="text-base font-bold text-white truncate leading-tight">{{ formName }}</h4>
            <p class="text-xs text-slate-300 mt-0.5 truncate flex items-center gap-1.5">
              <span>{{ formOwner || 'Pemilik Toko' }}</span>
              <span class="text-slate-500">•</span>
              <span class="font-mono text-[11px]">{{ formPhone || '-' }}</span>
            </p>
          </div>
        </div>

        <div class="shrink-0 pl-2">
          <span 
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border',
              isGoogleConnected 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' 
                : isOnline 
                  ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-400/30'
            ]"
          >
            <span 
              class="w-1.5 h-1.5 rounded-full" 
              :class="isGoogleConnected ? 'bg-emerald-400 animate-pulse' : isOnline ? 'bg-sky-400' : 'bg-rose-400'"
            ></span>
            {{ isGoogleConnected ? 'Cloud Aktif' : isOnline ? 'Online' : 'Offline' }}
          </span>
        </div>
      </div>

      <!-- 3. Segmented Pill Tab Bar (3 Tabs) -->
      <div class="px-5 pt-3 pb-1 shrink-0">
        <div class="p-1 bg-slate-100/80 rounded-2xl grid grid-cols-3 gap-1">
          <button 
            @click="activeTab = 'profile'"
            :class="[
              'py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'profile' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Store class="w-4 h-4 shrink-0" />
            <span>Profil Toko</span>
          </button>

          <button 
            @click="activeTab = 'printer'"
            :class="[
              'py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'printer' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Printer class="w-4 h-4 shrink-0" />
            <span>Printer</span>
          </button>

          <button 
            @click="activeTab = 'backup'"
            :class="[
              'py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'backup' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Cloud class="w-4 h-4 shrink-0" />
            <span>Pencadangan</span>
          </button>
        </div>
      </div>

      <!-- 4. Tab Body Scrollable -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        
        <!-- ==================== TAB 1: PROFIL TOKO ==================== -->
        <div v-if="activeTab === 'profile'" class="space-y-4">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Toko / Warung
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Store class="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  v-model="formName"
                  placeholder="Contoh: Warung Kasiry"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-bold text-[#0a193d] outline-hidden transition-all"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Pemilik
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User class="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    v-model="formOwner"
                    placeholder="Contoh: Pemilik Toko"
                    class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-semibold text-[#0a193d] outline-hidden transition-all"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp Toko
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone class="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    v-model="formPhone"
                    placeholder="08xxxxxxxxxx"
                    class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-mono font-semibold text-[#0a193d] outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Single Primary Save Button -->
          <button 
            @click="saveProfile"
            :class="[
              'w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm',
              isSaved 
                ? 'bg-emerald-600 text-white' 
                : 'bg-[#0a193d] hover:bg-slate-800 text-white'
            ]"
          >
            <Check v-if="isSaved" class="w-4 h-4 text-white" />
            <CheckCircle v-else class="w-4 h-4 text-sky-400" />
            <span>{{ isSaved ? 'Perubahan Berhasil Disimpan!' : 'Simpan Perubahan' }}</span>
          </button>
        </div>

        <!-- ==================== TAB 2: PRINTER THERMAL ==================== -->
        <div v-else-if="activeTab === 'printer'" class="space-y-4">
          <!-- Koneksi Printer Thermal (Bluetooth, Kabel USB / OTG, Port Serial COM) -->
          <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h4 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Printer class="w-4 h-4 text-[#0a193d]" />
                  <span>Koneksi Printer Thermal ESC/POS</span>
                </h4>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Sambungkan printer langsung via Bluetooth, Kabel USB (HP OTG / PC), atau Port Serial/COM.
                </p>
              </div>
              <span
                :class="[
                  'shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                  isPrinterConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-600 border-slate-200'
                ]"
              >
                {{ isPrinterConnected
                  ? (connectionType === 'usb' ? 'Terhubung (USB)' : connectionType === 'serial' ? 'Terhubung (COM)' : 'Terhubung (BT)')
                  : 'Belum Terhubung' }}
              </span>
            </div>

            <div
              v-if="isPrinterConnected && connectedPrinterName"
              class="px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2"
            >
              <span class="font-semibold truncate">Perangkat: {{ connectedPrinterName }}</span>
            </div>

            <div
              v-if="printerError"
              class="px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-medium leading-relaxed"
            >
              {{ printerError }}
            </div>

            <div v-if="!isPrinterConnected" class="space-y-2">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  @click="connectPrinterByTransport('bluetooth')"
                  :disabled="!isBluetoothSupported || isConnectingPrinter"
                  class="py-2.5 px-3 rounded-xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Bluetooth class="w-4 h-4 shrink-0" />
                  <span>{{ isConnectingPrinter ? 'Menghubungkan...' : 'Hubungkan Bluetooth' }}</span>
                </button>

                <button
                  type="button"
                  @click="connectPrinterByTransport('usb')"
                  :disabled="!isUsbSupported || isConnectingPrinter"
                  class="py-2.5 px-3 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Usb class="w-4 h-4 shrink-0" />
                  <span>Hubungkan USB / OTG</span>
                </button>

                <button
                  type="button"
                  @click="connectPrinterByTransport('serial')"
                  :disabled="!isSerialSupported || isConnectingPrinter"
                  class="py-2.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Cable class="w-4 h-4 shrink-0" />
                  <span>Port Serial / COM</span>
                </button>
              </div>

              <div v-if="isSerialSupported" class="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                <label for="serial-baud-rate" class="font-medium">Baud Rate Port Serial / COM:</label>
                <select
                  id="serial-baud-rate"
                  :value="printerSettings.serialBaudRate || 9600"
                  @change="updatePrinterSettings({ serialBaudRate: Number($event.target.value) })"
                  class="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-mono text-[11px]"
                >
                  <option :value="9600">9600 (Umum)</option>
                  <option :value="19200">19200</option>
                  <option :value="38400">38400</option>
                  <option :value="115200">115200 (Cepat)</option>
                </select>
              </div>
            </div>

            <div v-else class="flex gap-2">
              <button
                type="button"
                @click="handleDisconnectPrinter"
                class="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <WifiOff class="w-4 h-4" />
                <span>Putus Koneksi Printer</span>
              </button>
            </div>

            <div class="px-3 py-2.5 rounded-xl bg-sky-50/80 border border-sky-200 text-[11px] text-slate-700 leading-relaxed space-y-1">
              <p><strong>Panduan Cepat Kabel USB:</strong></p>
              <p>• <strong>HP / Tablet Android:</strong> Colok kabel USB OTG lalu ketuk <strong>Hubungkan USB / OTG</strong>.</p>
              <p>• <strong>Laptop Windows:</strong> Jika koneksi USB ditolak karena dikunci Print Spooler, ubah driver USB-nya ke <strong>WinUSB</strong> (via Zadig) untuk cetak langsung ESC/POS, atau install driver <strong>POS-58</strong> dan pakai <strong>Cetak Browser</strong>.</p>
            </div>

            <div
              v-if="!isBluetoothSupported && !isUsbSupported && !isSerialSupported"
              class="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed"
            >
              Browser/perangkat ini belum mendukung koneksi printer langsung. Kasiry otomatis memakai <strong>Cetak Browser</strong> terisolasi ukuran struk.
            </div>
          </div>

          <!-- Ukuran Kertas Thermal -->
          <div class="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600">Ukuran Kertas Struk</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">Menyesuaikan lebar baris ESC/POS Bluetooth & cetak browser.</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="updatePrinterSettings({ paperWidth: '58mm' })"
                :class="[
                  'p-3 rounded-xl border text-left transition-all cursor-pointer',
                  printerSettings.paperWidth === '58mm'
                    ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                ]"
              >
                <div class="text-xs font-bold">58mm (32 Kolom)</div>
                <div :class="['text-[11px] mt-0.5', printerSettings.paperWidth === '58mm' ? 'text-slate-300' : 'text-slate-500']">
                  Standar printer mini warung
                </div>
              </button>

              <button
                type="button"
                @click="updatePrinterSettings({ paperWidth: '80mm' })"
                :class="[
                  'p-3 rounded-xl border text-left transition-all cursor-pointer',
                  printerSettings.paperWidth === '80mm'
                    ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                ]"
              >
                <div class="text-xs font-bold">80mm (48 Kolom)</div>
                <div :class="['text-[11px] mt-0.5', printerSettings.paperWidth === '80mm' ? 'text-slate-300' : 'text-slate-500']">
                  Lebar meja kasir / desktop
                </div>
              </button>
            </div>
          </div>

          <!-- Opsi Otomatis & Catatan Struk -->
          <div class="p-4 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-slate-800">Cetak Otomatis Setelah Bayar</div>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Langsung mencetak struk begitu pembayaran tunai, QRIS, atau kasbon selesai.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="printerSettings.autoPrint"
                aria-label="Cetak Otomatis Setelah Bayar"
                @click="updatePrinterSettings({ autoPrint: !printerSettings.autoPrint })"
                :class="[
                  'w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer flex items-center',
                  printerSettings.autoPrint ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                ]"
              >
                <span class="w-5 h-5 rounded-full bg-white shadow-xs block"></span>
              </button>
            </div>

            <div class="pt-3 border-t border-slate-100">
              <label for="printer-footer-note" class="block text-xs font-bold text-slate-700 mb-1.5">
                Catatan Bawah Struk
              </label>
              <input
                id="printer-footer-note"
                type="text"
                :value="printerSettings.footerText"
                @input="updatePrinterSettings({ footerText: $event.target.value })"
                maxlength="80"
                placeholder="Terima kasih sudah berbelanja!"
                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#0a193d] focus:ring-2 focus:ring-[#0a193d]/10 outline-none transition-all"
              />
              <p class="text-[11px] text-slate-400 mt-1">
                Otomatis tersimpan dan tampil di bagian bawah struk.
              </p>
            </div>
          </div>

          <!-- Tes Cetak Printer -->
          <div class="space-y-2">
            <button
              type="button"
              @click="handleTestPrint"
              :disabled="isPrinting"
              class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer class="w-4 h-4" />
              <span>{{ isPrinting ? 'Sedang Mencetak...' : 'Tes Cetak Printer' }}</span>
            </button>

            <div
              v-if="testPrintNotice"
              :class="[
                'px-3.5 py-2.5 rounded-xl border text-xs font-medium',
                testPrintNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : testPrintNotice.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
              ]"
            >
              {{ testPrintNotice.text }}
            </div>
          </div>
        </div>

        <!-- ==================== TAB 3: CADANGAN & GOOGLE (DISATUKAN) ==================== -->
        <div v-else class="space-y-4">
          <!-- 1. Bagian Cadangan Akun Google -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
            <div class="flex items-center gap-2 text-slate-800">
              <Cloud class="w-5 h-5 text-[#0284c7]" />
              <h4 class="text-sm font-bold text-[#0a193d]">Cadangan Otomatis Akun Google</h4>
            </div>

            <!-- Jika Belum Terhubung Google -->
            <div v-if="!isGoogleConnected" class="space-y-3">
              <p class="text-xs text-slate-600 leading-relaxed">
                Hubungkan akun Google agar data toko selalu aman dan kasir bisa dibuka dari HP lain:
              </p>

              <div class="space-y-2 text-xs text-slate-700">
                <div class="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/60">
                  <HardDrive class="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
                  <div>
                    <strong class="block text-slate-900">Aman Saat Ganti HP</strong>
                    <span class="text-slate-500 text-[11px]">Data barang dan transaksi tersimpan otomatis di Google Drive Anda.</span>
                  </div>
                </div>

                <div class="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/60">
                  <FileSpreadsheet class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong class="block text-slate-900">Buku Kas di Google Sheets</strong>
                    <span class="text-slate-500 text-[11px]">Catatan penjualan langsung rapi dan bisa dipantau lewat spreadsheet.</span>
                  </div>
                </div>

                <div class="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/60">
                  <Smartphone class="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <strong class="block text-slate-900">Bisa Buka di Banyak HP</strong>
                    <span class="text-slate-500 text-[11px]">HP kasir dan HP pemilik toko bisa mengakses data toko yang sama.</span>
                  </div>
                </div>
              </div>

              <button 
                @click="emit('connectGoogle')"
                :disabled="isConnecting"
                class="w-full h-11 bg-white hover:bg-slate-50 disabled:opacity-60 border-2 border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed shadow-xs transition-all active:scale-98"
              >
                <RefreshCw v-if="isConnecting" class="w-4 h-4 text-[#0284c7] animate-spin" />
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{{ isConnecting ? 'Menghubungkan Akun Google...' : 'Hubungkan dengan Akun Google' }}</span>
              </button>
            </div>

            <!-- Jika Sudah Terhubung Google -->
            <div v-else class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                <div class="flex items-center gap-3">
                  <img 
                    v-if="googleUser?.picture" 
                    :src="googleUser.picture" 
                    referrerpolicy="no-referrer"
                    class="w-10 h-10 rounded-full border border-emerald-300 shadow-2xs"
                  />
                  <div v-else class="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                    {{ googleUser?.name?.charAt(0) || 'G' }}
                  </div>
                  <div>
                    <h5 class="font-bold text-sm text-[#0a193d] leading-tight">{{ googleUser?.name || 'Pemilik Warung' }}</h5>
                    <p class="text-xs text-slate-500 font-mono mt-0.5">{{ googleUser?.email || '' }}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Tersambung
                </span>
              </div>

              <div class="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span class="font-medium">Terakhir Disimpan:</span>
                <span class="font-bold text-[#0a193d]">
                  {{ lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Siap disimpan' }}
                </span>
              </div>

              <!-- Status Antrean Offline / Pending Cloud Sync -->
              <div 
                v-if="pendingQueueCount > 0 || hasPendingDriveBackup" 
                class="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-800 flex items-center gap-2 font-medium"
              >
                <Clock class="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <template v-if="pendingQueueCount > 0">
                    {{ pendingQueueCount }} catatan transaksi menunggu koneksi untuk dikirim ke Google Sheets.
                  </template>
                  <template v-else>
                    Perubahan terbaru menunggu giliran auto-backup ke Google Drive.
                  </template>
                </span>
              </div>

              <p v-if="syncStatusMessage" class="text-[11px] text-slate-500 px-0.5 truncate">
                Status: <span class="font-medium text-slate-700">{{ syncStatusMessage }}</span>
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  @click="emit('syncNow')"
                  :disabled="isSyncing"
                  class="h-10 px-3 bg-[#0a193d] hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs transition-all shadow-xs active:scale-95"
                >
                  <RefreshCw :class="['w-3.5 h-3.5 text-sky-400', isSyncing ? 'animate-spin' : '']" />
                  <span>{{ isSyncing ? 'Menyimpan...' : 'Simpan ke Google Sekarang' }}</span>
                </button>

                <button 
                  @click="emit('openGoogleSheet')"
                  class="h-10 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs transition-all shadow-xs active:scale-95"
                >
                  <FileSpreadsheet class="w-3.5 h-3.5 text-emerald-200" />
                  <span>Buka Buku Kas (Sheets)</span>
                </button>
              </div>

              <div class="text-center pt-0.5">
                <button 
                  @click="emit('disconnectGoogle')"
                  class="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer transition-colors"
                >
                  Putuskan Sambungan Akun Google
                </button>
              </div>
            </div>

            <!-- Konfigurasi Lanjutan OAuth Client ID (Collapsible agar tidak mengganggu tampilan utama) -->
            <div class="pt-2 border-t border-slate-200/70">
              <button 
                type="button"
                @click="showClientIdConfig = !showClientIdConfig"
                class="text-[11px] font-semibold text-slate-500 hover:text-[#0284c7] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <KeyRound class="w-3.5 h-3.5" />
                <span>{{ showClientIdConfig ? 'Tutup Pengaturan Client ID Google' : 'Pengaturan Lanjutan (Google Client ID)' }}</span>
              </button>

              <div v-if="showClientIdConfig" class="mt-2.5 p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  OAuth Client ID Khusus Kasiry (Opsional)
                </label>
                <div class="flex items-center gap-2">
                  <input 
                    type="text" 
                    v-model="formClientId"
                    placeholder="xxxx.apps.googleusercontent.com"
                    class="flex-1 h-9 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-lg text-xs font-mono text-[#0a193d] outline-hidden"
                  />
                  <button 
                    type="button"
                    @click="saveCustomClientId"
                    class="h-9 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shrink-0"
                  >
                    {{ clientIdSaved ? 'Tersimpan ✓' : 'Simpan' }}
                  </button>
                </div>
                <p class="text-[10px] text-slate-400 leading-snug">
                  Kosongkan untuk memakai Client ID bawaan atau isi milik Google Cloud Console Kasiry agar login aktif di domain sendiri.
                </p>
              </div>
            </div>
          </div>

          <!-- 2. Bagian Cadangan File Manual (Offline) -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-[#0a193d]">
                <Database class="w-5 h-5 text-[#0284c7]" />
                <h4 class="text-sm font-bold">Cadangan File di HP (Offline)</h4>
              </div>
            </div>

            <!-- Status / Pengingat Waktu Cadangan Lokal -->
            <div 
              :class="[
                'px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center gap-2',
                localBackupStatus.isWarning 
                  ? 'bg-amber-50/90 border-amber-200/80 text-amber-800' 
                  : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-800'
              ]"
            >
              <AlertCircle v-if="localBackupStatus.isWarning" class="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <CheckCircle v-else class="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>{{ localBackupStatus.text }}</span>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">
              Simpan salinan data toko langsung ke memori HP agar aman tanpa perlu internet.
            </p>

            <!-- Pesan Error File Backup -->
            <div v-if="importError" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
              <span>{{ importError }}</span>
            </div>

            <!-- Preview & Konfirmasi Aman Sebelum Pulihkan Backup -->
            <div v-if="pendingImportPreview" class="p-3.5 bg-white border-2 border-[#0284c7] rounded-2xl space-y-3 shadow-xs">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-xs font-bold text-[#0a193d]">Konfirmasi Pemulihan Data</p>
                  <p class="text-[11px] text-slate-500 font-mono truncate">{{ pendingImportPreview.fileName }}</p>
                </div>
                <button 
                  type="button" 
                  @click="cancelImport"
                  class="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>

              <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <div class="flex justify-between">
                  <span class="text-slate-500">Toko Asal:</span>
                  <span class="font-bold text-[#0a193d]">{{ pendingImportPreview.storeName }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Tanggal Cadangan:</span>
                  <span class="font-mono font-medium text-slate-700">{{ pendingImportPreview.exportedAt }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Isi Data:</span>
                  <span class="font-bold text-[#0284c7]">
                    {{ pendingImportPreview.productCount }} barang • {{ pendingImportPreview.customerCount }} pelanggan • {{ pendingImportPreview.transactionCount }} struk<template v-if="pendingImportPreview.expenseCount > 0"> • {{ pendingImportPreview.expenseCount }} kas keluar</template><template v-if="pendingImportPreview.restockCount > 0"> • {{ pendingImportPreview.restockCount }} kulakan</template><template v-if="pendingImportPreview.shiftCount > 0"> • {{ pendingImportPreview.shiftCount }} shift</template>
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  type="button"
                  @click="confirmImport('merge')"
                  class="h-10 px-3 bg-[#0a193d] hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs"
                  title="Tambahkan data yang belum ada tanpa menghapus transaksi baru"
                >
                  Gabung Data (Aman)
                </button>
                <button 
                  type="button"
                  @click="confirmImport('replace')"
                  class="h-10 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  title="Hapus seluruh data saat ini lalu ganti persis seperti isi file cadangan"
                >
                  Timpa Total (Reset)
                </button>
              </div>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button 
                @click="emit('exportBackup')"
                class="p-3 bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 text-left rounded-2xl cursor-pointer transition-all active:scale-95 group shadow-2xs"
              >
                <div class="w-8 h-8 rounded-xl bg-sky-50 text-[#0284c7] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Download class="w-4 h-4" />
                </div>
                <strong class="text-xs font-bold text-[#0a193d] block">Download Cadangan Toko</strong>
                <span class="text-[11px] text-slate-500">Simpan salinan data ke HP</span>
              </button>

              <button 
                @click="triggerImportFile"
                class="p-3 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 text-left rounded-2xl cursor-pointer transition-all active:scale-95 group shadow-2xs"
              >
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Upload class="w-4 h-4" />
                </div>
                <strong class="text-xs font-bold text-[#0a193d] block">Pulihkan Data Toko</strong>
                <span class="text-[11px] text-slate-500">Buka file cadangan tersimpan</span>
              </button>

              <input 
                type="file" 
                ref="fileInputRef" 
                accept=".json,application/json" 
                class="hidden" 
                @change="onFileSelected"
              />
            </div>

            <!-- Bagian 3: Kesehatan Data & Arsip Tahunan -->
            <div class="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <Database class="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 class="font-bold text-gray-800 text-sm">Kesehatan &amp; Arsip Data Tahunan</h4>
                    <p class="text-[11px] text-gray-500">Jaga kasir tetap ngebut walau dipakai bertahun-tahun.</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 tabular-nums shrink-0">
                  {{ totalTransactionCount.toLocaleString('id-ID') }} Transaksi
                </span>
              </div>

              <!-- Ringkasan Statistik Memori -->
              <div class="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                <div>
                  <div class="text-[10px] font-semibold text-gray-500 uppercase">Barang</div>
                  <div class="text-xs font-extrabold text-gray-800 tabular-nums">{{ productCount.toLocaleString('id-ID') }}</div>
                </div>
                <div>
                  <div class="text-[10px] font-semibold text-gray-500 uppercase">Pelanggan</div>
                  <div class="text-xs font-extrabold text-gray-800 tabular-nums">{{ customerCount.toLocaleString('id-ID') }}</div>
                </div>
                <div>
                  <div class="text-[10px] font-semibold text-gray-500 uppercase">&gt; 90 Hari</div>
                  <div class="text-xs font-extrabold text-amber-700 tabular-nums">{{ olderTransactionCount.toLocaleString('id-ID') }}</div>
                </div>
              </div>

              <!-- Pilihan Rentang Arsip -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-gray-400" />
                  Pilih batas transaksi lama untuk diarsipkan:
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="opt in [
                      { days: 90, label: '> 3 Bulan' },
                      { days: 180, label: '> 6 Bulan' },
                      { days: 365, label: '> 1 Tahun' }
                    ]"
                    :key="opt.days"
                    type="button"
                    @click="archiveRetentionDays = opt.days; confirmingArchive = false"
                    class="py-2 px-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95"
                    :class="archiveRetentionDays === opt.days
                      ? 'bg-sky-50 border-[#0284c7] text-[#0284c7] shadow-xs'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Info Pratinjau & Tombol Eksekusi -->
              <div v-if="archivableSummary && archivableSummary.countToArchive > 0" class="space-y-2.5">
                <div class="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 space-y-1">
                  <p class="font-bold">
                    Ditemukan {{ archivableSummary.countToArchive.toLocaleString('id-ID') }} transaksi lama (sebelum {{ archivableSummary.cutoffDateLabel }}).
                  </p>
                  <p class="text-amber-800/90 leading-relaxed">
                    Sistem akan <strong>mengunduh file Arsip JSON</strong> terlebih dulu (dan menyimpan salinan ke Google Drive bila terhubung), lalu membersihkan memori HP. <strong>Daftar barang &amp; total saldo utang pelanggan tetap 100% aman.</strong>
                  </p>
                </div>

                <div v-if="!confirmingArchive">
                  <button
                    type="button"
                    :disabled="isArchiving"
                    @click="confirmingArchive = true"
                    class="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-amber-900 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download class="w-4 h-4" />
                    Unduh Arsip &amp; Ringankan Memori HP
                  </button>
                </div>

                <div v-else class="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <p class="text-[11px] font-bold text-red-900">
                    Yakin arsipkan &amp; bersihkan {{ archivableSummary.countToArchive.toLocaleString('id-ID') }} transaksi lama dari memori kasir?
                  </p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      :disabled="isArchiving"
                      @click="confirmingArchive = false"
                      class="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      :disabled="isArchiving"
                      @click="triggerArchiveOldData"
                      class="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw v-if="isArchiving" class="w-3.5 h-3.5 animate-spin" />
                      <span>{{ isArchiving ? 'Mengarsipkan...' : 'Ya, Unduh & Ringankan' }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Memori kasir ringan! Belum ada transaksi lama yang perlu diarsipkan untuk rentang ini.</span>
              </div>
            </div>

            <!-- Bagian 4: Atur Ulang Data Awal / Mulai Toko Kosong -->
            <div class="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-xs space-y-3">
              <div>
                <h4 class="font-bold text-[#0a193d] text-sm">Atur Ulang Katalog &amp; Data Toko</h4>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Gunakan saat ingin membersihkan data uji coba untuk mulai berjualan, atau memuat ulang 300 daftar barang warung siap isi harga.
                </p>
              </div>

              <div v-if="!confirmingResetMode" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="confirmingResetMode = 'empty'"
                  class="p-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-left cursor-pointer transition-colors"
                >
                  <strong class="text-xs font-bold text-rose-800 block">Mulai Toko Kosong</strong>
                  <span class="text-[11px] text-rose-700/80">Hapus katalog &amp; transaksi (0 barang)</span>
                </button>
                <button
                  type="button"
                  @click="confirmingResetMode = 'starter'"
                  class="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-left cursor-pointer transition-colors"
                >
                  <strong class="text-xs font-bold text-[#0a193d] block">Muat 300 Katalog Warung</strong>
                  <span class="text-[11px] text-slate-600">Reset &amp; isi 300 barang populer Rp 0</span>
                </button>
              </div>

              <div v-else class="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <p class="text-xs font-bold text-rose-900 leading-snug">
                  {{ confirmingResetMode === 'empty'
                    ? 'Yakin hapus SEMUA barang, transaksi, dan piutang agar mulai dari Toko Kosong (0 barang)?'
                    : 'Yakin hapus semua transaksi/data lama dan muat ulang 300 katalog warung standar (harga Rp 0)?' }}
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="confirmingResetMode = null"
                    class="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    @click="emit('resetStoreData', confirmingResetMode); confirmingResetMode = null"
                    class="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                  >
                    Ya, Atur Ulang Sekarang
                  </button>
                </div>
              </div>
            </div>

            <div class="p-3 bg-sky-50/60 rounded-xl border border-sky-100 flex items-center gap-2 text-xs text-sky-900 mt-2">
              <ShieldCheck class="w-4 h-4 text-[#0284c7] shrink-0" />
              <span>Semua data kasir tersimpan di HP ini dan tetap bisa dipakai walau tanpa kuota internet.</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
