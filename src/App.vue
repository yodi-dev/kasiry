<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, h } from 'vue'
import TopBar from './components/TopBar.vue'
import BarcodeInputBar from './components/BarcodeInputBar.vue'
import CartSection from './components/CartSection.vue'
import HeldCartsModal from './components/HeldCartsModal.vue'
import { useHeldCarts } from './composables/useHeldCarts'
import FrequentProductsSection from './components/FrequentProductsSection.vue'
import StickyBottomBar from './components/StickyBottomBar.vue'
import OwnerPinModal from './components/OwnerPinModal.vue'

const AsyncModalLoading = {
  render() {
    return h(
      'div',
      { class: 'fixed inset-0 z-50 bg-[#0a193d]/35 backdrop-blur-xs flex items-center justify-center p-4' },
      [
        h(
          'div',
          { class: 'bg-white rounded-2xl px-4 py-3 shadow-xl border border-slate-100 flex items-center gap-2.5 text-xs font-bold text-[#0a193d]' },
          [
            h('span', { class: 'w-4 h-4 rounded-full border-2 border-[#0284c7] border-t-transparent animate-spin' }),
            h('span', 'Memuat...')
          ]
        )
      ]
    )
  }
}

const AsyncModalError = {
  render() {
    return h(
      'div',
      { class: 'fixed inset-0 z-50 bg-[#0a193d]/45 backdrop-blur-xs flex items-center justify-center p-4' },
      [
        h(
          'div',
          { class: 'bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 text-center space-y-3' },
          [
            h('p', { class: 'text-sm font-bold text-[#0a193d]' }, 'Gagal memuat fitur'),
            h('p', { class: 'text-xs text-slate-500' }, 'Periksa koneksi internet Anda lalu coba muat ulang.'),
            h(
              'button',
              {
                type: 'button',
                onClick: () => window.location.reload(),
                class: 'w-full h-10 rounded-xl bg-[#0a193d] text-white text-xs font-bold cursor-pointer'
              },
              'Muat Ulang'
            )
          ]
        )
      ]
    )
  }
}

const lazyModal = (loader) => defineAsyncComponent({
  loader,
  loadingComponent: AsyncModalLoading,
  errorComponent: AsyncModalError,
  delay: 150,
  timeout: 15000,
  suspensible: false,
  onError(error, retry, fail, attempts) {
    if (attempts <= 2) {
      setTimeout(retry, 350)
    } else {
      fail(error)
    }
  }
})

// Jalur checkout inti di-code-split dari main chunk agar booting awal ngebut, lalu dipanaskan saat browser luang
const loadPaymentModal = () => import('./components/PaymentModal.vue')
const loadLazyInventoryModal = () => import('./components/LazyInventoryModal.vue')
const loadReceiptModal = () => import('./components/ReceiptModal.vue')

const PaymentModal = lazyModal(loadPaymentModal)
const LazyInventoryModal = lazyModal(loadLazyInventoryModal)
const ReceiptModal = lazyModal(loadReceiptModal)

// Fitur sekunder & berat (@zxing camera scanner, admin CRUD, backup, laporan) hanya diunduh saat dibuka
const DebtBookModal = lazyModal(() => import('./components/DebtBookModal.vue'))
const DailyReportModal = lazyModal(() => import('./components/DailyReportModal.vue'))
const ExpenseModal = lazyModal(() => import('./components/ExpenseModal.vue'))
const CashServiceModal = lazyModal(() => import('./components/CashServiceModal.vue'))
const DigitalProductModal = lazyModal(() => import('./components/DigitalProductModal.vue'))
const FinanceModal = lazyModal(() => import('./components/FinanceModal.vue'))
const RestockModal = lazyModal(() => import('./components/RestockModal.vue'))
const ShiftModal = lazyModal(() => import('./components/ShiftModal.vue'))
const SettingsModal = lazyModal(() => import('./components/SettingsModal.vue'))
const CameraScannerModal = lazyModal(() => import('./components/CameraScannerModal.vue'))
const ProductManagementModal = lazyModal(() => import('./components/ProductManagementModal.vue'))
const CustomerManagementModal = lazyModal(() => import('./components/CustomerManagementModal.vue'))

import { useKasiryDB } from './composables/useKasiryDB'
import { useHardwareScanner } from './composables/useHardwareScanner'
import { playBeepSound } from './utils/sound'
import { exportKasiryExcel } from './utils/excelExport'
import { computeDailyStats } from './utils/dailyStats'
import { computeFinanceBalances } from './utils/financeEngine'
import { buildPricedCartItem, normalizePriceTier, repriceCartItems } from './utils/pricing'
import { isLikelyBarcode } from './utils/barcode'
import { APP_BRAND_TAGLINE, formatDocumentTitle } from './utils/branding'
import { useGoogleSync } from './composables/useGoogleSync'
import { useThermalPrinter } from './composables/useThermalPrinter'
import { useOwnerLock } from './composables/useOwnerLock'

const {
  printerSettings,
  autoReconnectPrinter,
  printReceiptThermal
} = useThermalPrinter()

const openReceiptModal = async (receipt) => {
  receiptData.value = receipt
  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true

  if (printerSettings.value?.autoPrint) {
    await nextTick()
    try {
      await printReceiptThermal(receiptData.value, storeProfile.value)
    } catch (err) {
      console.error('[Kasiry] Auto-print gagal:', err)
    }
  }
}

// Dexie Database Composable (IndexedDB Engine)
const {
  isDbReady,
  products,
  frequentProducts,
  customers,
  transactions,
  debtPayments,
  expenses,
  restocks,
  cashServices,
  digitalProducts,
  fundMovements,
  shifts,
  activeShift,
  isActiveShiftStale,
  lastOpeningCash,
  cumulativePocketBalances,
  unassignedTodayCount,
  totalTransactionCount,
  olderTransactionCount,
  storeProfile,
  categories,
  lastLocalBackupTime,
  addCategory,
  deleteCategory,
  loadDatabase,
  saveProduct,
  deleteProduct,
  deleteProductsBulk,
  getAllProductUsageStats,
  resetStoreData,
  saveCustomer,
  deleteCustomer,
  recordDebtPayment,
  recordExpense,
  deleteExpense,
  recordRestock,
  deleteRestock,
  recordCashService,
  deleteCashService,
  recordFundMovement,
  deleteFundMovement,
  recordDigitalProduct,
  updateDigitalTokenCode,
  deleteDigitalProduct,
  openShift,
  closeShift,
  recordTransaction,
  deleteTransaction,
  saveStoreProfile,
  getFullDatabasePayload,
  getAllTransactionsForExport,
  getCustomerTransactions,
  getArchivableSummary,
  archiveOldTransactions,
  exportBackupJSON,
  importBackupJSON
} = useKasiryDB()

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.23.0'

const {
  isPinEnabled: isOwnerPinEnabled,
  isOwnerUnlocked,
  isPinModalOpen,
  pinModalReason,
  pinModalError,
  lockOwnerMode,
  requireOwnerAuth,
  verifyAndUnlock,
  cancelOwnerAuth
} = useOwnerLock()

// Sinkronkan <title> tab browser secara dinamis mengikuti nama toko aktif
watch(
  () => storeProfile.value?.name,
  (storeName) => {
    if (typeof document !== 'undefined') {
      document.title = formatDocumentTitle(storeName)
    }
  },
  { immediate: true }
)

// Google Drive & Sheets Sync Composable ($0 Cloud Multi-Device Engine)
const {
  isConnected: isGoogleConnected,
  userProfile: googleUser,
  lastSyncTime,
  linkedSheetId,
  pendingQueueCount,
  hasPendingDriveBackup,
  isConnecting: isGoogleConnecting,
  isSyncing: isGoogleSyncing,
  statusMessage: googleSyncStatus,
  connect: connectGoogle,
  disconnect: disconnectGoogle,
  syncWithCloud,
  checkAndPullCloudUpdates,
  uploadArchiveToDrive,
  pushCleanCloudSnapshot,
  scheduleDriveAutoBackup,
  flushPendingSheetQueue,
  appendTransactionToSheet,
  appendDebtPaymentToSheet,
  appendExpenseToSheet,
  appendRestockToSheet,
  appendCashServiceToSheet,
  appendDigitalProductToSheet,
  appendFundMovementToSheet,
  appendCancellationToSheet,
  appendShiftEventToSheet,
  ensureSpreadsheet
} = useGoogleSync()

// Helper terpusat untuk menjadwalkan auto-backup Google Drive saat data lokal berubah
const triggerCloudAutoBackup = (isTransactional = false) => {
  scheduleDriveAutoBackup(
    getFullDatabasePayload,
    (mergedPayload) => importBackupJSON(mergedPayload, 'merge', { honorArchiveCutoff: true }),
    () => storeProfile.value?.name,
    { isTransactional, txCount: totalTransactionCount.value }
  )
}

// State Jaringan & Keranjang Belanja Awal (Mulai Kosong agar Bar Pembayaran Muncul Hanya Saat Ada Barang)
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    isOnline.value = true
    if (isGoogleConnected.value) {
      await flushPendingSheetQueue(storeProfile.value?.name)
      if (hasPendingDriveBackup.value) {
        triggerCloudAutoBackup()
      }
    }
  })
  window.addEventListener('offline', () => { isOnline.value = false })
}
const cart = ref([])
const cartPriceTier = ref('ecer')
const activeCartCustomer = ref(null)
const tierAppliedByCustomer = ref(false)

