<script setup>
import { ref, computed, onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import BarcodeInputBar from './components/BarcodeInputBar.vue'
import CartSection from './components/CartSection.vue'
import FrequentProductsSection from './components/FrequentProductsSection.vue'
import StickyBottomBar from './components/StickyBottomBar.vue'
import PaymentModal from './components/PaymentModal.vue'
import LazyInventoryModal from './components/LazyInventoryModal.vue'
import DebtBookModal from './components/DebtBookModal.vue'
import DailyReportModal from './components/DailyReportModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import ReceiptModal from './components/ReceiptModal.vue'
import CameraScannerModal from './components/CameraScannerModal.vue'
import ProductManagementModal from './components/ProductManagementModal.vue'

import { useKasiryDB } from './composables/useKasiryDB'
import { useHardwareScanner } from './composables/useHardwareScanner'
import { playBeepSound } from './utils/sound'
import { exportKasiryExcel } from './utils/excelExport'
import { useGoogleSync } from './composables/useGoogleSync'

// Dexie Database Composable (IndexedDB Engine)
const {
  isDbReady,
  products,
  frequentProducts,
  customers,
  transactions,
  debtPayments,
  storeProfile,
  licenseStatus,
  loadDatabase,
  saveProduct,
  deleteProduct,
  saveCustomer,
  deleteCustomer,
  recordDebtPayment,
  recordTransaction,
  saveStoreProfile,
  getFullDatabasePayload,
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
  isConnecting: isGoogleConnecting,
  isSyncing: isGoogleSyncing,
  statusMessage: googleSyncStatus,
  connect: connectGoogle,
  disconnect: disconnectGoogle,
  syncWithCloud,
  appendTransactionToSheet,
  ensureSpreadsheet
} = useGoogleSync()

// State Keranjang Belanja Awal (Mulai Kosong agar Bar Pembayaran Muncul Hanya Saat Ada Barang)
const cart = ref([])

// State Pencarian Barcode / Barang
const searchQuery = ref('')
const scannedBarcode = ref('')
const barcodeInputBarRef = ref(null)

// State Modals
const isPaymentOpen = ref(false)
const isLazyInventoryOpen = ref(false)
const isDebtBookOpen = ref(false)
const isDailyReportOpen = ref(false)
const isSettingsOpen = ref(false)
const isReceiptOpen = ref(false)
const isCameraOpen = ref(false)
const isProductManageOpen = ref(false)

// State Transaksi Struk
const receiptData = ref(null)

// Computed Laporan Kasir Real-time dari Transaksi Hari Ini
const stats = computed(() => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayTimestamp = startOfDay.getTime()

  const todayTx = transactions.value.filter(t => t.createdAt >= todayTimestamp)
  
  let sales = 0
  let profit = 0
  let debt = 0
  const productCountMap = {}

  todayTx.forEach(t => {
    if (t.paymentMethod === 'TUNAI') {
      sales += t.totalAmount
    } else {
      debt += t.totalAmount
    }

    if (t.items) {
      t.items.forEach(item => {
        const itemProfit = (item.sellPrice - (item.buyPrice || item.sellPrice * 0.8)) * item.qty
        profit += itemProfit

        if (!productCountMap[item.name]) {
          productCountMap[item.name] = { name: item.name, qty: 0, subtotal: 0 }
        }
        productCountMap[item.name].qty += item.qty
        productCountMap[item.name].subtotal += item.sellPrice * item.qty
      })
    }
  })

  const todayDebtPaid = debtPayments.value
    .filter(p => p.paymentDate >= todayTimestamp)
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const topProducts = Object.values(productCountMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  return {
    todaySales: sales,
    todayDebtPaid,
    todayProfit: Math.round(profit),
    transactionCount: todayTx.length,
    todayNewDebt: debt,
    topProducts
  }
})

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
  barcodeInputBarRef.value?.focusInput()
}

const increaseQty = (productId) => {
  const item = cart.value.find(i => i.id === productId)
  if (item) item.qty += 1
}

const decreaseQty = (productId) => {
  const item = cart.value.find(i => i.id === productId)
  if (!item) return
  if (item.qty > 1) {
    item.qty -= 1
  } else {
    removeItem(productId)
  }
}

const removeItem = (productId) => {
  cart.value = cart.value.filter(i => i.id !== productId)
}

const clearCart = () => {
  cart.value = []
}

// Product Management (CRUD dengan Dexie.js)
const handleSaveProduct = async (prodData) => {
  await saveProduct(prodData)
}

const handleDeleteProduct = async (prodId) => {
  await deleteProduct(prodId)
  cart.value = cart.value.filter(c => c.id !== prodId)
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
}

