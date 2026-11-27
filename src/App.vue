<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, h } from 'vue'
import TopBar from './components/TopBar.vue'
import BarcodeInputBar from './components/BarcodeInputBar.vue'
import CartSection from './components/CartSection.vue'
import FrequentProductsSection from './components/FrequentProductsSection.vue'
import StickyBottomBar from './components/StickyBottomBar.vue'

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
const SettingsModal = lazyModal(() => import('./components/SettingsModal.vue'))
const CameraScannerModal = lazyModal(() => import('./components/CameraScannerModal.vue'))
const ProductManagementModal = lazyModal(() => import('./components/ProductManagementModal.vue'))
const CustomerManagementModal = lazyModal(() => import('./components/CustomerManagementModal.vue'))

import { useKasiryDB } from './composables/useKasiryDB'
import { useHardwareScanner } from './composables/useHardwareScanner'
import { playBeepSound } from './utils/sound'
import { exportKasiryExcel } from './utils/excelExport'
import { computeDailyStats } from './utils/dailyStats'
import { useGoogleSync } from './composables/useGoogleSync'

// Dexie Database Composable (IndexedDB Engine)
const {
  isDbReady,
  products,
  frequentProducts,
  customers,
  transactions,
  debtPayments,
  expenses,
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
  saveCustomer,
  deleteCustomer,
  recordDebtPayment,
  recordExpense,
  deleteExpense,
  recordTransaction,
  saveStoreProfile,
  getFullDatabasePayload,
  getAllTransactionsForExport,
  getCustomerTransactions,
  getArchivableSummary,
  archiveOldTransactions,
  exportBackupJSON,
  importBackupJSON
} = useKasiryDB()