// State Pencarian Barcode / Barang
const searchQuery = ref('')
const scannedBarcode = ref('')
const prefillProductName = ref('')
const mobileBarcodeRef = ref(null)
const desktopBarcodeRef = ref(null)

// State Modals
const isPaymentOpen = ref(false)
const isLazyInventoryOpen = ref(false)
const isDebtBookOpen = ref(false)
const isDailyReportOpen = ref(false)
const isExpenseOpen = ref(false)
const isCashServiceOpen = ref(false)
const isDigitalProductOpen = ref(false)
const isFinanceOpen = ref(false)
const isRestockOpen = ref(false)
const isShiftOpen = ref(false)
const isShiftAutoPrompt = ref(false)
const completedShiftSummary = ref(null)
const isSettingsOpen = ref(false)
const isReceiptOpen = ref(false)
const isCameraOpen = ref(false)
const isProductManageOpen = ref(false)
const isCustomerManageOpen = ref(false)
const isShortcutHelpOpen = ref(false)

// State Transaksi Struk
const receiptData = ref(null)

// Status apakah ada modal yang sedang terbuka
const isAnyModalOpen = computed(() => {
  return isProductManageOpen.value ||
    isCustomerManageOpen.value ||
    isDebtBookOpen.value ||
    isDailyReportOpen.value ||
    isExpenseOpen.value ||
    isCashServiceOpen.value ||
    isDigitalProductOpen.value ||
    isFinanceOpen.value ||
    isRestockOpen.value ||
    isShiftOpen.value ||
    isSettingsOpen.value ||
    isCameraOpen.value ||
    isLazyInventoryOpen.value ||
    isPaymentOpen.value ||
    isReceiptOpen.value ||
    isShortcutHelpOpen.value ||
    isPinModalOpen.value
})

// Jumlah pelanggan aktif yang masih memiliki sisa bon (mengecualikan "Umum")
const unpaidDebtCount = computed(() => {
  return customers.value.filter(
    c => c.name?.toLowerCase() !== 'umum' && (c.totalDebt || 0) > 0
  ).length
})

// Computed Laporan Kasir Real-time dalam lingkup Shift Aktif (atau hari ini jika belum buka shift)
const stats = computed(() =>
  computeDailyStats(transactions.value, debtPayments.value, expenses.value, {
    activeShift: activeShift.value,
    cashServices: cashServices.value,
    digitalProducts: digitalProducts.value,
    fundMovements: fundMovements.value
  })
)

// Computed Filtered Products for Search
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return products.value.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.barcode && p.barcode.includes(q))
  ).slice(0, 8)
})

// Computed Cart Totals
const totalCartAmount = computed(() => {
  return cart.value.reduce((acc, item) => acc + (item.sellPrice * item.qty), 0)
})

const totalCartCount = computed(() => {
  return cart.value.reduce((acc, item) => acc + item.qty, 0)
})

// Cart Actions (mendukung Multi Harga Ecer / Grosir / Agen, Auto Qty & Edit Manual)
const autoEditProductId = ref(null)

const addToCart = (product) => {
  const freshProd = products.value.find(p => p.id === product.id) || product
  const existingIndex = cart.value.findIndex(item => item.id === freshProd.id)
  if (existingIndex > -1) {
    const existing = cart.value[existingIndex]
    cart.value[existingIndex] = buildPricedCartItem(
      {
        ...existing,
        buyPrice: freshProd.buyPrice ?? existing.buyPrice,
        baseSellPrice: freshProd.sellPrice ?? existing.baseSellPrice,
        wholesalePrice: freshProd.wholesalePrice ?? existing.wholesalePrice,
        wholesaleMinQty: freshProd.wholesaleMinQty ?? existing.wholesaleMinQty,
        agentPrice: freshProd.agentPrice ?? existing.agentPrice,
        qty: existing.qty + 1
      },
      cartPriceTier.value
    )
  } else {
    cart.value.push(
      buildPricedCartItem(
        { ...freshProd, baseSellPrice: freshProd.sellPrice, qty: 1 },
        cartPriceTier.value
      )
    )
    if (!(Number(freshProd.sellPrice || 0) > 0)) {
      autoEditProductId.value = freshProd.id
    }
  }
  ensureKasaFocus()
}

const handleAttemptOpenPayment = () => {
  const unpriced = cart.value.find(i => !(Number(i.sellPrice || 0) > 0) && i.priceMode === 'auto')
  if (unpriced) {
    autoEditProductId.value = unpriced.id
    return
  }
  isPaymentOpen.value = true
}

const increaseQty = (productId) => {
  const idx = cart.value.findIndex(i => i.id === productId)
  if (idx > -1) {
    const current = cart.value[idx]
    const fresh = products.value.find(p => p.id === productId)
    cart.value[idx] = buildPricedCartItem(
      {
        ...current,
        ...(fresh ? {
          buyPrice: fresh.buyPrice,
          baseSellPrice: fresh.sellPrice,
          wholesalePrice: fresh.wholesalePrice,
          wholesaleMinQty: fresh.wholesaleMinQty,
          agentPrice: fresh.agentPrice
        } : {}),
        qty: current.qty + 1
      },
      cartPriceTier.value
    )
  }
  if (isTouchViewport()) blurKasaInputs()
}

const decreaseQty = (productId) => {
  const idx = cart.value.findIndex(i => i.id === productId)
  if (idx === -1) return
  const current = cart.value[idx]
  if (current.qty > 1) {
    cart.value[idx] = buildPricedCartItem(
      { ...current, qty: current.qty - 1 },
      cartPriceTier.value
    )
    if (isTouchViewport()) blurKasaInputs()
  } else {
    removeItem(productId)
  }
}

const removeItem = (productId) => {
  cart.value = cart.value.filter(i => i.id !== productId)
  ensureKasaFocus()
}

const clearCart = () => {
  cart.value = []
  cartPriceTier.value = 'ecer'
  activeCartCustomer.value = null
  tierAppliedByCustomer.value = false
  ensureKasaFocus()
}

const { heldCarts, heldCount, holdCart, resumeHeldCart, removeHeldCart } = useHeldCarts()
const isHeldCartsModalOpen = ref(false)

const handleHoldCart = () => {
  if (cart.value.length === 0) return
  const saved = holdCart({
    items: cart.value,
    priceTier: cartPriceTier.value,
    customer: activeCartCustomer.value
  })
  if (saved) {
    clearCart()
  }
}

const handleResumeHeldCart = (id) => {
  if (cart.value.length > 0) {
    holdCart({
      items: cart.value,
      priceTier: cartPriceTier.value,
      customer: activeCartCustomer.value
    })
  }
  const resumed = resumeHeldCart(id)
  if (!resumed) return
  cart.value = resumed.items || []
  cartPriceTier.value = normalizePriceTier(resumed.priceTier || 'ecer')
  activeCartCustomer.value = resumed.customer || null
  tierAppliedByCustomer.value = Boolean(resumed.customer && resumed.customer.priceTier)
  isHeldCartsModalOpen.value = false
  ensureKasaFocus()
}

const handleRemoveHeldCart = (id) => {
  removeHeldCart(id)
}

const handleChangeCartPriceTier = (tier) => {
  cartPriceTier.value = normalizePriceTier(tier)
  tierAppliedByCustomer.value = false
  cart.value = repriceCartItems(cart.value, products.value, cartPriceTier.value, { forceFollowNota: true })
}

const handleCustomerPriceTierChange = ({ customer, priceTier }) => {
  activeCartCustomer.value = customer || null
  const normalized = normalizePriceTier(priceTier)
  if (normalized !== 'ecer') {
    cartPriceTier.value = normalized
    tierAppliedByCustomer.value = true
    cart.value = repriceCartItems(cart.value, products.value, cartPriceTier.value, { forceFollowNota: true })
  } else if (tierAppliedByCustomer.value) {
    cartPriceTier.value = 'ecer'
    tierAppliedByCustomer.value = false
    cart.value = repriceCartItems(cart.value, products.value, cartPriceTier.value, { forceFollowNota: true })
  }
}

const handleUpdateItemPrice = async ({ productId, priceMode, customPrice, saveToCatalogTier = 'none' }) => {
  let updatedCatalog = null
  if (saveToCatalogTier !== 'none' && customPrice > 0) {
    const existingProd = products.value.find(p => p.id === productId)
    if (existingProd) {
      const nextProd = { ...existingProd }
      if (saveToCatalogTier === 'ecer') {
        nextProd.sellPrice = customPrice
        if (!(Number(existingProd.buyPrice || 0) > 0)) {
          nextProd.buyPrice = Math.round(customPrice * 0.8)
        }
      }
      if (saveToCatalogTier === 'grosir') nextProd.wholesalePrice = customPrice
      if (saveToCatalogTier === 'agen') nextProd.agentPrice = customPrice
      updatedCatalog = await saveProduct(nextProd)
      triggerCloudAutoBackup()
    }
  }

  const nextMode = saveToCatalogTier !== 'none'
    ? 'auto'
    : priceMode

  cart.value = cart.value.map(item => {
    if (item.id !== productId) return item
    const baseProd = updatedCatalog || products.value.find(p => p.id === productId) || item
    return buildPricedCartItem(
      {
        ...item,
        buyPrice: baseProd.buyPrice ?? item.buyPrice,
        baseSellPrice: baseProd.sellPrice ?? item.baseSellPrice,
        wholesalePrice: baseProd.wholesalePrice ?? item.wholesalePrice,
        wholesaleMinQty: baseProd.wholesaleMinQty ?? item.wholesaleMinQty,
        agentPrice: baseProd.agentPrice ?? item.agentPrice,
        priceMode: nextMode,
        customPrice: nextMode === 'manual' ? customPrice : null
      },
      cartPriceTier.value
    )
  })
}