// Payment Handlers (Menyimpan riwayat transaksi ke Dexie.js)
const handleProcessCashPayment = async (data) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `KSR-${Date.now().toString().slice(-6)}`

  const txPayload = {
    invoiceNumber: invoice,
    totalAmount: data.totalAmount,
    paymentMethod: 'TUNAI',
    cashGiven: data.cashGiven,
    changeAmount: data.changeAmount,
    items: [...cart.value]
  }

  await recordTransaction(txPayload)
  playBeepSound('success')

  // Catat ke Google Sheets secara asinkron di latar belakang jika terhubung
  appendTransactionToSheet(txPayload)

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'TUNAI',
    cashGiven: data.cashGiven,
    changeAmount: data.changeAmount,
    items: [...cart.value]
  }

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
}

const handleProcessDebtPayment = async (data) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `BON-${Date.now().toString().slice(-6)}`

  const txPayload = {
    invoiceNumber: invoice,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: data.customer,
    items: [...cart.value]
  }

  await recordTransaction(txPayload)
  playBeepSound('success')

  // Catat ke Google Sheets secara asinkron di latar belakang jika terhubung
  appendTransactionToSheet(txPayload)

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: data.customer,
    items: [...cart.value]
  }

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
}

// Record Pelunasan Utang (Tersimpan ke Dexie.js)
const handleRecordDebtPayment = async ({ customerId, amount }) => {
  await recordDebtPayment({ customerId, amount })
  playBeepSound('success')
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

const handleImportBackup = async (content) => {
  try {
    const res = await importBackupJSON(content)
    playBeepSound('success')
    alert(`Berhasil memulihkan ${res.count} data produk & transaksi!`)
  } catch (err) {
    playBeepSound('warning')
    alert('Gagal memulihkan cadangan: ' + err.message)
  }
}

// Profile & Google Actions
const handleUpdateProfile = async (newProfile) => {
  await saveStoreProfile(newProfile)
  playBeepSound('success')
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
    await importBackupJSON(mergedPayload)
  }, false)

  if (res.success) {
    playBeepSound('success')
    alert('Sinkronisasi cloud berhasil! Data antar-perangkat telah cocok.')
  } else if (res.error) {
    alert('Gagal sinkronisasi: ' + res.error)
  }
}

const handleOpenGoogleSheet = async () => {
  let sheetId = linkedSheetId.value
  if (!sheetId) {
    sheetId = await ensureSpreadsheet()
  }
  if (sheetId) {
    window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, '_blank')
  } else {
    window.open('https://docs.google.com/spreadsheets/', '_blank')
  }
}

const handleUpdateCustomClientId = (clientId) => {
  customClientId.value = clientId
  localStorage.setItem('kasiry_custom_client_id', clientId)
}

const handleSaveCustomer = async (custData) => {
  await saveCustomer(custData)
  playBeepSound('success')
}

const handleDeleteCustomer = async (custId) => {
  await deleteCustomer(custId)
}

const handleDownloadExcel = () => {
  try {
    exportKasiryExcel({
      storeProfile: storeProfile.value,
      stats: stats.value,
      transactions: transactions.value,
      customers: customers.value,
      debtPayments: debtPayments.value
    })
    playBeepSound('success')
  } catch (err) {
    alert('Gagal mengekspor file Excel: ' + err.message)
  }
}

const handleActivateLicense = (code) => {
  if (code.toUpperCase().includes('KASIRY') || code.length >= 6) {
    licenseStatus.value.isLifetime = true
    alert('Selamat! Aplikasi Kasiry aktif penuh seumur hidup!')
  } else {
    alert('Kode aktivasi tidak valid.')
  }
}

