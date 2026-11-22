<script setup>
import { ref, computed } from 'vue'
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

import { initialProducts, initialCustomers, initialStats } from './data/mockData'

// State Master Data
const products = ref([...initialProducts])
const customers = ref([...initialCustomers])
const stats = ref({ ...initialStats })

// State Profil Toko (Habiba Store)
const storeProfile = ref({
  name: 'Habiba Store',
  owner: 'Habiba',
  phone: '081234567890'
})

// State Keranjang Belanja Awal
const cart = ref([
  { id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, buyPrice: 19500, qty: 1, barcode: '', category: 'Curah' },
  { id: 7, name: 'Indomie Goreng Spesial', sellPrice: 3500, buyPrice: 2900, qty: 2, barcode: '8998866200224', category: 'Makanan' }
])

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

// State Transaksi & Google
const receiptData = ref(null)
const isGoogleConnected = ref(false)
const googleUser = ref(null)
const licenseStatus = ref({
  isLifetime: false,
  txCount: 42,
  txLimit: 300
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

// Computed Frequent Products (Hanya 6–8 Barang Sering Terjual)
const frequentProducts = computed(() => {
  const macros = products.value.filter(p => p.isMacro)
  const pool = macros.length > 0 ? macros : products.value
  return pool.slice(0, 8)
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

// Product Management (CRUD)
const handleSaveProduct = (prodData) => {
  const idx = products.value.findIndex(p => p.id === prodData.id)
  if (idx > -1) {
    products.value[idx] = { ...prodData }
  } else {
    products.value.unshift(prodData)
  }
}

const handleDeleteProduct = (prodId) => {
  products.value = products.value.filter(p => p.id !== prodId)
  cart.value = cart.value.filter(c => c.id !== prodId)
}

// Lazy Inventory Handler
const triggerLazyInventory = (barcode) => {
  scannedBarcode.value = barcode
  isLazyInventoryOpen.value = true
}

const saveAndAddToCart = (newProduct) => {
  products.value.unshift(newProduct)
  addToCart(newProduct)
  isLazyInventoryOpen.value = false
}

// Payment Handlers
const handleProcessCashPayment = (data) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `KSR-${Date.now().toString().slice(-6)}`

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'TUNAI',
    cashGiven: data.cashGiven,
    changeAmount: data.changeAmount,
    items: [...cart.value]
  }

  stats.value.todaySales += data.totalAmount
  stats.value.transactionCount += 1
  licenseStatus.value.txCount += 1

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
}

const handleProcessDebtPayment = (data) => {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const invoice = `BON-${Date.now().toString().slice(-6)}`

  let cust = customers.value.find(c => c.name.toLowerCase() === data.customer.name.toLowerCase())
  if (cust) {
    cust.totalDebt += data.totalAmount
    cust.lastDate = 'Hari ini'
  } else {
    cust = {
      id: Date.now(),
      name: data.customer.name,
      phone: data.customer.phone || '',
      totalDebt: data.totalAmount,
      lastDate: 'Hari ini'
    }
    customers.value.unshift(cust)
  }

  receiptData.value = {
    invoiceNumber: invoice,
    time: timeStr,
    totalAmount: data.totalAmount,
    paymentMethod: 'UTANG / BON',
    customer: cust,
    items: [...cart.value]
  }

  stats.value.todayNewDebt += data.totalAmount
  stats.value.transactionCount += 1
  licenseStatus.value.txCount += 1

  clearCart()
  isPaymentOpen.value = false
  isReceiptOpen.value = true
}

// Record Pelunasan Utang
const handleRecordDebtPayment = ({ customerId, amount }) => {
  const c = customers.value.find(item => item.id === customerId)
  if (c) {
    c.totalDebt = Math.max(0, c.totalDebt - amount)
    c.lastDate = 'Hari ini'
    stats.value.todaySales += amount
  }
}

// Simulasi Scan Kamera
const handleSimulateScan = (code) => {
  isCameraOpen.value = false
  const found = products.value.find(p => p.barcode === code)
  if (found) {
    addToCart(found)
  } else {
    triggerLazyInventory(code)
  }
}

// Profile & Google Actions
const handleUpdateProfile = (newProfile) => {
  storeProfile.value = { ...newProfile }
  alert('Identitas warung berhasil diperbarui!')
}

const handleConnectGoogle = () => {
  isGoogleConnected.value = true
  googleUser.value = {
    name: storeProfile.value.owner || 'Habiba',
    email: 'habiba.store@gmail.com'
  }
  alert('Akun Google berhasil terhubung!')
}

const handleDisconnectGoogle = () => {
  isGoogleConnected.value = false
  googleUser.value = null
}

const handleOpenGoogleSheet = () => {
  window.open('https://docs.google.com/spreadsheets/', '_blank')
}

const handleDownloadExcel = () => {
  alert('Mengunduh file: "Laporan_Habiba_Store.xlsx"')
}

const handleActivateLicense = (code) => {
  if (code.toUpperCase().includes('KASIRY') || code.length >= 6) {
    licenseStatus.value.isLifetime = true
    alert('Selamat! Aplikasi Kasiry aktif penuh seumur hidup!')
  } else {
    alert('Kode aktivasi tidak valid.')
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col antialiased pb-28">
    <!-- 1. Top Bar Header -->
    <TopBar 
      :storeName="storeProfile.name"
      :isOnline="true"
      :totalDebtCount="customers.length"
      @openDebtBook="isDebtBookOpen = true"
      @openDailyReport="isDailyReportOpen = true"
      @openSettings="isSettingsOpen = true"
      @openCamera="isCameraOpen = true"
      @openProductManage="isProductManageOpen = true"
    />

    <!-- 2. Ergonomic Workspace -->
    <main class="w-full max-w-5xl mx-auto px-4 py-3">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        
        <!-- BAGIAN 1: BARANG SERING TERJUAL (Di HP posisinya di atas, di Desktop di Kolom Kiri) -->
        <div class="lg:col-span-6 xl:col-span-7 flex flex-col gap-3">
          <FrequentProductsSection 
            :frequentProducts="frequentProducts"
            @selectProduct="addToCart"
          />
        </div>

        <!-- BAGIAN 2: FORM INPUT BARCODE & KERANJANG (Form Input Mengambang Tepat di Atas Keranjang yang di Bawah) -->
        <div class="lg:col-span-6 xl:col-span-5 flex flex-col gap-3">
          <!-- Form Input Barcode & Search (Autofocus & Mengambang di Atas Keranjang) -->
          <BarcodeInputBar 
            ref="barcodeInputBarRef"
            v-model:searchQuery="searchQuery"
            :searchResults="searchResults"
            @selectProduct="addToCart"
            @openCamera="isCameraOpen = true"
            @triggerLazyInventory="triggerLazyInventory"
          />

          <!-- Keranjang Belanjaan / Struk (Di Bawah Form Input) -->
          <CartSection 
            :cartItems="cart"
            @increaseQty="increaseQty"
            @decreaseQty="decreaseQty"
            @removeItem="removeItem"
            @clearCart="clearCart"
          />
        </div>

      </div>
    </main>

    <!-- 3. Floating Bottom Checkout Bar (Kapsul Melayang) -->
    <StickyBottomBar 
      :totalAmount="totalCartAmount"
      :itemCount="totalCartCount"
      @openPayment="isPaymentOpen = true"
    />

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
      :licenseStatus="licenseStatus"
      @close="isSettingsOpen = false"
      @updateProfile="handleUpdateProfile"
      @connectGoogle="handleConnectGoogle"
      @disconnectGoogle="handleDisconnectGoogle"
      @openGoogleSheet="handleOpenGoogleSheet"
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

    <!-- Modal Scanner Kamera Barcode Simulator -->
    <CameraScannerModal 
      :isOpen="isCameraOpen"
      @close="isCameraOpen = false"
      @simulateScan="handleSimulateScan"
    />
  </div>
</template>
