<script setup>
import { ref } from 'vue'
import { X, Settings, Store, Cloud, CheckCircle, Database, FileSpreadsheet, ShieldCheck, RefreshCw, Key, ExternalLink } from '@lucide/vue'

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
  customClientId: {
    type: String,
    default: ''
  },
  licenseStatus: {
    type: Object,
    default: () => ({
      isLifetime: false,
      txCount: 42,
      txLimit: 300
    })
  }
})

const emit = defineEmits([
  'close', 
  'updateProfile', 
  'connectGoogle', 
  'disconnectGoogle', 
  'syncNow',
  'openGoogleSheet', 
  'updateCustomClientId',
  'exportBackup', 
  'importBackup',
  'activateLicense'
])

const formName = ref(props.storeProfile.name)
const formOwner = ref(props.storeProfile.owner)
const formPhone = ref(props.storeProfile.phone)
const formClientId = ref(props.customClientId)
const showClientIdInput = ref(false)
const licenseInput = ref('')
const fileInputRef = ref(null)

const saveProfile = () => {
  emit('updateProfile', {
    name: formName.value.trim(),
    owner: formOwner.value.trim(),
    phone: formPhone.value.trim()
  })
}

const saveCustomClientId = () => {
  emit('updateCustomClientId', formClientId.value.trim())
  alert('Google Client ID berhasil disimpan!')
}