// Product Management (CRUD dengan Dexie.js + sinkronkan item aktif di keranjang)
const handleSaveProduct = async (prodData) => {
  const saved = await saveProduct(prodData)
  if (saved) {
    cart.value = repriceCartItems(cart.value, products.value, cartPriceTier.value)
  }
  triggerCloudAutoBackup()
}

const handleDeleteProduct = (prodId) => requireOwnerAuth(async () => {
  await deleteProduct(prodId)
  cart.value = cart.value.filter(c => c.id !== prodId)
  triggerCloudAutoBackup()
}, 'menghapus barang dari katalog')

const handleDeleteProductsBulk = (prodIds) => requireOwnerAuth(async () => {
  const removedCount = await deleteProductsBulk(prodIds)
  if (removedCount > 0) {
    const idSet = new Set(prodIds)
    cart.value = cart.value.filter(c => !idSet.has(c.id))
    playBeepSound('success')
    triggerCloudAutoBackup()
  }
}, 'menghapus barang secara massal')

const handleAddCategory = async (catName) => {
  const ok = await addCategory(catName)
  if (ok) triggerCloudAutoBackup()
}

const handleDeleteCategory = (catName) => requireOwnerAuth(async () => {
  const res = await deleteCategory(catName)
  if (res?.success) triggerCloudAutoBackup()
}, 'menghapus kategori barang')

// Lazy Inventory Handler (Produk baru langsung tersimpan permanen ke Dexie.js)
const triggerLazyInventory = (rawInput = '') => {
  const clean = String(rawInput || '').trim()
  if (clean && isLikelyBarcode(clean)) {
    scannedBarcode.value = clean
    prefillProductName.value = ''
  } else {
    scannedBarcode.value = ''
    prefillProductName.value = clean
  }
  isLazyInventoryOpen.value = true
}

const saveAndAddToCart = async (newProduct) => {
  const saved = await saveProduct(newProduct)
  addToCart(saved)
  isLazyInventoryOpen.value = false
  triggerCloudAutoBackup()
}

// Helper bersama untuk menyelesaikan pembayaran langsung (Tunai, QRIS, maupun Bayar Kurang Sebagian Bon)
const finalizeDirectSale = async ({ paymentMethod, invoicePrefix, totalAmount, cashGiven, paidAmount, debtAmount, changeAmount, customer }) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `${invoicePrefix}-${Date.now().toString().slice(-6)}`

  let custObj = customer || customers.value.find(c => c.name.toLowerCase() === 'umum') || { name: 'Umum', phone: '', totalDebt: 0 }
  if (custObj && !custObj.id && custObj.name) {
    const existing = customers.value.find(c => c.name.toLowerCase() === custObj.name.trim().toLowerCase())
    if (existing) {
      custObj = existing
    } else {
      custObj = await saveCustomer({
        name: custObj.name.trim(),
        phone: custObj.phone || '',
        totalDebt: 0
      })
    }
  }

  const cleanDebt = Math.max(0, Math.round(Number(debtAmount || 0)))
  const cleanPaid = Number.isFinite(Number(paidAmount)) ? Math.round(Number(paidAmount)) : totalAmount
  const txPayload = {
    invoiceNumber: invoice,
    totalAmount,
    paymentMethod,
    paidAmount: cleanPaid,
    debtAmount: cleanDebt,
    cashGiven,
    changeAmount,
    customer: custObj,
    customerId: custObj?.id || null,
    customerName: custObj?.name || '',
    items: [...cart.value]
  }

  try {
    await recordTransaction(txPayload)
  } catch (err) {
    playBeepSound('warning')
    alert(err.message)
    return
  }
  playBeepSound('success')

  // Catat ke Google Sheets (atau antrean offline) & jadwalkan auto-backup Google Drive
  appendTransactionToSheet(txPayload, storeProfile.value?.name)
  triggerCloudAutoBackup(true)

  openReceiptModal({
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount,
    paymentMethod,
    paidAmount: cleanPaid,
    debtAmount: cleanDebt,
    cashGiven,
    changeAmount,
    customer: custObj,
    items: [...cart.value]
  })
}

// Payment Handlers (Menyimpan riwayat transaksi ke Dexie.js)
const handleProcessCashPayment = async (data) => {
  const debtAmt = Math.max(0, Math.round(Number(data.debtAmount || 0)))
  await finalizeDirectSale({
    paymentMethod: debtAmt > 0 ? 'TUNAI (SEBAGIAN BON)' : 'TUNAI',
    invoicePrefix: 'KSR',
    totalAmount: data.totalAmount,
    cashGiven: data.cashGiven,
    paidAmount: data.paidAmount ?? (debtAmt > 0 ? data.cashGiven : data.totalAmount),
    debtAmount: debtAmt,
    changeAmount: debtAmt > 0 ? 0 : data.changeAmount,
    customer: data.customer
  })
}

const handleProcessQrisPayment = async (data) => {
  const debtAmt = Math.max(0, Math.round(Number(data.debtAmount || 0)))
  const paidAmt = Number.isFinite(Number(data.paidAmount)) ? Math.round(Number(data.paidAmount)) : data.totalAmount
  await finalizeDirectSale({
    paymentMethod: debtAmt > 0 ? 'QRIS (SEBAGIAN BON)' : 'QRIS',
    invoicePrefix: 'QRS',
    totalAmount: data.totalAmount,
    cashGiven: paidAmt,
    paidAmount: paidAmt,
    debtAmount: debtAmt,
    changeAmount: 0,
    customer: data.customer
  })
}

const handleProcessDebtPayment = async (data) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `BON-${Date.now().toString().slice(-6)}`

  let custObj = data.customer
  if (custObj?.name) {
    const cleanName = custObj.name.trim()
    if (cleanName.toLowerCase() === 'umum') return
    const existing = customers.value.find(c => c.name?.toLowerCase() === cleanName.toLowerCase())
    if (existing) {
      custObj = existing
    }
  }

  const txPayload = {
    invoiceNumber: invoice,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: custObj,
    customerId: custObj?.id || null,
    customerName: custObj?.name || '',
    items: [...cart.value]
  }

  await recordTransaction(txPayload)
  playBeepSound('success')

  // Catat ke Google Sheets (atau antrean offline) & jadwalkan auto-backup Google Drive
  appendTransactionToSheet(txPayload, storeProfile.value?.name)
  triggerCloudAutoBackup(true)

  openReceiptModal({
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: custObj,
    items: [...cart.value]
  })
}

// Record Pelunasan Utang (Tersimpan ke Dexie.js + Google Sheets & Auto-Backup)
const handleRecordDebtPayment = async ({ customerId, amount, paymentMethod = 'TUNAI' }) => {
  const res = await recordDebtPayment({ customerId, amount, paymentMethod })
  playBeepSound('success')
  if (res && res.appliedAmount > 0) {
    appendDebtPaymentToSheet({
      customerName: res.customerName,
      amount: res.appliedAmount,
      remainingDebt: res.remainingDebt,
      paymentMethod: res.paymentMethod,
      paymentDate: res.paymentDate
    }, storeProfile.value?.name)
    triggerCloudAutoBackup(true)
  }
}

// Record & Hapus Pengeluaran / Kas Keluar (IndexedDB + Google Sheets & Auto-Backup)
const handleRecordExpense = async (payload) => {
  const saved = await recordExpense(payload)
  if (saved) {
    playBeepSound('success')
    appendExpenseToSheet(saved, storeProfile.value?.name)
    triggerCloudAutoBackup(true)
  }
}