onMounted(async () => {
  await loadDatabase()
  barcodeInputBarRef.value?.focusInput()
  // Jika akun Google aktif, lakukan sinkronisasi otomatis diam-diam di latar belakang saat buka aplikasi
  if (isGoogleConnected.value) {
    const localPayload = await getFullDatabasePayload()
    syncWithCloud(localPayload, async (mergedPayload) => {
      await importBackupJSON(mergedPayload)
    }, false)
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col antialiased pb-44 sm:pb-48">
    <!-- 1. Top Bar Header -->
    <TopBar 
      :storeName="storeProfile.name"
      :isOnline="true"
      :totalDebtCount="customers.length"
      :isGoogleConnected="isGoogleConnected"
      :googleUser="googleUser"
      @openDebtBook="isDebtBookOpen = true"
      @openDailyReport="isDailyReportOpen = true"
      @openSettings="isSettingsOpen = true"
      @openCamera="isCameraOpen = true"
      @openProductManage="isProductManageOpen = true"
    />

    <!-- 2. Ergonomic Workspace (Keranjang Tetap di Paling Atas) -->
    <main class="w-full max-w-5xl mx-auto px-4 py-2">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        
        <!-- BAGIAN 1: KERANJANG BELANJAAN / STRUK (Paling Atas di Layar) -->
        <div class="lg:col-span-6 xl:col-span-6 flex flex-col gap-3">
          <CartSection 
            :cartItems="cart"
            @increaseQty="increaseQty"
            @decreaseQty="decreaseQty"
            @removeItem="removeItem"
            @clearCart="clearCart"
          />
        </div>

        <!-- BAGIAN 2: BARANG SERING TERJUAL (Tombol Cepat di Bawah Keranjang) -->
        <div class="lg:col-span-6 xl:col-span-6 flex flex-col gap-3">
          <FrequentProductsSection 
            :frequentProducts="frequentProducts"
            @selectProduct="addToCart"
          />
        </div>

      </div>
    </main>

    <!-- 3. Floating Sticky Bottom Console (Input Barcode Sticky Tepat di Atas Total Tagihan) -->
    <div class="fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 max-w-4xl mx-auto z-30 flex flex-col gap-2">
      <!-- Form Input Barcode & Search (Sticky di Atas Total Tagihan, Autofocus, Dropdown Membuka ke Atas) -->
      <BarcodeInputBar 
        ref="barcodeInputBarRef"
        v-model:searchQuery="searchQuery"
        :searchResults="searchResults"
        @selectProduct="addToCart"
        @openCamera="isCameraOpen = true"
        @triggerLazyInventory="triggerLazyInventory"
      />

      <!-- Bar Total Tagihan & Bayar Sekarang (Sticky di Paling Bawah) -->
      <StickyBottomBar 
        :totalAmount="totalCartAmount"
        :itemCount="totalCartCount"
        @openPayment="isPaymentOpen = true"
      />
    </div>

    <!-- 4. Modals & Overlays -->
    <!-- Modal Kelola Barang (Tambah, Edit, Hapus) -->
    <ProductManagementModal 
      :isOpen="isProductManageOpen"
      :products="products"
      @close="isProductManageOpen = false"
      @saveProduct="handleSaveProduct"
      @deleteProduct="handleDeleteProduct"
    />

    <!-- Modal Pembayaran (Tunai vs Utang) -->
    <PaymentModal 
      :isOpen="isPaymentOpen"
      :totalAmount="totalCartAmount"
      :savedCustomers="customers"
      @close="isPaymentOpen = false"
      @processCashPayment="handleProcessCashPayment"
      @processDebtPayment="handleProcessDebtPayment"
    />

    <!-- Modal Input Cepat Barcode Baru (Lazy Inventory) -->
    <LazyInventoryModal 
      :isOpen="isLazyInventoryOpen"
      :scannedBarcode="scannedBarcode"
      @close="isLazyInventoryOpen = false"
      @saveAndAddToCart="saveAndAddToCart"
    />

    <!-- Modal Buku Utang Warung -->
    <DebtBookModal 
      :isOpen="isDebtBookOpen"
      :customers="customers"
      :storeName="storeProfile.name"
      @close="isDebtBookOpen = false"
      @recordPayment="handleRecordDebtPayment"
      @addCustomer="handleSaveCustomer"
      @deleteCustomer="handleDeleteCustomer"
    />

    <!-- Modal Laporan Harian Warung -->
    <DailyReportModal 
      :isOpen="isDailyReportOpen"
      :stats="stats"
      :storeName="storeProfile.name"
      @close="isDailyReportOpen = false"
      @downloadExcel="handleDownloadExcel"
    />

    <!-- Modal Pengaturan & Integrasi Google -->
    <SettingsModal 
      :isOpen="isSettingsOpen"
      :storeProfile="storeProfile"
      :isGoogleConnected="isGoogleConnected"
      :googleUser="googleUser"
      :lastSyncTime="lastSyncTime"
      :isSyncing="isGoogleSyncing"
      :customClientId="customClientId"
      :licenseStatus="licenseStatus"
      @close="isSettingsOpen = false"
      @updateProfile="handleUpdateProfile"
      @connectGoogle="handleConnectGoogle"
      @disconnectGoogle="handleDisconnectGoogle"
      @syncNow="handleSyncCloud"
      @openGoogleSheet="handleOpenGoogleSheet"
      @updateCustomClientId="handleUpdateCustomClientId"
      @exportBackup="handleExportBackup"
      @importBackup="handleImportBackup"
      @activateLicense="handleActivateLicense"
    />

    <!-- Modal Struk / Nota Pembayaran Berhasil -->
    <ReceiptModal 
      :isOpen="isReceiptOpen"
      :receiptData="receiptData"
      :storeProfile="storeProfile"
      @close="isReceiptOpen = false"
      @newTransaction="isReceiptOpen = false"
    />

    <!-- Modal Scanner Kamera Barcode -->
    <CameraScannerModal 
      :isOpen="isCameraOpen"
      @close="isCameraOpen = false"
      @scan="handleBarcodeScan"
      @simulateScan="handleBarcodeScan"
    />
  </div>
</template>
