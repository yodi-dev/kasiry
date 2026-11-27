<script setup>
import { ref, computed, watch } from 'vue'
import {
  X,
  Smartphone,
  Zap,
  History,
  Check,
  CheckCircle,
  AlertCircle,
  Trash2,
  Receipt,
  Pencil,
  UserPlus,
  Search
} from '@lucide/vue'
import { recordBelongsToShift } from '../utils/dailyStats'
import { computeFinanceBalances } from '../utils/financeEngine'

const DIGITAL_PRESETS_STORAGE_KEY = 'kasiry_digital_presets_v1'

const DEFAULT_PRESETS = {
  PULSA: [
    { key: 'P5', label: '5rb', productName: 'Pulsa 5.000', nominal: 5000, costPrice: 5500, sellPrice: 7000 },
    { key: 'P10', label: '10rb', productName: 'Pulsa 10.000', nominal: 10000, costPrice: 10500, sellPrice: 12000 },
    { key: 'P15', label: '15rb', productName: 'Pulsa 15.000', nominal: 15000, costPrice: 15500, sellPrice: 17000 },
    { key: 'P20', label: '20rb', productName: 'Pulsa 20.000', nominal: 20000, costPrice: 20500, sellPrice: 22000 },
    { key: 'P25', label: '25rb', productName: 'Pulsa 25.000', nominal: 25000, costPrice: 25500, sellPrice: 27000 },
    { key: 'P50', label: '50rb', productName: 'Pulsa 50.000', nominal: 50000, costPrice: 50200, sellPrice: 52000 },
    { key: 'P100', label: '100rb', productName: 'Pulsa 100.000', nominal: 100000, costPrice: 99500, sellPrice: 102000 }
  ],
  TOKEN_LISTRIK: [
    { key: 'L20', label: '20rb', productName: 'Token PLN 20.000', nominal: 20000, costPrice: 20500, sellPrice: 22500 },
    { key: 'L50', label: '50rb', productName: 'Token PLN 50.000', nominal: 50000, costPrice: 50500, sellPrice: 52500 },
    { key: 'L100', label: '100rb', productName: 'Token PLN 100.000', nominal: 100000, costPrice: 100500, sellPrice: 102500 },
    { key: 'L200', label: '200rb', productName: 'Token PLN 200.000', nominal: 200000, costPrice: 200500, sellPrice: 203000 },
    { key: 'L500', label: '500rb', productName: 'Token PLN 500.000', nominal: 500000, costPrice: 500500, sellPrice: 503000 }
  ],
  PAKET_DATA: [
    { key: 'D1', label: 'Harian / Mini', productName: 'Paket Data Harian', nominal: 10000, costPrice: 10000, sellPrice: 12000 },
    { key: 'D2', label: 'Paket 5GB', productName: 'Paket Data 5GB', nominal: 25000, costPrice: 24000, sellPrice: 27000 },
    { key: 'D3', label: 'Paket 10GB', productName: 'Paket Data 10GB', nominal: 40000, costPrice: 38000, sellPrice: 42000 },
    { key: 'D4', label: 'Paket 20GB', productName: 'Paket Data 20GB', nominal: 60000, costPrice: 58000, sellPrice: 63000 }
  ],
  TAGIHAN: [
    { key: 'T1', label: 'PLN Pasca', productName: 'Tagihan Listrik PLN', nominal: 0, costPrice: 0, sellPrice: 0 },
    { key: 'T2', label: 'PDAM / BPJS', productName: 'Tagihan PDAM / BPJS', nominal: 0, costPrice: 0, sellPrice: 0 }
  ]
}