const handleDeleteExpense = (expenseId) => requireOwnerAuth(async () => {
  const target = expenses.value.find(e => e.id === expenseId)
  const ok = await deleteExpense(expenseId)
  if (ok) {
    if (target) {
      appendCancellationToSheet({
        refNumber: target.expenseNumber || String(expenseId),
        actionLabel: 'HAPUS KAS KELUAR',
        detail: `Hapus kas keluar: ${target.note || target.category || '-'}`,
        amount: target.amount || 0
      }, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}, 'menghapus catatan kas keluar')

const handleDeleteTransaction = (tx) => {
  if (!tx?.id) return
  return requireOwnerAuth(async () => {
    const voided = await deleteTransaction(tx.id)
    if (voided) {
      playBeepSound('success')
      appendCancellationToSheet({
        refNumber: voided.invoiceNumber || String(tx.id),
        actionLabel: 'BATAL TRANSAKSI',
        detail: `Void struk ${voided.invoiceNumber || ''} (${voided.paymentMethod || '-'})`,
        amount: -Math.abs(Number(voided.totalAmount || 0))
      }, storeProfile.value?.name)
      triggerCloudAutoBackup(true)
    }
  }, 'membatalkan / menghapus transaksi')
}

const handleOpenReportReceipt = (tx) => {
  if (!tx) return
  const matchedCustomer = tx.customerId
    ? customers.value.find(c => c.id === tx.customerId)
    : null
  receiptData.value = {
    invoiceNumber: tx.invoiceNumber || '-',
    time: tx.createdAt
      ? new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    totalAmount: Number(tx.totalAmount || 0),
    paymentMethod: tx.paymentMethod || 'TUNAI',
    paidAmount: tx.paidAmount ?? tx.cashGiven ?? tx.totalAmount,
    debtAmount: tx.debtAmount || 0,
    cashGiven: tx.cashGiven ?? tx.totalAmount,
    changeAmount: tx.changeAmount || 0,
    customer: tx.customerName
      ? { id: tx.customerId, name: tx.customerName, phone: matchedCustomer?.phone || '' }
      : { id: 1, name: 'Umum', phone: '' },
    items: Array.isArray(tx.items) ? tx.items : []
  }
  isDailyReportOpen.value = false
  isReceiptOpen.value = true
}

// Record & Hapus Nota Kulakan / Belanja Stok (update stok lunak, modal, kas keluar & sync Sheets/Drive)
const handleRecordRestock = async (payload) => {
  const res = await recordRestock(payload)
  if (!res?.restock) return
  playBeepSound('success')

  if (Array.isArray(res.updatedProducts) && res.updatedProducts.length > 0 && cart.value.length > 0) {
    const updatedMap = new Map(res.updatedProducts.map(p => [p.id, p]))
    cart.value = cart.value.map(item => {
      const updated = updatedMap.get(item.id)
      if (!updated) return item
      return buildPricedCartItem(
        {
          ...item,
          buyPrice: updated.buyPrice,
          baseSellPrice: updated.sellPrice,
          stock: updated.stock
        },
        cartPriceTier.value
      )
    })
  }

  if (res.expense) {
    appendExpenseToSheet(res.expense, storeProfile.value?.name)
  }
  appendRestockToSheet(res.restock, storeProfile.value?.name)
  triggerCloudAutoBackup(true)
}

const handleDeleteRestock = (restockId) => requireOwnerAuth(async () => {
  const target = restocks.value.find(r => r.id === restockId)
  const ok = await deleteRestock(restockId)
  if (ok) {
    if (target) {
      appendCancellationToSheet({
        refNumber: target.restockNumber || String(restockId),
        actionLabel: 'HAPUS KULAKAN',
        detail: `Hapus kulakan ${target.supplierName || ''} (rollback stok/kas)`,
        amount: target.totalCost || 0
      }, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}, 'menghapus riwayat kulakan')

const buildCashServiceReceiptData = (svc) => {
  const isTransfer = svc.type === 'TRANSFER'
  const amount = Math.round(Number(svc.amount || 0))
  const adminFee = Math.max(0, Math.round(Number(svc.adminFee || 0)))
  const totalPaid = Number(svc.totalPaid ?? (amount + adminFee))
  const channel = svc.channel || 'QRIS / Transfer'
  const items = [
    {
      id: svc.id,
      name: `${isTransfer ? 'Transfer / Top-Up' : 'Tarik Tunai'} (${channel})`,
      qty: 1,
      sellPrice: amount
    }
  ]
  if (adminFee > 0) {
    items.push({
      id: `${svc.id}-admin`,
      name: 'Biaya Admin Jasa',
      qty: 1,
      sellPrice: adminFee
    })
  }
  return {
    invoiceNumber: svc.serviceNumber || '-',
    time: svc.createdAt
      ? new Date(svc.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    paymentMethod: isTransfer ? 'TRANSFER / TOP-UP' : 'TARIK TUNAI',
    totalAmount: totalPaid,
    cashGiven: isTransfer ? totalPaid : amount,
    changeAmount: 0,
    customer: svc.customerName ? { name: svc.customerName } : null,
    serviceMeta: {
      type: svc.type,
      amount,
      adminFee,
      totalPaid,
      channel
    },
    items
  }
}

// Record & Hapus Layanan Tarik Tunai / Transfer (IndexedDB + Google Sheets + Struk Thermal & Auto-Backup)
const handleRecordCashService = async (payload) => {
  const liveDrawerCash = stats.value.isShiftScoped
    ? Number(stats.value.expectedCashDrawer ?? 0)
    : Number(stats.value.todayNetCashDrawer ?? 0)
  const availableSourceCash = payload?.cashSource === 'KAS'
    ? Number(cumulativePocketBalances.value.kasBalance || 0)
    : liveDrawerCash

  try {
    const saved = await recordCashService({
      ...payload,
      availableDrawerCash: availableSourceCash
    })
    if (saved) {
      playBeepSound('success')
      appendCashServiceToSheet(saved, storeProfile.value?.name)
      triggerCloudAutoBackup(true)
      if (payload?.openReceipt) {
        receiptData.value = buildCashServiceReceiptData(saved)
        isCashServiceOpen.value = false
        isReceiptOpen.value = true
      }
    }
  } catch (err) {
    playBeepSound('warning')
    alert(err.message)
  }
}

const handleDeleteCashService = (serviceId) => requireOwnerAuth(async () => {
  const target = cashServices.value.find(s => s.id === serviceId)
  const ok = await deleteCashService(serviceId)
  if (ok) {
    if (target) {
      appendCancellationToSheet({
        refNumber: target.serviceNumber || String(serviceId),
        actionLabel: 'HAPUS TARIK/TRANSFER',
        detail: `Hapus layanan ${target.type || ''} (${target.channel || '-'})`,
        amount: target.amount || 0
      }, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}, 'menghapus transaksi tarik tunai / transfer')

const handleOpenCashServiceReceipt = (svc) => {
  if (!svc) return
  receiptData.value = buildCashServiceReceiptData(svc)
  isCashServiceOpen.value = false
  isReceiptOpen.value = true
}

// Record & Hapus Mutasi Dana / Tambah Tabungan (IndexedDB + Google Sheets & Auto-Backup)
const handleRecordFundMovement = async (payload) => {
  try {
    const saved = await recordFundMovement(payload)
    if (saved) {
      playBeepSound('success')
      appendFundMovementToSheet(saved, storeProfile.value?.name)
      triggerCloudAutoBackup(true)
    }
  } catch (err) {
    playBeepSound('warning')
    alert(err.message)
  }
}

const handleDeleteFundMovement = (movementId) => requireOwnerAuth(async () => {
  const target = fundMovements.value.find(m => m.id === movementId)
  const ok = await deleteFundMovement(movementId)
  if (ok) {
    if (target) {
      appendCancellationToSheet({
        refNumber: target.movementNumber || String(movementId),
        actionLabel: 'HAPUS MUTASI DANA',
        detail: `Hapus mutasi ${target.fromAccount} -> ${target.toAccount}`,
        amount: target.amount || 0
      }, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}, 'menghapus mutasi keuangan')

const buildDigitalReceiptData = (rec) => {
  const sellPrice = Math.round(Number(rec.sellPrice || 0))
  const matchedCustomer = rec.customerId
    ? customers.value.find(c => c.id === rec.customerId)
    : null
  const itemName = rec.provider && !String(rec.productName || '').toLowerCase().includes(String(rec.provider).toLowerCase())
    ? `${rec.productName} (${rec.provider})`
    : (rec.productName || 'Produk Digital')

  return {
    invoiceNumber: rec.digitalNumber || '-',
    time: rec.createdAt
      ? new Date(rec.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    paymentMethod: rec.paymentMethod || 'TUNAI',
    totalAmount: sellPrice,
    cashGiven: rec.paymentMethod === 'UTANG / BON' ? 0 : sellPrice,
    changeAmount: 0,
    customer: rec.customerName && rec.customerName !== 'Umum'
      ? { id: rec.customerId, name: rec.customerName, phone: matchedCustomer?.phone || '' }
      : { id: 1, name: 'Umum', phone: '' },
    digitalMeta: {
      category: rec.category,
      provider: rec.provider,
      targetNumber: rec.targetNumber || '',
      tokenCode: rec.tokenCode || '',
      nominal: rec.nominal || 0
    },
    items: [
      {
        id: rec.id,
        name: itemName,
        qty: 1,
        sellPrice
      }
    ]
  }
}

// Record, Update Token/SN, & Hapus Penjualan Pulsa/Token (IndexedDB + Sheets + Nota + Cloud)
const handleRecordDigitalProduct = async (payload) => {
  try {
    const saved = await recordDigitalProduct(payload)
    if (saved) {
      playBeepSound('success')
      appendDigitalProductToSheet(saved, storeProfile.value?.name)
      triggerCloudAutoBackup(true)
      if (payload?.openReceipt) {
        receiptData.value = buildDigitalReceiptData(saved)
        isDigitalProductOpen.value = false
        isReceiptOpen.value = true
      }
    }
  } catch (err) {
    playBeepSound('warning')
    alert(err.message)
  }
}

const handleUpdateDigitalTokenCode = async ({ id, tokenCode }) => {
  const updated = await updateDigitalTokenCode(id, tokenCode)
  if (updated) {
    playBeepSound('success')
    appendCancellationToSheet({
      refNumber: updated.digitalNumber || String(id),
      actionLabel: 'UPDATE TOKEN/SN',
      detail: `Token/SN diperbarui: ${updated.tokenCode || '-'}`,
      amount: updated.sellPrice || 0
    }, storeProfile.value?.name)
    triggerCloudAutoBackup(true)
  }
}

const handleDeleteDigitalProduct = (digitalId) => requireOwnerAuth(async () => {
  const target = digitalProducts.value.find(d => d.id === digitalId)
  const ok = await deleteDigitalProduct(digitalId)
  if (ok) {
    if (target) {
      appendCancellationToSheet({
        refNumber: target.digitalNumber || String(digitalId),
        actionLabel: 'HAPUS PULSA/TOKEN',
        detail: `Hapus ${target.productName || 'produk digital'} (${target.paymentMethod || 'TUNAI'})`,
        amount: target.sellPrice || 0
      }, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}, 'menghapus transaksi pulsa / token PLN')

const handleOpenDigitalReceipt = (rec) => {
  if (!rec) return
  receiptData.value = buildDigitalReceiptData(rec)
  isDigitalProductOpen.value = false
  isReceiptOpen.value = true
}

// Buka & Tutup Shift Kasir
const openShiftModalManual = () => {
  completedShiftSummary.value = null
  isShiftAutoPrompt.value = false
  isShiftOpen.value = true
}

const handleDismissShiftPrompt = () => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('kasiry_shift_prompt_dismissed', new Date().toISOString().slice(0, 10))
  }
  isShiftAutoPrompt.value = false
  isShiftOpen.value = false
}

const handleOpenShift = async (payload) => {
  const opened = await openShift(payload)
  if (opened) {
    playBeepSound('success')
    completedShiftSummary.value = null
    isShiftAutoPrompt.value = false
    isShiftOpen.value = false
    appendShiftEventToSheet({ action: 'BUKA SHIFT', shift: opened }, storeProfile.value?.name)
    triggerCloudAutoBackup(true)
  }
}

const handleCloseShift = async (payload) => {
  const closed = await closeShift(payload)
  if (closed) {
    playBeepSound('success')
    isShiftAutoPrompt.value = false
    completedShiftSummary.value = closed
    appendShiftEventToSheet({ action: 'TUTUP SHIFT', shift: closed }, storeProfile.value?.name)
    if (closed.handoverMovement) {
      appendFundMovementToSheet(closed.handoverMovement, storeProfile.value?.name)
    }
    triggerCloudAutoBackup(true)
  }
}

const handleStartNextShift = () => {
  completedShiftSummary.value = null
  isShiftAutoPrompt.value = false
}

// Handler Scan Barcode (Hardware Scanner maupun Kamera)
const handleBarcodeScan = (code) => {
  isCameraOpen.value = false
  const cleanCode = String(code).trim()
  const found = products.value.find(p => p.barcode === cleanCode)
  if (found) {
    playBeepSound('beep')
    addToCart(found)
  } else {
    playBeepSound('warning')
    triggerLazyInventory(cleanCode)
  }
}

// Hardware Barcode Scanner Listener (Global USB/Bluetooth HID listener)
useHardwareScanner({
  onScan: (scannedCode) => {
    if (isAnyModalOpen.value) return
    searchQuery.value = ''
    handleBarcodeScan(scannedCode)
  }
})

// Backup & Restore Handlers (Cadangan Offline JSON)
const handleExportBackup = async () => {
  try {
    await exportBackupJSON()
  } catch (err) {
    alert('Gagal mengekspor data cadangan: ' + err.message)
  }
}

const handleImportBackup = async (payloadOrContent) => {
  const content = typeof payloadOrContent === 'object' && payloadOrContent !== null && 'content' in payloadOrContent
    ? payloadOrContent.content
    : payloadOrContent
  const mode = typeof payloadOrContent === 'object' && payloadOrContent !== null && payloadOrContent.mode
    ? payloadOrContent.mode
    : 'merge'

  const runImport = async () => {
    try {
      const res = await importBackupJSON(content, mode)
      playBeepSound('success')
      triggerCloudAutoBackup()
      alert(
        mode === 'replace'
          ? `Data berhasil diganti penuh dari cadangan (${res.productCount} barang, ${res.customerCount} pelanggan, ${res.transactionCount} transaksi)!`
          : `Berhasil menggabungkan cadangan (${res.productCount} barang & ${res.transactionCount} transaksi)!`
      )
    } catch (err) {
      playBeepSound('warning')
      alert('Gagal memulihkan cadangan: ' + err.message)
    }
  }

  if (mode === 'replace') {
    requireOwnerAuth(runImport, 'menimpa seluruh data toko dari cadangan')
    return
  }
  await runImport()
}

// Profile & Google Actions
const handleUpdateProfile = async (newProfile) => {
  await saveStoreProfile(newProfile)
  playBeepSound('success')
  triggerCloudAutoBackup()
}

const handleConnectGoogle = async () => {
  const res = await connectGoogle()
  if (res.success) {
    playBeepSound('success')
    handleSyncCloud()
  } else if (res.error) {
    alert(res.error)
  }
}

const handleDisconnectGoogle = () => {
  disconnectGoogle()
}

const handleSyncCloud = async () => {
  const localPayload = await getFullDatabasePayload()
  const res = await syncWithCloud(localPayload, async (mergedPayload) => {
    await importBackupJSON(mergedPayload, 'merge', { honorArchiveCutoff: true })
  }, true)

  if (res.success) {
    playBeepSound('success')
    alert('Sinkronisasi cloud berhasil! Data & cadangan Google Drive sudah diperbarui.')
  } else if (res.error) {
    alert('Gagal sinkronisasi: ' + res.error)
  }
}

const handleOpenGoogleSheet = async () => {
  let sheetId = linkedSheetId.value
  if (!sheetId) {
    sheetId = await ensureSpreadsheet(storeProfile.value?.name, true)
  }
  if (sheetId) {
    window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, '_blank')
  } else {
    window.open('https://docs.google.com/spreadsheets/', '_blank')
  }
}

const handleSaveCustomer = async (custData) => {
  await saveCustomer(custData)
  playBeepSound('success')
  triggerCloudAutoBackup()
}

const handleDeleteCustomer = (custId) => requireOwnerAuth(async () => {
  await deleteCustomer(custId)
  triggerCloudAutoBackup()
}, 'menghapus data pelanggan')

const isExportingExcel = ref(false)
const handleDownloadExcel = async () => {
  if (isExportingExcel.value) return
  isExportingExcel.value = true
  try {
    const {
      transactions: allTransactions,
      debtPayments: allDebtPayments,
      expenses: allExpenses,
      restocks: allRestocks,
      cashServices: allCashServices,
      digitalProducts: allDigitalProducts,
      fundMovements: allFundMovements,
      shifts: allShifts
    } = await getAllTransactionsForExport()
    const liveDrawerCash = stats.value.isShiftScoped
      ? Number(stats.value.expectedCashDrawer ?? 0)
      : Number(stats.value.todayNetCashDrawer ?? 0)
    const financeBalances = computeFinanceBalances({
      customers: customers.value,
      liveDrawerBalance: liveDrawerCash,
      precomputedPockets: cumulativePocketBalances.value
    })
    await exportKasiryExcel({
      storeProfile: storeProfile.value,
      stats: stats.value,
      transactions: allTransactions,
      customers: customers.value,
      debtPayments: allDebtPayments,
      expenses: allExpenses,
      restocks: allRestocks,
      cashServices: allCashServices,
      digitalProducts: allDigitalProducts,
      fundMovements: allFundMovements,
      financeBalances,
      shifts: allShifts
    })
    playBeepSound('success')
  } catch (err) {
    alert('Gagal mengekspor file Excel: ' + err.message)
  } finally {
    isExportingExcel.value = false
  }
}

const handleArchiveOldData = (payload) => requireOwnerAuth(async () => {
  const retentionDays = typeof payload === 'object' && payload !== null ? payload.retentionDays : payload
  const onComplete = typeof payload === 'object' && payload !== null ? payload.onComplete : null
  try {
    const res = await archiveOldTransactions(retentionDays)
    if (!res || (res.archivedTxCount === 0 && res.archivedPayCount === 0)) {
      alert('Belum ada transaksi lama yang melebihi batas waktu tersebut.')
      return
    }

    let driveUploaded = false
    if (isGoogleConnected.value && res.archivePayload && res.archiveFilename) {
      if (isOnline.value) {
        const uploaded = await uploadArchiveToDrive(res.archivePayload, res.archiveFilename, false)
        driveUploaded = Boolean(uploaded)
        const freshPayload = await getFullDatabasePayload()
        await pushCleanCloudSnapshot(freshPayload, false)
      } else {
        triggerCloudAutoBackup(false)
      }
    }

    playBeepSound('success')
    alert(
      `Berhasil mengarsipkan ${res.archivedTxCount.toLocaleString('id-ID')} transaksi lama ke file ${res.archiveFilename}` +
      (driveUploaded ? ' & menyimpan salinan ke Google Drive.' : '.') +
      '\nMemori kasir kini lebih ringan; daftar barang & total saldo utang pelanggan tetap 100% aman.'
    )
  } catch (err) {
    playBeepSound('warning')
    alert('Gagal mengarsipkan data lama: ' + err.message)
  } finally {
    if (typeof onComplete === 'function') {
      await onComplete()
    }
  }
}, 'mengarsipkan & memangkas transaksi lama')

const handleResetStoreData = (mode) => requireOwnerAuth(async () => {
  try {
    const res = await resetStoreData({ mode })
    cart.value = []
    cartPriceTier.value = 'ecer'
    activeCartCustomer.value = null
    tierAppliedByCustomer.value = false
    autoEditProductId.value = null
    isSettingsOpen.value = false
    playBeepSound('success')
    alert(
      res.mode === 'empty'
        ? 'Berhasil mengatur ulang ke Toko Kosong (0 barang, akun Umum, dan 0 utang).'
        : `Berhasil memuat ulang ${res.productCount} katalog barang warung siap isi harga.`
    )
    triggerCloudAutoBackup()
  } catch (err) {
    playBeepSound('warning')
    alert('Gagal mengatur ulang data toko: ' + err.message)
  }
}, 'mengatur ulang seluruh data toko')

// Cek apakah perangkat dominan layar sentuh / mobile (jangan paksa virtual keyboard muncul otomatis)
const isTouchViewport = () => {
  if (typeof window === 'undefined') return false
  const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches ||
    window.matchMedia?.('(any-pointer: coarse)')?.matches
  return window.innerWidth < 1024 || isCoarse || (navigator.maxTouchPoints || 0) > 0
}

// Kunci & lepaskan fokus keyboard Kasa pada perangkat sentuh saat melakukan aksi di luar input field
const blurKasaInputs = () => {
  mobileBarcodeRef.value?.blurInput()
  desktopBarcodeRef.value?.blurInput()
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

// Memastikan fokus kursor hanya aktif otomatis pada Desktop non-sentuh, dan menutup keyboard di HP
const ensureKasaFocus = () => {
  nextTick(() => {
    if (isAnyModalOpen.value) return
    if (isTouchViewport()) {
      blurKasaInputs()
    } else {
      mobileBarcodeRef.value?.focusInput()
      desktopBarcodeRef.value?.focusInput()
    }
  })
}

// Shortcut keyboard kasir Desktop (F1 Bantuan, F2 Bayar, F3 Cari, F4 Tier Harga, F8 Kosongkan, +/- Qty item terakhir)
const handleGlobalCheckoutShortcut = (e) => {
  if (e.key === 'F1') {
    e.preventDefault()
    isShortcutHelpOpen.value = !isShortcutHelpOpen.value
    return
  }

  if (e.key === 'Escape' && isShortcutHelpOpen.value) {
    e.preventDefault()
    isShortcutHelpOpen.value = false
    ensureKasaFocus()
    return
  }

  if (isAnyModalOpen.value) return

  if (e.key === 'F2' && cart.value.length > 0) {
    e.preventDefault()
    handleAttemptOpenPayment()
    return
  }

  if (e.key === 'F3') {
    e.preventDefault()
    desktopBarcodeRef.value?.focusInput(true)
    mobileBarcodeRef.value?.focusInput(true)
    return
  }

  if (e.key === 'F4') {
    e.preventDefault()
    const order = ['ecer', 'grosir', 'agen']
    const nextTier = order[(order.indexOf(cartPriceTier.value) + 1) % order.length]
    handleChangeCartPriceTier(nextTier)
    return
  }

  if (e.key === 'F8' && cart.value.length > 0) {
    e.preventDefault()
    if (typeof window !== 'undefined' && window.confirm('Kosongkan seluruh barang di keranjang?')) {
      clearCart()
    }
    return
  }

  const activeEl = typeof document !== 'undefined' ? document.activeElement : null
  const isTypingField = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
  const isEmptySearchInput = isTypingField && searchQuery.value.trim() === '' && activeEl.getAttribute('role') === 'combobox'

  if ((!isTypingField || isEmptySearchInput) && cart.value.length > 0) {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      increaseQty(cart.value[cart.value.length - 1].id)
    } else if (e.key === '-') {
      e.preventDefault()
      decreaseQty(cart.value[cart.value.length - 1].id)
    }
  }
}

// Watch pembukaan/penutupan modal agar keyboard HP tertutup saat modal dibuka & tidak muncul paksa saat ditutup
watch(isAnyModalOpen, (isOpenNow) => {
  if (isOpenNow && isTouchViewport()) {
    blurKasaInputs()
  }
})

const modalFlagKeys = [
  'productManage',
  'customerManage',
  'debtBook',
  'dailyReport',
  'expense',
  'cashService',
  'digitalProduct',
  'finance',
  'restock',
  'shift',
  'settings',
  'camera',
  'lazyInventory',
  'payment',
  'receipt'
]
const activatedModals = reactive({
  productManage: false,
  customerManage: false,
  debtBook: false,
  dailyReport: false,
  expense: false,
  cashService: false,
  digitalProduct: false,
  finance: false,
  restock: false,
  shift: false,
  settings: false,
  camera: false,
  lazyInventory: false,
  payment: false,
  receipt: false
})

watch(
  [
    isProductManageOpen,
    isCustomerManageOpen,
    isDebtBookOpen,
    isDailyReportOpen,
    isExpenseOpen,
    isCashServiceOpen,
    isDigitalProductOpen,
    isFinanceOpen,
    isRestockOpen,
    isShiftOpen,
    isSettingsOpen,
    isCameraOpen,
    isLazyInventoryOpen,
    isPaymentOpen,
    isReceiptOpen
  ],
  (newVals, oldVals) => {
    newVals.forEach((isOpenNow, idx) => {
      if (isOpenNow) {
        activatedModals[modalFlagKeys[idx]] = true
      }
    })
    const wasOpen = oldVals && oldVals.some(v => Boolean(v))
    const isNowAllClosed = newVals.every(v => !v)
    if (wasOpen && isNowAllClosed) {
      if (isTouchViewport()) {
        blurKasaInputs()
      } else {
        setTimeout(ensureKasaFocus, 50)
        setTimeout(ensureKasaFocus, 150)
        setTimeout(ensureKasaFocus, 300)
      }
    }
  }
)

// Klik di area kosong Kasa: di HP menutup keyboard jika terbuka; di Desktop kembalikan fokus input barang
const handleKasaClick = (e) => {
  const target = e.target
  const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]')
  const isModal = target.closest('.fixed.z-50')
  if (!isInteractive && !isModal) {
    if (isTouchViewport()) {
      blurKasaInputs()
    } else {
      ensureKasaFocus()
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalCheckoutShortcut)
  await loadDatabase()

  // Munculkan prompt Buka Shift 1x saat pagi jika belum ada shift aktif (atau ingatkan bila shift kemarin masih terbuka)
  const todayKey = new Date().toISOString().slice(0, 10)
  const dismissedDay = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('kasiry_shift_prompt_dismissed') : null
  if (!isAnyModalOpen.value && (isActiveShiftStale.value || (!activeShift.value && dismissedDay !== todayKey))) {
    completedShiftSummary.value = null
    isShiftAutoPrompt.value = !isActiveShiftStale.value
    isShiftOpen.value = true
  }

  if (!isTouchViewport()) {
    ensureKasaFocus()
    setTimeout(ensureKasaFocus, 200)
    setTimeout(ensureKasaFocus, 500)
  }

  // Hangatkan chunk checkout inti saat browser luang agar transaksi tetap instan 0ms
  const prewarmCheckoutChunks = () => {
    loadPaymentModal().catch(() => {})
    loadLazyInventoryModal().catch(() => {})
    loadReceiptModal().catch(() => {})
  }
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(prewarmCheckoutChunks, { timeout: 2500 })
  } else {
    setTimeout(prewarmCheckoutChunks, 1500)
  }

  // Sambungkan diam-diam printer USB/Serial yang sebelumnya sudah diberi izin browser
  autoReconnectPrinter().catch(() => {})

  // Jika akun Google aktif, kirim antrean tertunda lalu lakukan sinkronisasi otomatis diam-diam
  if (isGoogleConnected.value && isOnline.value) {
    await flushPendingSheetQueue(storeProfile.value?.name)
    const localPayload = await getFullDatabasePayload()
    syncWithCloud(localPayload, async (mergedPayload) => {
      await importBackupJSON(mergedPayload, 'merge', { honorArchiveCutoff: true })
    }, false)
  }

  // Auto-pull ringan antar-perangkat saat tab kembali aktif atau tiap ~3 menit (cek modifiedTime saja)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityAutoSync)
  }
  const jitterMs = Math.floor(Math.random() * 25000)
  cloudAutoPullTimer = setInterval(runBackgroundCloudPull, 180000 + jitterMs)
})

const runBackgroundCloudPull = () => {
  if (!isGoogleConnected.value || !isOnline.value) return
  checkAndPullCloudUpdates(
    getFullDatabasePayload,
    (mergedPayload) => importBackupJSON(mergedPayload, 'merge', { honorArchiveCutoff: true }),
    { minIntervalMs: 20000 }
  ).catch(() => {})
}

const handleVisibilityAutoSync = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    runBackgroundCloudPull()
  }
}

let cloudAutoPullTimer = null

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalCheckoutShortcut)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityAutoSync)
  }
  if (cloudAutoPullTimer) {
    clearInterval(cloudAutoPullTimer)
    cloudAutoPullTimer = null
  }
})
</script>

<template>
  <div
    class="min-h-dvh md:h-dvh md:overflow-hidden flex flex-col antialiased transition-[padding] duration-200"
    :class="cart.length > 0 ? 'pb-40 md:pb-0' : 'pb-24 md:pb-0'"
    @click="handleKasaClick"
  >
    <!-- 1. Top Bar Header (Mobile: Compact Bar | Tablet & Desktop: Glass Command Dock) -->
    <TopBar 
      :storeName="storeProfile.name"
      :isOnline="isOnline"
      :totalDebtCount="unpaidDebtCount"
      :todayTxCount="stats.transactionCount"
      :todayExpenseCount="stats.todayExpenseCount"
      :todayCashServiceCount="stats.todayCashServiceCount"
      :todayDigitalCount="stats.todayDigitalCount"
      :activeShift="activeShift"
      :isActiveShiftStale="isActiveShiftStale"
      :isGoogleConnected="isGoogleConnected"
      :googleUser="googleUser"
      :isOwnerPinEnabled="isOwnerPinEnabled"
      :isOwnerUnlocked="isOwnerUnlocked"
      @openDebtBook="isDebtBookOpen = true"
      @openDailyReport="requireOwnerAuth(() => { isDailyReportOpen = true }, 'melihat Laporan Kasir & Omzet')"
      @openFinance="requireOwnerAuth(() => { isFinanceOpen = true }, 'membuka Manajemen Keuangan & Saldo Toko')"
      @unlockOwner="requireOwnerAuth(() => {}, 'membuka Mode Pemilik')"
      @lockOwner="lockOwnerMode"
      @openExpense="isExpenseOpen = true"
      @openCashService="isCashServiceOpen = true"
      @openDigitalProduct="isDigitalProductOpen = true"
      @openRestock="isRestockOpen = true"
      @openShift="openShiftModalManual"
      @openSettings="isSettingsOpen = true"
      @openCamera="isCameraOpen = true"
      @openProductManage="isProductManageOpen = true"
      @openCustomerManage="isCustomerManageOpen = true"
      @drawerOpened="blurKasaInputs"
      @drawerClosed="ensureKasaFocus"
    />

    <!-- 2. Ergonomic Workspace (Mobile: Scrollable Thumb Zone | Tablet & Desktop: Locked Bento Workstation) -->
    <main class="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-1 pb-2 md:py-2.5 lg:py-3 flex-1 md:min-h-0 flex flex-col">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 md:gap-4 lg:gap-5 items-start md:items-stretch md:flex-1 md:min-h-0">
        
        <!-- BAGIAN 1: STRUK BELANJAAN / REGISTER CHECKOUT -->
        <div class="md:col-span-5 lg:col-span-4 min-w-0 md:h-full md:min-h-0 flex flex-col">
          <CartSection 
            :cartItems="cart"
            :totalAmount="totalCartAmount"
            :totalCount="totalCartCount"
            :cartPriceTier="cartPriceTier"
            :selectedCustomerName="activeCartCustomer?.name || ''"
            :autoEditProductId="autoEditProductId"
            :heldCount="heldCount"
            @clearAutoEdit="autoEditProductId = null"
            @increaseQty="increaseQty"
            @decreaseQty="decreaseQty"
            @removeItem="removeItem"
            @clearCart="clearCart"
            @holdCart="handleHoldCart"
            @openHeldCarts="isHeldCartsModalOpen = true"
            @changePriceTier="handleChangeCartPriceTier"
            @updateItemPrice="handleUpdateItemPrice"
            @openPayment="handleAttemptOpenPayment"
          />
          <HeldCartsModal
            :isOpen="isHeldCartsModalOpen"
            :heldCarts="heldCarts"
            :hasActiveCart="cart.length > 0"
            @close="isHeldCartsModalOpen = false"
            @resume="handleResumeHeldCart"
            @remove="handleRemoveHeldCart"
          />
        </div>

        <!-- BAGIAN 2: KATALOG PRODUK, KATEGORI & PENCARIAN INLINE -->
        <div class="md:col-span-7 lg:col-span-8 min-w-0 md:h-full md:min-h-0 flex flex-col">
          <FrequentProductsSection 
            :frequentProducts="frequentProducts"
            :allProducts="products"
            :categories="categories"
            :cartItems="cart"
            @selectProduct="addToCart"
          >
            <template #search>
              <BarcodeInputBar 
                ref="desktopBarcodeRef"
                variant="inline"
                v-model:searchQuery="searchQuery"
                :searchResults="searchResults"
                :modalOpen="isAnyModalOpen"
                @selectProduct="addToCart"
                @openCamera="isCameraOpen = true"
                @triggerLazyInventory="triggerLazyInventory"
              />
            </template>
          </FrequentProductsSection>
        </div>

      </div>

      <!-- Bar Info Workstation & Tautan Kepatuhan (Tablet & Desktop; Mobile lewat Drawer agar layar HP lega) -->
      <footer class="hidden md:flex shrink-0 pt-2 items-center justify-between gap-3 text-[11px] text-slate-500">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="truncate">
            <strong class="font-semibold text-[#0a193d]/80">Kasiry</strong>
            by
            <a
              href="https://awanbeo.my.id"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-[#0284c7] hover:underline"
            >Awanbeo</a>
            — {{ APP_BRAND_TAGLINE }}
            <span class="ml-1.5 font-mono text-[10px] text-slate-400">v{{ appVersion }}</span>
          </span>
          <span aria-hidden="true" class="hidden lg:inline text-slate-300">•</span>
          <span class="hidden lg:inline text-slate-400">
            Pintasan:
            <button type="button" @click="isShortcutHelpOpen = true" class="px-1 py-0.5 rounded bg-white/80 hover:bg-sky-50 border border-slate-200 font-mono text-[10px] text-[#0a193d] cursor-pointer">F1</button>
            Bantuan •
            <kbd class="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[10px] text-[#0a193d]">/</kbd> / <kbd class="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[10px] text-[#0a193d]">F3</kbd> Cari •
            <kbd class="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[10px] text-[#0a193d]">F2</kbd> Bayar
          </span>
        </div>
        <nav class="flex items-center gap-3 shrink-0" aria-label="Tautan Kepatuhan">
          <a href="/privacy" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2 transition-colors">Kebijakan Privasi</a>
          <span aria-hidden="true" class="text-slate-300">•</span>
          <a href="/terms" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2 transition-colors">Ketentuan Layanan</a>
        </nav>
      </footer>
    </main>

    <!-- 3. Mobile-Only Floating Sticky Bottom Console (Thumb Zone HP) -->
    <div class="md:hidden safe-bottom-dock fixed inset-x-3 z-30 flex flex-col gap-2">
      <BarcodeInputBar 
        ref="mobileBarcodeRef"
        variant="floating"
        v-model:searchQuery="searchQuery"
        :searchResults="searchResults"
        :modalOpen="isAnyModalOpen"
        @selectProduct="addToCart"
        @openCamera="isCameraOpen = true"
        @triggerLazyInventory="triggerLazyInventory"
      />

      <StickyBottomBar 
        :totalAmount="totalCartAmount"
        :itemCount="totalCartCount"
        @openPayment="handleAttemptOpenPayment"
      />
    </div>

    <!-- 4. Modals & Overlays (Dimuat malas / code-split agar booting kasir cepat) -->
    <!-- Modal Kelola Barang (Tambah, Edit, Hapus, Kebersihan Katalog) -->
    <ProductManagementModal 
      v-if="activatedModals.productManage || isProductManageOpen"
      :isOpen="isProductManageOpen"
      :products="products"
      :categories="categories"
      :getProductUsageStats="getAllProductUsageStats"
      @close="isProductManageOpen = false"
      @saveProduct="handleSaveProduct"
      @deleteProduct="handleDeleteProduct"
      @deleteProductsBulk="handleDeleteProductsBulk"
      @addCategory="handleAddCategory"
      @deleteCategory="handleDeleteCategory"
    />

    <!-- Modal Verifikasi PIN / Kata Sandi Pemilik -->
    <OwnerPinModal
      :isOpen="isPinModalOpen"
      :reason="pinModalReason"
      :errorMessage="pinModalError"
      @submit="verifyAndUnlock"
      @cancel="cancelOwnerAuth"
    />

    <!-- Modal Panduan Pintasan Keyboard POS (F1) -->
    <div
      v-if="isShortcutHelpOpen"
      class="fixed inset-0 z-50 bg-[#0a193d]/50 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="isShortcutHelpOpen = false"
    >
      <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-[#0a193d]">Pintasan Keyboard Kasir (POS)</h3>
            <p class="text-xs text-slate-500">Bekerja cepat di kasa tanpa lepas keyboard</p>
          </div>
          <button
            type="button"
            @click="isShortcutHelpOpen = false"
            class="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
          >
            Esc
          </button>
        </div>
        <div class="p-4 space-y-2 text-xs">
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Fokus cari barang / scan</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">/</kbd> atau <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">F3</kbd></span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Pilih hasil pencarian</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">↑</kbd> <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">↓</kbd> + <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Enter</kbd></span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Tambah / kurangi Qty item terakhir</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">+</kbd> / <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">-</kbd></span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Ganti tier harga (Ecer / Grosir / Agen)</span>
            <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border font-mono font-bold text-[#0a193d]">F4</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Kosongkan keranjang</span>
            <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border font-mono font-bold text-[#0a193d]">F8</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Buka Pembayaran</span>
            <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border font-mono font-bold text-[#0a193d]">F2</kbd>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Bayar / Batal di Pembayaran</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Enter</kbd> / <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Esc</kbd></span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600">Di Pembayaran: Tunai / QRIS / Utang &amp; Nominal</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Alt+1/2/3</kbd> · <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">F9</kbd></span>
          </div>
          <div class="flex items-center justify-between py-1.5">
            <span class="text-slate-600">Di Struk: Cetak / Transaksi Baru</span>
            <span class="font-mono font-bold text-[#0a193d]"><kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Enter</kbd> / <kbd class="px-1.5 py-0.5 bg-slate-100 rounded border">Esc</kbd></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Pembayaran (Tunai, QRIS, vs Utang) -->
    <PaymentModal 
      v-if="activatedModals.payment || isPaymentOpen"
      :isOpen="isPaymentOpen"
      :totalAmount="totalCartAmount"
      :cartPriceTier="cartPriceTier"
      :savedCustomers="customers"
      :transactions="transactions"
      @close="isPaymentOpen = false"
      @processCashPayment="handleProcessCashPayment"
      @processQrisPayment="handleProcessQrisPayment"
      @processDebtPayment="handleProcessDebtPayment"
      @saveCustomer="handleSaveCustomer"
      @changeCustomerPriceTier="handleCustomerPriceTierChange"
    />

    <!-- Modal Input Cepat Barcode Baru (Lazy Inventory) -->
    <LazyInventoryModal 
      v-if="activatedModals.lazyInventory || isLazyInventoryOpen"
      :isOpen="isLazyInventoryOpen"
      :scannedBarcode="scannedBarcode"
      :initialName="prefillProductName"
      :categories="categories"
      @close="isLazyInventoryOpen = false"
      @saveAndAddToCart="saveAndAddToCart"
      @addCategory="handleAddCategory"
    />

    <!-- Modal Buku Utang Warung -->
    <DebtBookModal 
      v-if="activatedModals.debtBook || isDebtBookOpen"
      :isOpen="isDebtBookOpen"
      :customers="customers"
      :transactions="transactions"
      :digitalProducts="digitalProducts"
      :storeName="storeProfile.name"
      :fetchCustomerTransactions="getCustomerTransactions"
      @close="isDebtBookOpen = false"
      @recordPayment="handleRecordDebtPayment"
      @addCustomer="handleSaveCustomer"
      @deleteCustomer="handleDeleteCustomer"
      @deleteTransaction="handleDeleteTransaction"
      @deleteDigitalProduct="handleDeleteDigitalProduct"
    />

    <!-- Modal Manajemen Data Pelanggan -->
    <CustomerManagementModal 
      v-if="activatedModals.customerManage || isCustomerManageOpen"
      :isOpen="isCustomerManageOpen"
      :customers="customers"
      :transactions="transactions"
      :digitalProducts="digitalProducts"
      :storeName="storeProfile.name"
      :fetchCustomerTransactions="getCustomerTransactions"
      @close="isCustomerManageOpen = false"
      @saveCustomer="handleSaveCustomer"
      @deleteCustomer="handleDeleteCustomer"
    />

    <!-- Modal Laporan Harian Warung -->
    <DailyReportModal 
      v-if="activatedModals.dailyReport || isDailyReportOpen"
      :isOpen="isDailyReportOpen"
      :stats="stats"
      :transactions="transactions"
      :expenses="expenses"
      :shifts="shifts"
      :activeShift="activeShift"
      :isActiveShiftStale="isActiveShiftStale"
      :storeName="storeProfile.name"
      :isExporting="isExportingExcel"
      @close="isDailyReportOpen = false"
      @downloadExcel="handleDownloadExcel"
      @openExpense="isDailyReportOpen = false; isExpenseOpen = true"
      @openCashService="isDailyReportOpen = false; isCashServiceOpen = true"
      @openDigitalProduct="isDailyReportOpen = false; isDigitalProductOpen = true"
      @openShift="isDailyReportOpen = false; openShiftModalManual()"
      @deleteExpense="handleDeleteExpense"
      @deleteTransaction="handleDeleteTransaction"
      @openReceipt="handleOpenReportReceipt"
    />

    <!-- Modal Catatan Kas Keluar / Pengeluaran Harian -->
    <ExpenseModal
      v-if="activatedModals.expense || isExpenseOpen"
      :isOpen="isExpenseOpen"
      :expenses="expenses"
      :activeShift="activeShift"
      :stats="stats"
      @close="isExpenseOpen = false"
      @recordExpense="handleRecordExpense"
      @deleteExpense="handleDeleteExpense"
    />

    <!-- Modal Layanan Tarik Tunai & Transfer / Top-Up -->
    <CashServiceModal
      v-if="activatedModals.cashService || isCashServiceOpen"
      :isOpen="isCashServiceOpen"
      :cashServices="cashServices"
      :transactions="transactions"
      :debtPayments="debtPayments"
      :expenses="expenses"
      :digitalProducts="digitalProducts"
      :fundMovements="fundMovements"
      :customers="customers"
      :precomputedPockets="cumulativePocketBalances"
      :activeShift="activeShift"
      :stats="stats"
      @close="isCashServiceOpen = false"
      @recordCashService="handleRecordCashService"
      @deleteCashService="handleDeleteCashService"
      @openReceipt="handleOpenCashServiceReceipt"
    />

    <!-- Modal Penjualan Pulsa, Paket Data & Token Listrik PLN -->
    <DigitalProductModal
      v-if="activatedModals.digitalProduct || isDigitalProductOpen"
      :isOpen="isDigitalProductOpen"
      :digitalProducts="digitalProducts"
      :customers="customers"
      :transactions="transactions"
      :debtPayments="debtPayments"
      :expenses="expenses"
      :cashServices="cashServices"
      :fundMovements="fundMovements"
      :precomputedPockets="cumulativePocketBalances"
      :activeShift="activeShift"
      :stats="stats"
      @close="isDigitalProductOpen = false"
      @recordDigitalProduct="handleRecordDigitalProduct"
      @updateTokenCode="handleUpdateDigitalTokenCode"
      @deleteDigitalProduct="handleDeleteDigitalProduct"
      @openReceipt="handleOpenDigitalReceipt"
    />

    <!-- Modal Manajemen Keuangan & Tabungan Terpadu -->
    <FinanceModal
      v-if="activatedModals.finance || isFinanceOpen"
      :isOpen="isFinanceOpen"
      :activeShift="activeShift"
      :stats="stats"
      :transactions="transactions"
      :debtPayments="debtPayments"
      :expenses="expenses"
      :cashServices="cashServices"
      :digitalProducts="digitalProducts"
      :fundMovements="fundMovements"
      :customers="customers"
      :precomputedPockets="cumulativePocketBalances"
      @close="isFinanceOpen = false"
      @recordFundMovement="handleRecordFundMovement"
      @deleteFundMovement="handleDeleteFundMovement"
    />

    <!-- Modal Kulakan / Belanja Stok & Manajemen Stok Lunak -->
    <RestockModal
      v-if="activatedModals.restock || isRestockOpen"
      :isOpen="isRestockOpen"
      :products="products"
      :restocks="restocks"
      :activeShift="activeShift"
      :stats="stats"
      @close="isRestockOpen = false"
      @recordRestock="handleRecordRestock"
      @deleteRestock="handleDeleteRestock"
    />

    <!-- Modal Buka & Tutup Shift (Tutup Buku Harian) -->
    <ShiftModal
      v-if="activatedModals.shift || isShiftOpen"
      :isOpen="isShiftOpen"
      :activeShift="activeShift"
      :completedShift="completedShiftSummary"
      :isActiveShiftStale="isActiveShiftStale"
      :defaultCashierName="storeProfile.owner"
      :lastOpeningCash="lastOpeningCash"
      :unassignedTodayCount="unassignedTodayCount"
      :transactions="transactions"
      :debtPayments="debtPayments"
      :expenses="expenses"
      :cashServices="cashServices"
      :digitalProducts="digitalProducts"
      :fundMovements="fundMovements"
      :storeName="storeProfile.name"
      :isAutoPrompt="isShiftAutoPrompt"
      @close="isShiftOpen = false; completedShiftSummary = null"
      @dismissPrompt="handleDismissShiftPrompt"
      @openShift="handleOpenShift"
      @closeShift="handleCloseShift"
      @startNextShift="handleStartNextShift"
    />

    <!-- Modal Pengaturan & Integrasi Google -->
    <SettingsModal 
      v-if="activatedModals.settings || isSettingsOpen"
      :isOpen="isSettingsOpen"
      :storeProfile="storeProfile"
      :isOnline="isOnline"
      :isGoogleConnected="isGoogleConnected"
      :googleUser="googleUser"
      :lastSyncTime="lastSyncTime"
      :isSyncing="isGoogleSyncing"
      :isConnecting="isGoogleConnecting"
      :lastLocalBackupTime="lastLocalBackupTime"
      :pendingQueueCount="pendingQueueCount"
      :hasPendingDriveBackup="hasPendingDriveBackup"
      :syncStatusMessage="googleSyncStatus"
      :totalTransactionCount="totalTransactionCount"
      :olderTransactionCount="olderTransactionCount"
      :productCount="products.length"
      :customerCount="customers.length"
      :getArchivableSummary="getArchivableSummary"
      @close="isSettingsOpen = false"
      @updateProfile="handleUpdateProfile"
      @connectGoogle="handleConnectGoogle"
      @disconnectGoogle="handleDisconnectGoogle"
      @syncNow="handleSyncCloud"
      @openGoogleSheet="handleOpenGoogleSheet"
      @exportBackup="handleExportBackup"
      @importBackup="handleImportBackup"
      @archiveOldData="handleArchiveOldData"
      @resetStoreData="handleResetStoreData"
    />

    <!-- Modal Struk / Nota Pembayaran Berhasil -->
    <ReceiptModal 
      v-if="activatedModals.receipt || isReceiptOpen"
      :isOpen="isReceiptOpen"
      :receiptData="receiptData"
      :storeProfile="storeProfile"
      @close="isReceiptOpen = false"
      @newTransaction="isReceiptOpen = false"
    />

    <!-- Modal Scanner Kamera Barcode -->
    <CameraScannerModal 
      v-if="activatedModals.camera || isCameraOpen"
      :isOpen="isCameraOpen"
      @close="isCameraOpen = false"
      @scan="handleBarcodeScan"
    />
  </div>
</template>