const handleLicense = () => {
  if (!licenseInput.value.trim()) return
  emit('activateLicense', licenseInput.value.trim())
  licenseInput.value = ''
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
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <!-- Header (Design System: Deep Navy & Clean Subtitle) -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-slate-100 text-[#0a193d] flex items-center justify-center border border-slate-200/80">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Pengaturan Warung</h3>
            <p class="text-xs text-slate-500 font-medium">Profil warung, akun Google, & cadangan</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content Scrollable -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- 1. Identitas Toko -->
        <div class="space-y-2.5">
          <div class="flex items-center gap-2">
            <Store class="w-4 h-4 text-emerald-700" />
            <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Identitas Warung</h4>
          </div>
          <div class="space-y-2">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Nama Warung (Muncul di Struk & Laporan):</label>
              <input 
                type="text" 
                v-model="formName"
                class="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 outline-hidden focus:border-emerald-700"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Nama Pemilik:</label>
                <input 
                  type="text" 
                  v-model="formOwner"
                  class="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 outline-hidden focus:border-emerald-700"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">WhatsApp Toko:</label>
                <input 
                  type="text" 
                  v-model="formPhone"
                  class="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 outline-hidden focus:border-emerald-700"
                />
              </div>
            </div>
          </div>
          <button 
            @click="saveProfile"
            class="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
          >
            Simpan Identitas
          </button>
        </div>

        <hr class="border-slate-100" />

        <!-- 2. Integrasi Google (Drive & Sheets) -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Cloud class="w-4 h-4 text-emerald-700" />
              <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Integrasi Akun Google</h4>
            </div>
            <span 
              :class="[
                'text-[11px] font-medium px-2 py-0.5 rounded-full',
                isGoogleConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              ]"
            >
              {{ isGoogleConnected ? 'Terhubung' : 'Belum Terhubung' }}
            </span>
          </div>

          <!-- Jika Belum Terhubung -->
          <div v-if="!isGoogleConnected" class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <p>
              Hubungkan akun Google untuk <strong>otomatis mencadangkan data ke Google Drive</strong> dan <strong>sinkronisasi buku kas ke Google Sheets</strong> tanpa biaya server ($0).
            </p>
            <button 
              @click="emit('connectGoogle')"
              class="w-full h-10 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-medium text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Hubungkan dengan Google (1-Klik)</span>
            </button>
          </div>

          <!-- Jika Sudah Terhubung -->
          <div v-else class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img 
                  v-if="googleUser?.picture" 
                  :src="googleUser.picture" 
                  referrerpolicy="no-referrer"
                  class="w-7 h-7 rounded-full border border-emerald-300"
                />
                <div v-else class="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                  {{ googleUser?.name?.charAt(0) || 'G' }}
                </div>
                <div>
                  <p class="font-bold text-slate-900 leading-tight">{{ googleUser?.name || 'Pemilik Warung' }}</p>
                  <p class="text-[11px] text-slate-500 font-mono">{{ googleUser?.email || '' }}</p>
                </div>
              </div>
              <span class="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                Multi-Device Aktif
              </span>
            </div>

            <div class="p-2 bg-white/80 rounded-lg border border-emerald-100 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Status Cloud:</span>
              <span class="font-medium text-slate-800">
                {{ lastSyncTime ? 'Tersinkron (' + new Date(lastSyncTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ')' : 'Siap sinkron' }}
              </span>
            </div>

            <div class="flex gap-2 pt-0.5 flex-wrap">
              <button 
                @click="emit('syncNow')"
                :disabled="isSyncing"
                class="h-8 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <RefreshCw :class="['w-3.5 h-3.5', isSyncing ? 'animate-spin' : '']" />
                <span>{{ isSyncing ? 'Sinkronisasi...' : 'Sinkronkan Sekarang' }}</span>
              </button>

              <button 
                @click="emit('openGoogleSheet')"
                class="h-8 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg flex items-center gap-1.5 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <FileSpreadsheet class="w-3.5 h-3.5" />
                <span>Buka Google Sheets</span>
              </button>

              <button 
                @click="emit('disconnectGoogle')"
                class="h-8 px-2.5 bg-white text-slate-600 border border-slate-300 font-medium rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors ml-auto"
              >
                Putuskan
              </button>
            </div>
          </div>

          <!-- Pengaturan Lanjutan Client ID (Opsional) -->
          <div class="pt-1">
            <button 
              @click="showClientIdInput = !showClientIdInput"
              class="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Key class="w-3 h-3" />
              <span>Pengaturan Google Client ID (Opsional)</span>
            </button>
            <div v-if="showClientIdInput" class="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <p class="text-slate-500 text-[11px]">
                Gunakan Client ID Google Cloud sendiri untuk akses produksi domain kustom:
              </p>
              <input 
                type="text" 
                v-model="formClientId"
                placeholder="apps.googleusercontent.com..."
                class="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 outline-hidden"
              />
              <button 
                @click="saveCustomClientId"
                class="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-md cursor-pointer"
              >
                Simpan Client ID
              </button>
            </div>
          </div>
        </div>

        <hr class="border-slate-100" />

        <!-- 3. Cadangan Offline (JSON) -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Database class="w-4 h-4 text-slate-600" />
            <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">Cadangan Offline (JSON)</h4>
          </div>
          <p class="text-xs text-slate-500 font-normal">
            Simpan cadangan data produk, transaksi, dan buku utang ke file `.json` agar tidak hilang jika ganti HP.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button 
              @click="emit('exportBackup')"
              class="h-9 bg-slate-50 hover:bg-slate-100 font-medium text-xs text-slate-700 rounded-lg border border-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
            >
              Unduh Backup (.json)
            </button>
            <button 
              @click="triggerImportFile"
              class="h-9 bg-slate-50 hover:bg-slate-100 font-medium text-xs text-slate-700 rounded-lg border border-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
            >
              Pulihkan Backup
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

        <hr class="border-slate-100" />

        <!-- 4. Status Lisensi -->
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 text-slate-700" />
              <h4 class="text-xs font-semibold uppercase text-slate-800">Lisensi Kasiry</h4>
            </div>
            <span class="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {{ licenseStatus.isLifetime ? 'Aktif Penuh' : 'Masa Percobaan' }}
            </span>
          </div>

          <div v-if="!licenseStatus.isLifetime" class="text-xs text-slate-600 space-y-1.5">
            <p>
              Terpakai: <strong>{{ licenseStatus.txCount }} / {{ licenseStatus.txLimit }}</strong> transaksi gratis.
            </p>
            <div class="flex items-center gap-2 pt-0.5">
              <input 
                type="text" 
                v-model="licenseInput"
                placeholder="Kode Aktivasi..."
                class="flex-1 h-8 px-2.5 bg-white border border-slate-300 text-xs rounded-lg text-slate-900 outline-hidden font-mono"
              />
              <button 
                @click="handleLicense"
                class="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg cursor-pointer"
              >
                Aktivasi
              </button>
            </div>
          </div>
          <div v-else class="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle class="w-3.5 h-3.5" /> Lisensi seumur hidup aktif.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-slate-50/70 border-t border-slate-200 flex justify-end shrink-0">
        <button 
          @click="emit('close')"
          class="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 cursor-pointer text-xs"
        >
          Selesai
        </button>
      </div>
    </div>
  </div>
</template>