const loadRememberedPresets = () => {
  const clone = JSON.parse(JSON.stringify(DEFAULT_PRESETS))
  if (typeof localStorage === 'undefined') return clone
  try {
    const raw = localStorage.getItem(DIGITAL_PRESETS_STORAGE_KEY)
    if (!raw) return clone
    const saved = JSON.parse(raw)
    Object.keys(clone).forEach((cat) => {
      if (!saved[cat]) return
      clone[cat] = clone[cat].map((item) => {
        const override = saved[cat]?.[item.key]
        if (!override) return item
        return {
          ...item,
          costPrice: Number.isFinite(Number(override.costPrice)) ? Number(override.costPrice) : item.costPrice,
          sellPrice: Number.isFinite(Number(override.sellPrice)) ? Number(override.sellPrice) : item.sellPrice
        }
      })
    })
  } catch {
    // Abaikan korup JSON di localStorage
  }
  return clone
}

const persistPresetOverride = (category, presetKey, costPrice, sellPrice) => {
  if (typeof localStorage === 'undefined' || !presetKey || presetKey === 'CUSTOM') return
  try {
    const raw = localStorage.getItem(DIGITAL_PRESETS_STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    if (!saved[category]) saved[category] = {}
    saved[category][presetKey] = { costPrice, sellPrice }
    localStorage.setItem(DIGITAL_PRESETS_STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Abaikan bila quota penuh
  }
}

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  digitalProducts: {
    type: Array,
    default: () => []
  },
  customers: {
    type: Array,
    default: () => []
  },
  activeShift: {
    type: Object,
    default: null
  },
  stats: {
    type: Object,
    default: () => ({
      todayDigitalSales: 0,
      todayDigitalCost: 0,
      todayDigitalProfit: 0,
      todayDigitalCount: 0
    })
  },
  precomputedPockets: {
    type: Object,
    default: null
  },
  transactions: {
    type: Array,
    default: () => []
  },
  debtPayments: {
    type: Array,
    default: () => []
  },
  expenses: {
    type: Array,
    default: () => []
  },
  cashServices: {
    type: Array,
    default: () => []
  },
  fundMovements: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'close',
  'recordDigitalProduct',
  'updateTokenCode',
  'deleteDigitalProduct',
  'openReceipt'
])

const activeTab = ref('form')
const selectedCategory = ref('PULSA')
const presetMap = ref(loadRememberedPresets())
const selectedPresetKey = ref('P10')
const productNameInput = ref('Pulsa 10.000')
const providerInput = ref('Telkomsel')
const targetNumberInput = ref('')
const tokenCodeInput = ref('')
const nominalValue = ref(10000)
const costPriceInput = ref('10500')
const sellPriceInput = ref('12000')
const selectedCostSource = ref('PIHAK_KETIGA')
const paymentMethod = ref('TUNAI')
const customerSearchQuery = ref('')
const selectedCustomerId = ref(null)
const newCustomerNameInput = ref('')
const noteInput = ref('')
const autoOpenReceipt = ref(true)

const confirmingDeleteId = ref(null)
const editingTokenId = ref(null)
const editingTokenValue = ref('')
const savedBannerText = ref('')
const errorBanner = ref('')

const mobileProviders = ['Telkomsel', 'Indosat', 'XL', 'Axis', 'Tri', 'Smartfren', 'by.U', 'Lainnya']
const categoryOptions = [
  { id: 'PULSA', label: 'Pulsa', icon: Smartphone },
  { id: 'TOKEN_LISTRIK', label: 'Token PLN', icon: Zap },
  { id: 'PAKET_DATA', label: 'Paket Data', icon: Smartphone },
  { id: 'TAGIHAN', label: 'Lainnya', icon: Receipt }
]

const currentPresets = computed(() => presetMap.value[selectedCategory.value] || [])

const applyPreset = (preset) => {
  selectedPresetKey.value = preset.key
  productNameInput.value = preset.productName
  nominalValue.value = preset.nominal
  costPriceInput.value = preset.costPrice ? String(preset.costPrice) : ''
  sellPriceInput.value = preset.sellPrice ? String(preset.sellPrice) : ''
}