// Google Drive & Sheets Sync Composable ($0 Cloud Multi-Device Engine)
const {
  isConnected: isGoogleConnected,
  userProfile: googleUser,
  lastSyncTime,
  linkedSheetId,
  customClientId,
  pendingQueueCount,
  hasPendingDriveBackup,
  isConnecting: isGoogleConnecting,
  isSyncing: isGoogleSyncing,
  statusMessage: googleSyncStatus,
  connect: connectGoogle,
  disconnect: disconnectGoogle,
  setCustomClientId,
  syncWithCloud,
  uploadArchiveToDrive,
  pushCleanCloudSnapshot,
  scheduleDriveAutoBackup,
  flushPendingSheetQueue,
  appendTransactionToSheet,
  appendDebtPaymentToSheet,
  appendExpenseToSheet,
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

// State Pencarian Barcode / Barang
const searchQuery = ref('')
const scannedBarcode = ref('')
const mobileBarcodeRef = ref(null)
const desktopBarcodeRef = ref(null)

// State Modals
const isPaymentOpen = ref(false)
const isLazyInventoryOpen = ref(false)
const isDebtBookOpen = ref(false)
const isDailyReportOpen = ref(false)
const isExpenseOpen = ref(false)
const isSettingsOpen = ref(false)
const isReceiptOpen = ref(false)
const isCameraOpen = ref(false)
const isProductManageOpen = ref(false)
const isCustomerManageOpen = ref(false)

// State Transaksi Struk
const receiptData = ref(null)

// Status apakah ada modal yang sedang terbuka
const isAnyModalOpen = computed(() => {
  return isProductManageOpen.value ||
    isCustomerManageOpen.value ||
    isDebtBookOpen.value ||
    isDailyReportOpen.value ||
    isExpenseOpen.value ||
    isSettingsOpen.value ||
    isCameraOpen.value ||
    isLazyInventoryOpen.value ||
    isPaymentOpen.value ||
    isReceiptOpen.value
})

// Jumlah pelanggan aktif yang masih memiliki sisa bon (mengecualikan "Umum")
const unpaidDebtCount = computed(() => {
  return customers.value.filter(
    c => c.name?.toLowerCase() !== 'umum' && (c.totalDebt || 0) > 0
  ).length
})

// Computed Laporan Kasir Real-time dari Transaksi, Pelunasan, & Pengeluaran Hari Ini
const stats = computed(() => computeDailyStats(transactions.value, debtPayments.value, expenses.value))

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

// Cart Actions
const addToCart = (product) => {
  const existingIndex = cart.value.findIndex(item => item.id === product.id)
  if (existingIndex > -1) {
    cart.value[existingIndex].qty += 1
  } else {
    cart.value.push({
      ...product,
      qty: 1
    })
  }
  ensureKasaFocus()
}

const increaseQty = (productId) => {
  const item = cart.value.find(i => i.id === productId)
  if (item) item.qty += 1
  if (isTouchViewport()) blurKasaInputs()
}

const decreaseQty = (productId) => {
  const item = cart.value.find(i => i.id === productId)
  if (!item) return
  if (item.qty > 1) {
    item.qty -= 1
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
  ensureKasaFocus()
}

// Product Management (CRUD dengan Dexie.js)
const handleSaveProduct = async (prodData) => {
  await saveProduct(prodData)
  triggerCloudAutoBackup()
}

const handleDeleteProduct = async (prodId) => {
  await deleteProduct(prodId)
  cart.value = cart.value.filter(c => c.id !== prodId)
  triggerCloudAutoBackup()
}

const handleAddCategory = async (catName) => {
  const ok = await addCategory(catName)
  if (ok) triggerCloudAutoBackup()
}

const handleDeleteCategory = async (catName) => {
  const res = await deleteCategory(catName)
  if (res?.success) triggerCloudAutoBackup()
}

// Lazy Inventory Handler (Produk baru langsung tersimpan permanen ke Dexie.js)
const triggerLazyInventory = (barcode) => {
  scannedBarcode.value = barcode
  isLazyInventoryOpen.value = true
}

const saveAndAddToCart = async (newProduct) => {
  const saved = await saveProduct(newProduct)
  addToCart(saved)
  isLazyInventoryOpen.value = false
  triggerCloudAutoBackup()
}

// Helper bersama untuk menyelesaikan pembayaran langsung (Tunai maupun QRIS)
const finalizeDirectSale = async ({ paymentMethod, invoicePrefix, totalAmount, cashGiven, changeAmount, customer }) => {
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

  const txPayload = {
    invoiceNumber: invoice,
    totalAmount,
    paymentMethod,
    cashGiven,
    changeAmount,
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

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount,
    paymentMethod,
    cashGiven,
    changeAmount,
    customer: custObj,
    items: [...cart.value]
  }

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
}

// Payment Handlers (Menyimpan riwayat transaksi ke Dexie.js)
const handleProcessCashPayment = async (data) => {
  await finalizeDirectSale({
    paymentMethod: 'TUNAI',
    invoicePrefix: 'KSR',
    totalAmount: data.totalAmount,
    cashGiven: data.cashGiven,
    changeAmount: data.changeAmount,
    customer: data.customer
  })
}

const handleProcessQrisPayment = async (data) => {
  await finalizeDirectSale({
    paymentMethod: 'QRIS',
    invoicePrefix: 'QRS',
    totalAmount: data.totalAmount,
    cashGiven: data.totalAmount,
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

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: custObj,
    items: [...cart.value]
  }

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
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

const handleDeleteExpense = async (expenseId) => {
  const ok = await deleteExpense(expenseId)
  if (ok) {
    triggerCloudAutoBackup(true)
  }
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
  try {
    const content = typeof payloadOrContent === 'object' && payloadOrContent !== null && 'content' in payloadOrContent
      ? payloadOrContent.content
      : payloadOrContent
    const mode = typeof payloadOrContent === 'object' && payloadOrContent !== null && payloadOrContent.mode
      ? payloadOrContent.mode
      : 'merge'

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

const handleUpdateCustomClientId = (clientId) => {
  setCustomClientId(clientId)
}

const handleSaveCustomer = async (custData) => {
  await saveCustomer(custData)
  playBeepSound('success')
  triggerCloudAutoBackup()
}

const handleDeleteCustomer = async (custId) => {
  await deleteCustomer(custId)
  triggerCloudAutoBackup()
}

const isExportingExcel = ref(false)
const handleDownloadExcel = async () => {
  if (isExportingExcel.value) return
  isExportingExcel.value = true
  try {
    const {
      transactions: allTransactions,
      debtPayments: allDebtPayments,
      expenses: allExpenses
    } = await getAllTransactionsForExport()
    await exportKasiryExcel({
      storeProfile: storeProfile.value,
      stats: stats.value,
      transactions: allTransactions,
      customers: customers.value,
      debtPayments: allDebtPayments,
      expenses: allExpenses
    })
    playBeepSound('success')
  } catch (err) {
    alert('Gagal mengekspor file Excel: ' + err.message)
  } finally {
    isExportingExcel.value = false
  }
}

const handleArchiveOldData = async (payload) => {
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
}

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

// Shortcut keyboard kasir Desktop (F2 langsung buka modal Pembayaran jika keranjang ada isi)
const handleGlobalCheckoutShortcut = (e) => {
  if (e.key === 'F2' && !isAnyModalOpen.value && cart.value.length > 0) {
    e.preventDefault()
    isPaymentOpen.value = true
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

  // Jika akun Google aktif, kirim antrean tertunda lalu lakukan sinkronisasi otomatis diam-diam
  if (isGoogleConnected.value && isOnline.value) {
    await flushPendingSheetQueue(storeProfile.value?.name)
    const localPayload = await getFullDatabasePayload()
    syncWithCloud(localPayload, async (mergedPayload) => {
      await importBackupJSON(mergedPayload, 'merge', { honorArchiveCutoff: true })
    }, false)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalCheckoutShortcut)
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
      :isGoogleConnected="isGoogleConnected"
      :googleUser="googleUser"
      @openDebtBook="isDebtBookOpen = true"
      @openDailyReport="isDailyReportOpen = true"
      @openExpense="isExpenseOpen = true"
      @openSettings="isSettingsOpen = true"
      @openCamera="isCameraOpen = true"
      @openProductManage="isProductManageOpen = true"
      @openCustomerManage="isCustomerManageOpen = true"
      @drawerOpened="blurKasaInputs"
      @drawerClosed="ensureKasaFocus"
    />

    <!-- 2. Ergonomic Workspace (Mobile: Scrollable Thumb Zone | Tablet & Desktop: Locked Bento Workstation) -->
    <main class="w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-1 pb-2 md:py-2.5 lg:py-3 flex-1 md:min-h-0 flex flex-col">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 md:gap-4 lg:gap-5 items-start md:items-stretch md:flex-1 md:min-h-0">
        
        <!-- BAGIAN 1: STRUK BELANJAAN / REGISTER CHECKOUT -->
        <div class="md:col-span-5 lg:col-span-4 min-w-0 md:h-full md:min-h-0 flex flex-col">
          <CartSection 
            :cartItems="cart"
            :totalAmount="totalCartAmount"
            :totalCount="totalCartCount"
            @increaseQty="increaseQty"
            @decreaseQty="decreaseQty"
            @removeItem="removeItem"
            @clearCart="clearCart"
            @openPayment="isPaymentOpen = true"
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

      <!-- Bar Info Workstation & Tautan Kepatuhan (Khusus Desktop agar Mobile & Tablet Bebas Gangguan) -->
      <footer class="hidden lg:flex shrink-0 pt-2.5 items-center justify-between gap-3 text-[11px] text-slate-500">
        <div class="flex items-center gap-3">
          <span><strong class="font-semibold text-[#0a193d]/80">Kasiry</strong> — Kasir Warung &amp; Buku Utang</span>
          <span aria-hidden="true" class="text-slate-300">•</span>
          <span class="text-slate-400">Pintasan: <kbd class="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[10px] text-[#0a193d]">/</kbd> Cari • <kbd class="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[10px] text-[#0a193d]">F2</kbd> Bayar</span>
        </div>
        <nav class="flex items-center gap-3" aria-label="Tautan Kepatuhan">
          <a href="/privacy.html" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2 transition-colors">Kebijakan Privasi</a>
          <span aria-hidden="true" class="text-slate-300">•</span>
          <a href="/terms.html" class="hover:text-[#0284c7] underline decoration-slate-300 underline-offset-2 transition-colors">Ketentuan Layanan</a>
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
        @openPayment="isPaymentOpen = true"
      />
    </div>

    <!-- 4. Modals & Overlays (Dimuat malas / code-split agar booting kasir cepat) -->
    <!-- Modal Kelola Barang (Tambah, Edit, Hapus) -->
    <ProductManagementModal 
      v-if="activatedModals.productManage || isProductManageOpen"
      :isOpen="isProductManageOpen"
      :products="products"
      :categories="categories"
      @close="isProductManageOpen = false"
      @saveProduct="handleSaveProduct"
      @deleteProduct="handleDeleteProduct"
      @addCategory="handleAddCategory"
      @deleteCategory="handleDeleteCategory"
    />

    <!-- Modal Pembayaran (Tunai, QRIS, vs Utang) -->
    <PaymentModal 
      v-if="activatedModals.payment || isPaymentOpen"
      :isOpen="isPaymentOpen"
      :totalAmount="totalCartAmount"
      :savedCustomers="customers"
      :transactions="transactions"
      @close="isPaymentOpen = false"
      @processCashPayment="handleProcessCashPayment"
      @processQrisPayment="handleProcessQrisPayment"
      @processDebtPayment="handleProcessDebtPayment"
      @saveCustomer="handleSaveCustomer"
    />

    <!-- Modal Input Cepat Barcode Baru (Lazy Inventory) -->
    <LazyInventoryModal 
      v-if="activatedModals.lazyInventory || isLazyInventoryOpen"
      :isOpen="isLazyInventoryOpen"
      :scannedBarcode="scannedBarcode"
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
      :storeName="storeProfile.name"
      :fetchCustomerTransactions="getCustomerTransactions"
      @close="isDebtBookOpen = false"
      @recordPayment="handleRecordDebtPayment"
      @addCustomer="handleSaveCustomer"
      @deleteCustomer="handleDeleteCustomer"
    />

    <!-- Modal Manajemen Data Pelanggan -->
    <CustomerManagementModal 
      v-if="activatedModals.customerManage || isCustomerManageOpen"
      :isOpen="isCustomerManageOpen"
      :customers="customers"
      :transactions="transactions"
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
      :storeName="storeProfile.name"
      :isExporting="isExportingExcel"
      @close="isDailyReportOpen = false"
      @downloadExcel="handleDownloadExcel"
      @openExpense="isDailyReportOpen = false; isExpenseOpen = true"
      @deleteExpense="handleDeleteExpense"
    />

    <!-- Modal Catatan Kas Keluar / Pengeluaran Harian -->
    <ExpenseModal
      v-if="activatedModals.expense || isExpenseOpen"
      :isOpen="isExpenseOpen"
      :expenses="expenses"
      :stats="stats"
      @close="isExpenseOpen = false"
      @recordExpense="handleRecordExpense"
      @deleteExpense="handleDeleteExpense"
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
      :customClientId="customClientId"
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
      @updateClientId="handleUpdateCustomClientId"
      @archiveOldData="handleArchiveOldData"
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
