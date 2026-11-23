<script setup>
import { ref, watch } from 'vue'
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
  ShieldCheck
} from '@lucide/vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  storeProfile: {
    type: Object,
    default: () => ({
      name: 'Habiba Store',
      owner: 'Habiba',
      phone: '081234567890'
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
  'importBackup'
])

// Tab: 'profile' | 'cloud' | 'backup'
const activeTab = ref('profile')

const formName = ref(props.storeProfile?.name || 'Habiba Store')
const formOwner = ref(props.storeProfile?.owner || 'Habiba')
const formPhone = ref(props.storeProfile?.phone || '081234567890')
const fileInputRef = ref(null)
const isSaved = ref(false)

watch(() => props.storeProfile, (newVal) => {
  if (newVal) {
    formName.value = newVal.name || 'Habiba Store'
    formOwner.value = newVal.owner || 'Habiba'
    formPhone.value = newVal.phone || '081234567890'
  }
}, { deep: true, immediate: true })

const saveProfile = () => {
  emit('updateProfile', {
    name: formName.value.trim() || 'Habiba Store',
    owner: formOwner.value.trim() || 'Habiba',
    phone: formPhone.value.trim() || '081234567890'
  })
  isSaved.value = true
  setTimeout(() => {
    isSaved.value = false
  }, 2500)
}

const triggerImportFile = () => {
  fileInputRef.value?.click()
}

const onFileSelected = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      emit('importBackup', content)
    } catch (err) {
      alert('Gagal membaca file: ' + err.message)
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}
</script>