const selectCustomNominal = () => {
  selectedPresetKey.value = 'CUSTOM'
  nominalValue.value = 0
  if (selectedCategory.value === 'TOKEN_LISTRIK') {
    productNameInput.value = 'Token Listrik PLN'
  } else if (selectedCategory.value === 'PAKET_DATA') {
    productNameInput.value = 'Paket Data'
  } else if (selectedCategory.value === 'TAGIHAN') {
    productNameInput.value = 'Pembayaran PPOB'
  } else {
    productNameInput.value = 'Pulsa'
  }
  costPriceInput.value = ''
  sellPriceInput.value = ''
}

watch(() => props.isOpen, (open) => {
  if (open) {
    presetMap.value = loadRememberedPresets()
    activeTab.value = 'form'
    selectedCategory.value = 'PULSA'
    providerInput.value = 'Telkomsel'
    targetNumberInput.value = ''
    tokenCodeInput.value = ''
    selectedCostSource.value = 'PIHAK_KETIGA'
    paymentMethod.value = 'TUNAI'
    customerSearchQuery.value = ''
    selectedCustomerId.value = null
    newCustomerNameInput.value = ''
    noteInput.value = ''
    confirmingDeleteId.value = null
    editingTokenId.value = null
    savedBannerText.value = ''
    errorBanner.value = ''
    const first = presetMap.value.PULSA?.[1] || presetMap.value.PULSA?.[0]
    if (first) applyPreset(first)
  }
}, { immediate: true })

watch(selectedCategory, (cat) => {
  errorBanner.value = ''
  if (cat === 'TOKEN_LISTRIK') {
    providerInput.value = 'PLN'
  } else if (cat === 'TAGIHAN') {
    providerInput.value = 'PPOB'
  } else if (providerInput.value === 'PLN' || providerInput.value === 'PPOB') {
    providerInput.value = 'Telkomsel'
  }
  const presets = presetMap.value[cat] || []
  if (presets.length > 0) {
    applyPreset(presets[0])
  } else {
    selectCustomNominal()
  }
})