<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100/90 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
      
      <!-- 1. Header (Design System: Midnight Deep Navy & Azure Accent) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs">
            <Store class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Profil & Pengaturan Toko</h3>
            <p class="text-xs text-slate-500 font-medium">Identitas toko, akun Google, dan cadangan data</p>
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
              {{ formName ? formName.substring(0, 2).toUpperCase() : 'HS' }}
            </div>
          </div>
          <div class="min-w-0">
            <h4 class="text-base font-bold text-white truncate leading-tight">{{ formName }}</h4>
            <p class="text-xs text-slate-300 mt-0.5 truncate flex items-center gap-1.5">
              <span>{{ formOwner || 'Pemilik Warung' }}</span>
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

      <!-- 3. Segmented Pill Tab Bar -->
      <div class="px-5 pt-3 pb-1 shrink-0">
        <div class="p-1 bg-slate-100/80 rounded-2xl grid grid-cols-3 gap-1">
          <button 
            @click="activeTab = 'profile'"
            :class="[
              'py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'profile' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Store class="w-3.5 h-3.5" />
            <span>Profil Toko</span>
          </button>

          <button 
            @click="activeTab = 'cloud'"
            :class="[
              'py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'cloud' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Cloud class="w-3.5 h-3.5" />
            <span>Akun Google</span>
          </button>

          <button 
            @click="activeTab = 'backup'"
            :class="[
              'py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeTab === 'backup' 
                ? 'bg-[#0a193d] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            ]"
          >
            <Database class="w-3.5 h-3.5" />
            <span>Cadangan</span>
          </button>
        </div>
      </div>

      <!-- 4. Tab Body Scrollable -->
      <div class="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        
        <!-- ==================== TAB 1: PROFIL TOKO ==================== -->
        <div v-if="activeTab === 'profile'" class="space-y-4">
          <!-- Form Inputs -->
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Warung / Toko
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Store class="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  v-model="formName"
                  placeholder="Contoh: Habiba Store"
                  class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-bold text-[#0a193d] outline-hidden transition-all"
                />
              </div>
              <p class="text-[11px] text-slate-500 mt-1">Dicetak di bagian atas struk belanja & laporan harian.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Pemilik / Kasir
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User class="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    v-model="formOwner"
                    placeholder="Contoh: Habiba"
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
                    placeholder="081234567890"
                    class="w-full h-11 pl-10 pr-4 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-500/10 rounded-2xl text-sm font-mono font-semibold text-[#0a193d] outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Save Button with Success Feedback -->
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
            <span>{{ isSaved ? 'Profil Berhasil Disimpan!' : 'Simpan Perubahan Profil' }}</span>
          </button>
        </div>

        <!-- ==================== TAB 2: AKUN GOOGLE ==================== -->
        <div v-else-if="activeTab === 'cloud'" class="space-y-3.5">
          <!-- Jika Belum Terhubung -->
          <div v-if="!isGoogleConnected" class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
            <div class="flex items-center gap-2 text-slate-800">
              <Cloud class="w-5 h-5 text-[#0284c7]" />
              <h4 class="text-sm font-bold text-[#0a193d]">Cadangan Otomatis Akun Google</h4>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">
              Hubungkan akun Google agar data toko Anda selalu aman dan kasir bisa dibuka dari perangkat lain:
            </p>

            <div class="space-y-2 text-xs text-slate-700">
              <div class="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200/60">
                <HardDrive class="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
                <div>
                  <strong class="block text-slate-900">Aman Saat Ganti HP</strong>
                  <span class="text-slate-500 text-[11px]">Data barang dan catatan penjualan tersimpan aman di Google Drive Anda.</span>
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
              class="w-full h-12 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-xs transition-all active:scale-98"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Hubungkan dengan Akun Google</span>
            </button>
          </div>

          <!-- Jika Sudah Terhubung -->
          <div v-else class="space-y-3">
            <!-- Account Card -->
            <div class="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <img 
                    v-if="googleUser?.picture" 
                    :src="googleUser.picture" 
                    referrerpolicy="no-referrer"
                    class="w-10 h-10 rounded-full border-2 border-emerald-300 shadow-2xs"
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

              <div class="p-2.5 bg-white rounded-xl border border-emerald-100 text-xs text-slate-600 flex items-center justify-between">
                <span class="font-medium">Terakhir Disimpan:</span>
                <span class="font-bold text-[#0a193d]">
                  {{ lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Siap disimpan' }}
                </span>
              </div>
            </div>

            <!-- Action Buttons Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                @click="emit('syncNow')"
                :disabled="isSyncing"
                class="h-11 px-4 bg-[#0a193d] hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer text-xs transition-all shadow-xs active:scale-95"
              >
                <RefreshCw :class="['w-4 h-4 text-sky-400', isSyncing ? 'animate-spin' : '']" />
                <span>{{ isSyncing ? 'Menyimpan Data...' : 'Simpan ke Google Sekarang' }}</span>
              </button>

              <button 
                @click="emit('openGoogleSheet')"
                class="h-11 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer text-xs transition-all shadow-xs active:scale-95"
              >
                <FileSpreadsheet class="w-4 h-4 text-emerald-200" />
                <span>Buka Buku Kas (Sheets)</span>
              </button>
            </div>

            <!-- Disconnect Action -->
            <div class="text-center pt-1">
              <button 
                @click="emit('disconnectGoogle')"
                class="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer transition-colors"
              >
                Putuskan Sambungan Akun Google
              </button>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 3: CADANGAN DATA ==================== -->
        <div v-else class="space-y-3.5">
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div class="flex items-center gap-2 text-[#0a193d]">
              <Database class="w-5 h-5 text-[#0284c7]" />
              <h4 class="text-sm font-bold">Cadangan Mandiri</h4>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              Simpan salinan data toko ke HP atau komputer agar Anda punya arsip cadangan yang aman tanpa perlu koneksi internet.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button 
                @click="emit('exportBackup')"
                class="p-3 bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 text-left rounded-2xl cursor-pointer transition-all active:scale-95 group shadow-2xs"
              >
                <div class="w-8 h-8 rounded-xl bg-sky-50 text-[#0284c7] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Download class="w-4 h-4" />
                </div>
                <strong class="text-xs font-bold text-[#0a193d] block">Download Cadangan Toko</strong>
                <span class="text-[11px] text-slate-500">Simpan salinan data ke HP / Komputer</span>
              </button>

              <button 
                @click="triggerImportFile"
                class="p-3 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 text-left rounded-2xl cursor-pointer transition-all active:scale-95 group shadow-2xs"
              >
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Upload class="w-4 h-4" />
                </div>
                <strong class="text-xs font-bold text-[#0a193d] block">Pulihkan Data Toko</strong>
                <span class="text-[11px] text-slate-500">Buka file cadangan yang pernah disimpan</span>
              </button>

              <input 
                type="file" 
                ref="fileInputRef" 
                accept=".json,application/json" 
                class="hidden" 
                @change="onFileSelected"
              />
            </div>
          </div>

          <div class="p-3 bg-sky-50/60 rounded-2xl border border-sky-100 flex items-center gap-2.5 text-xs text-sky-900">
            <ShieldCheck class="w-4 h-4 text-[#0284c7] shrink-0" />
            <span>Semua data transaksi otomatis tersimpan di HP ini dan tetap bisa dipakai walau tanpa kuota internet.</span>
          </div>
        </div>

      </div>

      <!-- 5. Footer with Credit -->
      <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
        <p class="text-xs text-slate-500 font-medium flex items-center gap-1">
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
        <button 
          @click="emit('close')"
          class="h-10 px-5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/90 cursor-pointer transition-colors shadow-2xs"
        >
          Selesai
        </button>
      </div>

    </div>
  </div>
</template>