const parsedCostPrice = computed(() => {
  const num = parseInt(String(costPriceInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const parsedSellPrice = computed(() => {
  const num = parseInt(String(sellPriceInput.value).replace(/\D/g, ''), 10)
  return Number.isFinite(num) ? num : 0
})

const estimatedProfit = computed(() => parsedSellPrice.value - parsedCostPrice.value)

const costSourceOptions = [
  { id: 'PIHAK_KETIGA', label: 'Saldo Pihak Ketiga' },
  { id: 'REKENING', label: 'Rekening / QRIS' },
  { id: 'KAS', label: 'Uang Kas' },
  { id: 'LUAR', label: 'Dana Luar' }
]

const pocketBalances = computed(() =>
  computeFinanceBalances({
    transactions: props.transactions,
    debtPayments: props.debtPayments,
    expenses: props.expenses,
    cashServices: props.cashServices,
    digitalProducts: props.digitalProducts,
    fundMovements: props.fundMovements,
    customers: props.customers,
    precomputedPockets: props.precomputedPockets
  })
)

const getCostBalanceForSource = (src) => {
  if (src === 'PIHAK_KETIGA') return Number(pocketBalances.value.pihakKetigaBalance || 0)
  if (src === 'REKENING') return Number(pocketBalances.value.rekeningBalance || 0)
  if (src === 'KAS') return Number(pocketBalances.value.kasBalance || 0)
  return Infinity
}

const activeCostSourceLabel = computed(() => {
  return costSourceOptions.find(o => o.id === selectedCostSource.value)?.label || 'Saldo Pihak Ketiga'
})

const isCostBalanceLow = computed(() => {
  if (selectedCostSource.value === 'LUAR') return false
  if (parsedCostPrice.value <= 0) return false
  return getCostBalanceForSource(selectedCostSource.value) < parsedCostPrice.value
})

const eligibleDebtCustomers = computed(() => {
  const q = customerSearchQuery.value.trim().toLowerCase()
  return (props.customers || [])
    .filter(c => c && !c.deleted && c.name && c.name.trim().toLowerCase() !== 'umum')
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
    .slice(0, 8)
})

const selectedCustomerObj = computed(() => {
  if (!selectedCustomerId.value) return null
  return (props.customers || []).find(c => c.id === selectedCustomerId.value) || null
})

const resolvedCustomerForDebt = computed(() => {
  if (selectedCustomerObj.value) return selectedCustomerObj.value
  const typed = newCustomerNameInput.value.trim() || customerSearchQuery.value.trim()
  if (!typed || typed.toLowerCase() === 'umum') return null
  return { name: typed, phone: '' }
})

const isDebtInvalid = computed(() => {
  if (paymentMethod.value !== 'UTANG / BON') return false
  return !resolvedCustomerForDebt.value
})

const periodDigitalProducts = computed(() => {
  if (props.activeShift && props.activeShift.status === 'OPEN') {
    return (props.digitalProducts || [])
      .filter(d => d && !d.deleted && recordBelongsToShift(d, props.activeShift, 'createdAt'))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const cutoff = startOfDay.getTime()
  return (props.digitalProducts || [])
    .filter(d => d && !d.deleted && (d.createdAt || 0) >= cutoff)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const handleSubmit = () => {
  errorBanner.value = ''
  if (parsedSellPrice.value <= 0) {
    errorBanner.value = 'Harga jual ke pembeli harus lebih dari Rp 0.'
    return
  }
  if (isDebtInvalid.value) {
    errorBanner.value = 'Untuk metode Utang / Bon, pilih pelanggan atau ketik nama pelanggan baru (bukan "Umum").'
    return
  }

  // Ingat harga modal & harga jual preset ini ke localStorage
  if (selectedPresetKey.value && selectedPresetKey.value !== 'CUSTOM') {
    persistPresetOverride(selectedCategory.value, selectedPresetKey.value, parsedCostPrice.value, parsedSellPrice.value)
    presetMap.value = loadRememberedPresets()
  }

  const payload = {
    category: selectedCategory.value,
    productName: productNameInput.value.trim() || 'Produk Digital',
    provider: providerInput.value.trim() || (selectedCategory.value === 'TOKEN_LISTRIK' ? 'PLN' : 'Umum'),
    targetNumber: targetNumberInput.value.trim(),
    tokenCode: tokenCodeInput.value.trim(),
    nominal: nominalValue.value,
    costPrice: parsedCostPrice.value,
    sellPrice: parsedSellPrice.value,
    costSource: selectedCostSource.value,
    paymentMethod: paymentMethod.value,
    customer: paymentMethod.value === 'UTANG / BON'
      ? resolvedCustomerForDebt.value
      : (selectedCustomerObj.value || { id: 1, name: 'Umum' }),
    note: noteInput.value.trim(),
    openReceipt: autoOpenReceipt.value
  }

  emit('recordDigitalProduct', payload)
  savedBannerText.value = `${payload.productName} Rp ${payload.sellPrice.toLocaleString('id-ID')} (${payload.paymentMethod}) berhasil dicatat!`

  targetNumberInput.value = ''
  tokenCodeInput.value = ''
  noteInput.value = ''

  setTimeout(() => {
    savedBannerText.value = ''
  }, 3000)
}

const startEditToken = (item) => {
  editingTokenId.value = item.id
  editingTokenValue.value = item.tokenCode || ''
}

const saveEditedToken = (itemId) => {
  emit('updateTokenCode', { id: itemId, tokenCode: editingTokenValue.value.trim() })
  editingTokenId.value = null
  editingTokenValue.value = ''
}

const triggerDelete = (id) => {
  if (confirmingDeleteId.value === id) {
    emit('deleteDigitalProduct', id)
    confirmingDeleteId.value = null
  } else {
    confirmingDeleteId.value = id
    setTimeout(() => {
      if (confirmingDeleteId.value === id) confirmingDeleteId.value = null
    }, 3500)
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">

      <!-- 1. Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-[#0a193d] text-white flex items-center justify-center shadow-xs shrink-0">
            <Zap class="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">
              Pulsa, Paket Data &amp; Token PLN
            </h3>
            <p class="text-xs text-slate-500 font-medium">
              {{ activeShift ? `Shift ${activeShift.shiftCode} • Modal: ${activeCostSourceLabel}` : `Hitung Harian • Modal: ${activeCostSourceLabel}` }}
            </p>
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

      <!-- 2. Tab Switcher -->
      <div class="px-5 pt-3 pb-1 shrink-0 bg-white border-b border-slate-100">
        <div class="p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1">
          <button
            type="button"
            @click="activeTab = 'form'"
            :class="[
              'h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'form' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <Smartphone class="w-4 h-4 shrink-0" />
            <span>Jual Pulsa / PLN</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'history'"
            :class="[
              'h-10 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all',
              activeTab === 'history' ? 'bg-[#0a193d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <History class="w-4 h-4 shrink-0" />
            <span>Riwayat ({{ periodDigitalProducts.length }})</span>
          </button>
        </div>
      </div>

      <!-- 3. Body -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

        <!-- KPI Banner -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="min-w-0 p-3 rounded-2xl bg-sky-50/75 border border-sky-200/75">
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Omzet Digital</span>
            <p class="text-base sm:text-lg font-bold font-mono text-[#0a193d] mt-0.5 break-words">
              Rp {{ (stats.todayDigitalSales || 0).toLocaleString('id-ID') }}
            </p>
          </div>

          <div class="min-w-0 p-3 rounded-2xl bg-emerald-50/75 border border-emerald-200/75">
            <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Laba Pulsa &amp; PLN</span>
            <p class="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-0.5 break-words">
              +Rp {{ (stats.todayDigitalProfit || 0).toLocaleString('id-ID') }}
            </p>
          </div>
        </div>

        <!-- TAB 1: FORM JUAL -->
        <template v-if="activeTab === 'form'">
          <div
            v-if="savedBannerText"
            class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{{ savedBannerText }}</span>
          </div>

          <div
            v-if="errorBanner"
            class="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{{ errorBanner }}</span>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Pilih Jenis Produk Digital -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori Produk Digital
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  v-for="cat in categoryOptions"
                  :key="cat.id"
                  type="button"
                  @click="selectedCategory = cat.id"
                  :class="[
                    'h-10 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all',
                    selectedCategory === cat.id
                      ? 'bg-[#0a193d] text-white border-[#0a193d] shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  <component :is="cat.icon" class="w-3.5 h-3.5 shrink-0" />
                  <span>{{ cat.label }}</span>
                </button>
              </div>
            </div>

            <!-- Preset Nominal & Harga Diingat -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Nominal Cepat
                </label>
                <span class="text-[10px] text-[#0284c7] font-semibold">Harga modal &amp; jual diingat otomatis</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="preset in currentPresets"
                  :key="preset.key"
                  type="button"
                  @click="applyPreset(preset)"
                  :class="[
                    'px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border',
                    selectedPresetKey === preset.key
                      ? 'bg-[#0a193d] text-white border-[#0a193d]'
                      : 'bg-slate-100 hover:bg-sky-50 hover:text-[#0284c7] text-slate-700 border-slate-200/70'
                  ]"
                >
                  {{ preset.label }}
                </button>
                <button
                  type="button"
                  @click="selectCustomNominal"
                  :class="[
                    'px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors border',
                    selectedPresetKey === 'CUSTOM'
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                  ]"
                >
                  + Custom
                </button>
              </div>
            </div>

            <!-- Nama Produk & Provider -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Nama Item di Struk
                </label>
                <input
                  type="text"
                  v-model="productNameInput"
                  placeholder="Misal: Token PLN 50.000"
                  class="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-bold text-[#0a193d] outline-hidden"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Provider / Operator
                </label>
                <div v-if="selectedCategory === 'PULSA' || selectedCategory === 'PAKET_DATA'" class="flex flex-wrap gap-1">
                  <button
                    v-for="prov in mobileProviders"
                    :key="prov"
                    type="button"
                    @click="providerInput = prov"
                    :class="[
                      'px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer border',
                      providerInput === prov
                        ? 'bg-[#0284c7] text-white border-[#0284c7]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                    ]"
                  >
                    {{ prov }}
                  </button>
                </div>
                <input
                  v-else
                  type="text"
                  v-model="providerInput"
                  placeholder="Misal: PLN / PDAM"
                  class="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0284c7] rounded-xl text-xs font-bold text-[#0a193d] outline-hidden"
                />
              </div>
            </div>

            <!-- Nomor Tujuan & Nomor Token PLN -->
            <div class="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-2.5">
              <div>
                <label class="block text-[11px] font-bold text-[#0a193d] uppercase tracking-wider mb-1">
                  {{ selectedCategory === 'TOKEN_LISTRIK' ? 'No. Meter / ID Pelanggan PLN' : 'Nomor HP / ID Tujuan' }}
                </label>
                <input
                  type="text"
                  inputmode="tel"
                  v-model="targetNumberInput"
                  :placeholder="selectedCategory === 'TOKEN_LISTRIK' ? 'Contoh: 541200889911' : 'Contoh: 081234567890'"
                  class="w-full h-10 px-3 bg-white border border-sky-200 focus:border-[#0284c7] rounded-xl text-sm font-bold font-mono text-[#0a193d] outline-hidden"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-[#0a193d] uppercase tracking-wider mb-1">
                  {{ selectedCategory === 'TOKEN_LISTRIK' ? 'Nomor Token Stroom PLN (20 Digit)' : 'No. SN / Ref (Opsional — tampil di struk & WA)' }}
                </label>
                <input
                  type="text"
                  v-model="tokenCodeInput"
                  :placeholder="selectedCategory === 'TOKEN_LISTRIK' ? 'Tempel 20 digit token di sini agar tercetak di struk & WA' : 'Opsional: Nomor SN transaksi'"
                  class="w-full h-10 px-3 bg-white border border-sky-200 focus:border-[#0284c7] rounded-xl text-xs sm:text-sm font-bold font-mono text-[#0a193d] outline-hidden"
                />
              </div>
            </div>

            <!-- Harga Modal vs Harga Jual -->
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Harga Modal (Rp)
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    v-model="costPriceInput"
                    placeholder="10500"
                    class="w-full h-11 pl-8 pr-3 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-bold font-mono text-[#0a193d] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Harga Jual Pembeli (Rp)
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    v-model="sellPriceInput"
                    placeholder="12000"
                    class="w-full h-11 pl-8 pr-3 bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-[#0284c7] rounded-xl text-sm font-bold font-mono text-[#0a193d] outline-hidden"
                  />
                </div>
              </div>
            </div>

            <!-- Sumber Modal Transaksi Digital -->
            <div>
              <label class="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Modal Diambil Dari
              </label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="opt in costSourceOptions"
                  :key="opt.id"
                  type="button"
                  @click="selectedCostSource = opt.id"
                  :class="[
                    'p-2 rounded-xl border text-left cursor-pointer transition-all',
                    selectedCostSource === opt.id
                      ? 'bg-sky-50 border-[#0284c7] text-[#0a193d]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                  ]"
                >
                  <span class="text-[11px] font-bold block leading-tight">{{ opt.label }}</span>
                  <span v-if="opt.id !== 'LUAR'" class="text-[10px] font-mono text-slate-500 block mt-0.5">
                    Saldo Rp {{ getCostBalanceForSource(opt.id).toLocaleString('id-ID') }}
                  </span>
                  <span v-else class="text-[10px] text-slate-500 block mt-0.5">Dompet luar / tidak potong kas</span>
                </button>
              </div>
              <p v-if="isCostBalanceLow" class="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 font-medium">
                Catatan: {{ activeCostSourceLabel }} saat ini Rp {{ getCostBalanceForSource(selectedCostSource).toLocaleString('id-ID') }} (&lt; modal Rp {{ parsedCostPrice.toLocaleString('id-ID') }}). Transaksi tetap bisa disimpan dan dapat diisi ulang dari menu Keuangan.
              </p>
            </div>

            <!-- Live Strip Laba -->
            <div class="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <span class="text-slate-600 font-medium">Laba Bersih (Jual - Modal):</span>
              <span
                :class="[
                  'font-bold font-mono',
                  estimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                ]"
              >
                {{ estimatedProfit >= 0 ? `+Rp ${estimatedProfit.toLocaleString('id-ID')}` : `-Rp ${Math.abs(estimatedProfit).toLocaleString('id-ID')}` }}
              </span>
            </div>

            <!-- Metode Bayar Pembeli -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Metode Pembayaran Pembeli
              </label>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="paymentMethod = 'TUNAI'"
                  :class="[
                    'h-10 rounded-xl font-bold text-xs border cursor-pointer transition-all',
                    paymentMethod === 'TUNAI'
                      ? 'bg-[#0a193d] text-white border-[#0a193d]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Tunai (Laci)
                </button>
                <button
                  type="button"
                  @click="paymentMethod = 'QRIS'"
                  :class="[
                    'h-10 rounded-xl font-bold text-xs border cursor-pointer transition-all',
                    paymentMethod === 'QRIS'
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  QRIS
                </button>
                <button
                  type="button"
                  @click="paymentMethod = 'UTANG / BON'"
                  :class="[
                    'h-10 rounded-xl font-bold text-xs border cursor-pointer transition-all',
                    paymentMethod === 'UTANG / BON'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  ]"
                >
                  Utang / Bon
                </button>
              </div>
            </div>

            <!-- Pemilih Pelanggan Utang (Wajib bila UTANG / BON) -->
            <div
              v-if="paymentMethod === 'UTANG / BON'"
              class="p-3.5 rounded-2xl bg-rose-50/75 border border-rose-200 space-y-2.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-rose-900">Pilih / Daftarkan Pelanggan Bon (Akun "Umum" diblokir)</span>
                <span v-if="resolvedCustomerForDebt" class="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ {{ resolvedCustomerForDebt.name }}
                </span>
              </div>

              <div class="relative">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  v-model="customerSearchQuery"
                  @input="selectedCustomerId = null"
                  placeholder="Cari nama pelanggan di buku utang..."
                  class="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 rounded-xl text-xs font-medium text-[#0a193d] outline-hidden"
                />
              </div>

              <div v-if="eligibleDebtCustomers.length > 0" class="flex flex-wrap gap-1.5">
                <button
                  v-for="c in eligibleDebtCustomers"
                  :key="c.id"
                  type="button"
                  @click="selectedCustomerId = c.id; newCustomerNameInput = ''"
                  :class="[
                    'px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer border transition-colors',
                    selectedCustomerId === c.id
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white hover:bg-rose-100 text-slate-700 border-rose-200'
                  ]"
                >
                  {{ c.name }}
                </button>
              </div>

              <div class="relative">
                <UserPlus class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  v-model="newCustomerNameInput"
                  @input="selectedCustomerId = null"
                  placeholder="Atau ketik nama pelanggan baru..."
                  class="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 rounded-xl text-xs font-medium text-[#0a193d] outline-hidden"
                />
              </div>
            </div>

            <label class="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="autoOpenReceipt"
                class="rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7]"
              />
              <span>Tampilkan struk &amp; opsi cetak / kirim WA setelah disimpan</span>
            </label>

            <button
              type="submit"
              :disabled="parsedSellPrice <= 0 || isDebtInvalid"
              class="w-full h-12 rounded-2xl bg-[#0a193d] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-98 shadow-sm"
            >
              <Check class="w-4 h-4 text-sky-400" />
              <span>Simpan Transaksi {{ selectedCategory === 'TOKEN_LISTRIK' ? 'Token Listrik' : 'Pulsa / Data' }}</span>
            </button>
          </form>
        </template>

        <!-- TAB 2: RIWAYAT PULSA & PLN -->
        <template v-else>
          <div
            v-if="periodDigitalProducts.length === 0"
            class="p-8 rounded-2xl bg-slate-50 border border-slate-200/70 text-center text-slate-400 text-xs"
          >
            <Zap class="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p class="font-bold text-slate-500">Belum ada penjualan pulsa atau token PLN</p>
            <p class="mt-0.5 text-[11px]">Transaksi konter digital dari tab Jual akan muncul di sini.</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="item in periodDigitalProducts"
              :key="item.id"
              class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border',
                        item.category === 'TOKEN_LISTRIK'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-sky-50 text-[#0284c7] border-sky-200'
                      ]"
                    >
                      {{ item.provider || item.category }}
                    </span>
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-md text-[10px] font-bold',
                        item.paymentMethod === 'UTANG / BON'
                          ? 'bg-rose-50 text-rose-700'
                          : item.paymentMethod === 'QRIS'
                            ? 'bg-sky-100 text-[#0284c7]'
                            : 'bg-emerald-50 text-emerald-700'
                      ]"
                    >
                      {{ item.paymentMethod }}
                    </span>
                    <span class="text-[11px] font-mono text-slate-400">
                      {{ item.digitalNumber }} • {{ formatTime(item.createdAt) }}
                    </span>
                  </div>

                  <p class="text-xs sm:text-sm font-bold text-[#0a193d]">
                    {{ item.productName }} — Rp {{ Number(item.sellPrice || 0).toLocaleString('id-ID') }}
                    <span class="text-emerald-700 font-semibold text-xs">
                      (Laba +Rp {{ Number(item.profit ?? (Number(item.sellPrice || 0) - Number(item.costPrice || 0))).toLocaleString('id-ID') }})
                    </span>
                  </p>

                  <p v-if="item.targetNumber || (item.customerName && item.customerName !== 'Umum')" class="text-[11px] text-slate-600 font-mono">
                    {{ [item.targetNumber ? `No: ${item.targetNumber}` : '', item.customerName && item.customerName !== 'Umum' ? `Plg: ${item.customerName}` : ''].filter(Boolean).join(' • ') }}
                  </p>
                  <p v-if="item.tokenCode" class="text-[11px] font-mono font-bold text-[#0284c7] break-all">
                    Token/SN: {{ item.tokenCode }}
                  </p>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    @click="startEditToken(item)"
                    class="h-8 px-2 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Isi atau ubah Nomor Token / SN"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    @click="emit('openReceipt', item)"
                    class="h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0284c7] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Cetak Nota / Kirim WA"
                  >
                    <Receipt class="w-3.5 h-3.5" />
                    <span class="hidden sm:inline">Nota</span>
                  </button>
                  <button
                    type="button"
                    @click="triggerDelete(item.id)"
                    :class="[
                      'h-8 px-2.5 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors border',
                      confirmingDeleteId === item.id
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200'
                    ]"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    <span v-if="confirmingDeleteId === item.id">Hapus?</span>
                  </button>
                </div>
              </div>

              <!-- Inline Edit Token / SN -->
              <div v-if="editingTokenId === item.id" class="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  v-model="editingTokenValue"
                  placeholder="Tempel 20 digit Token Listrik / SN..."
                  class="flex-1 h-9 px-3 bg-slate-50 border border-sky-300 rounded-xl text-xs font-bold font-mono text-[#0a193d] outline-hidden"
                />
                <button
                  type="button"
                  @click="saveEditedToken(item.id)"
                  class="h-9 px-3 rounded-xl bg-[#0a193d] text-white text-xs font-bold cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  @click="editingTokenId = null"
                  class="h-9 px-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
