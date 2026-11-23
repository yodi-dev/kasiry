import { ref, computed } from 'vue'
import { db, initDatabase } from '../db/index'

// Shared Reactive State
const isDbReady = ref(false)
const products = ref([])
const customers = ref([])
const transactions = ref([])
const debtPayments = ref([])
const storeProfile = ref({
  name: 'Habiba Store',
  owner: 'Habiba',
  phone: '081234567890'
})
const licenseStatus = ref({
  isLifetime: true,
  txCount: 0,
  txLimit: 999999
})

// Kategori Barang
const defaultCategories = ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']
const customCategories = ref([])

// Gabungan kategori bawaan + kategori kustom + kategori yang ada di barang
const categories = computed(() => {
  const set = new Set([...defaultCategories, ...customCategories.value])
  products.value.forEach(p => {
    if (p.category && typeof p.category === 'string' && p.category.trim()) {
      set.add(p.category.trim())
    }
  })
  return Array.from(set)
})

export function useKasiryDB() {
  // Inisialisasi Database & Muat Data
  const loadDatabase = async () => {
    try {
      await initDatabase()
      await refreshAllData()
      isDbReady.value = true
    } catch (err) {
      console.error('[Kasiry DB] Gagal inisialisasi database:', err)
    }
  }

  // Refresh data dari IndexedDB ke Vue reactive state
  const refreshAllData = async () => {
    // 1. Ambil Produk (hanya yang tidak dihapus)
    const allProducts = await db.products
      .filter(p => !p.deleted)
      .reverse()
      .toArray()
    products.value = allProducts

    // 2. Ambil Pelanggan (Buku Utang)
    const allCustomers = await db.customers
      .filter(c => !c.deleted)
      .reverse()
      .toArray()
    customers.value = allCustomers

    // 3. Ambil Transaksi Terakhir (100 transaksi terbaru)
    const recentTx = await db.transactions
      .orderBy('createdAt')
      .reverse()
      .limit(100)
      .toArray()
    transactions.value = recentTx

    // 3b. Ambil Pelunasan Utang
    const recentPayments = await db.debtPayments
      .orderBy('paymentDate')
      .reverse()
      .toArray()
    debtPayments.value = recentPayments

    // 4. Ambil Pengaturan Toko
    const profileSetting = await db.settings.get('storeProfile')
    if (profileSetting && profileSetting.value) {
      storeProfile.value = { ...profileSetting.value }
    }

    const licenseSetting = await db.settings.get('licenseStatus')
    if (licenseSetting && licenseSetting.value) {
      licenseStatus.value = { ...licenseSetting.value }
    }

    // 5. Ambil Kategori Kustom
    const catSetting = await db.settings.get('customCategories')
    if (catSetting && Array.isArray(catSetting.value)) {
      customCategories.value = catSetting.value
    }
  }

  // Computed: 6–8 Barang Sering Terjual (isMacro)
  const frequentProducts = computed(() => {
    const macros = products.value.filter(p => p.isMacro)
    if (macros.length > 0) return macros.slice(0, 8)
    return products.value.slice(0, 8)
  })

  // CRUD Produk
  const saveProduct = async (productData) => {
    const now = Date.now()
    const payload = {
      ...productData,
      updatedAt: now,
      deleted: false
    }

    if (payload.id) {
      await db.products.put(payload)
    } else {
      payload.id = now
      await db.products.add(payload)
    }

    await refreshAllData()
    return payload
  }

  const deleteProduct = async (productId) => {
    // Soft delete agar perubahan bisa tersinkronisasi antar-device
    const prod = await db.products.get(productId)
    if (prod) {
      prod.deleted = true
      prod.updatedAt = Date.now()
      await db.products.put(prod)
      await refreshAllData()
    }
  }

  // CRUD Pelanggan (Buku Utang)
  const saveCustomer = async (custData) => {
    const now = Date.now()
    const payload = {
      ...custData,
      updatedAt: now,
      deleted: false
    }

    if (payload.id) {
      await db.customers.put(payload)
    } else {
      payload.id = now
      payload.totalDebt = payload.totalDebt || 0
      payload.lastDate = 'Hari ini'
      await db.customers.add(payload)
    }

    await refreshAllData()
    return payload
  }

  const deleteCustomer = async (customerId) => {
    const cust = await db.customers.get(customerId)
    if (cust) {
      cust.deleted = true
      cust.updatedAt = Date.now()
      await db.customers.put(cust)
      await refreshAllData()
    }
  }

  // Pelunasan / Cicilan Utang
  const recordDebtPayment = async ({ customerId, amount }) => {
    const cust = await db.customers.get(customerId)
    if (!cust) return

    const now = Date.now()
    const newDebt = Math.max(0, (cust.totalDebt || 0) - amount)
    cust.totalDebt = newDebt
    cust.lastDate = 'Hari ini'
    cust.updatedAt = now
    await db.customers.put(cust)

    // Catat histori pelunasan
    await db.debtPayments.add({
      customerId,
      amount,
      paymentDate: now,
      updatedAt: now
    })

    await refreshAllData()
  }

  // Pencatatan Transaksi Baru (Tunai maupun Utang)
  const recordTransaction = async ({ invoiceNumber, totalAmount, paymentMethod, cashGiven, changeAmount, customer, items }) => {
    const now = Date.now()
    
    // 1. Simpan Transaksi Induk
    const txId = await db.transactions.add({
      invoiceNumber,
      createdAt: now,
      totalAmount,
      paymentMethod,
      cashGiven: cashGiven || totalAmount,
      changeAmount: changeAmount || 0,
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : null,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        sellPrice: item.sellPrice,
        buyPrice: item.buyPrice || Math.round(item.sellPrice * 0.8),
        qty: item.qty,
        subtotal: item.sellPrice * item.qty
      })),
      updatedAt: now
    })

    // 2. Jika Metode Utang, akumulasikan saldo utang pelanggan
    if (paymentMethod === 'UTANG / BON' && customer) {
      let cust = await db.customers.get(customer.id)
      if (cust) {
        cust.totalDebt = (cust.totalDebt || 0) + totalAmount
        cust.lastDate = 'Hari ini'
        cust.updatedAt = now
        await db.customers.put(cust)
      } else {
        cust = {
          id: customer.id || now,
          name: customer.name,
          phone: customer.phone || '',
          totalDebt: totalAmount,
          lastDate: 'Hari ini',
          updatedAt: now,
          deleted: false
        }
        await db.customers.add(cust)
      }
    }

    // 3. Update counter lisensi
    licenseStatus.value.txCount += 1
    await db.settings.put({
      key: 'licenseStatus',
      value: licenseStatus.value,
      updatedAt: now
    })

    await refreshAllData()
    return txId
  }

  // Simpan Profil Toko
  const saveStoreProfile = async (newProfile) => {
    storeProfile.value = { ...newProfile }
    await db.settings.put({
      key: 'storeProfile',
      value: storeProfile.value,
      updatedAt: Date.now()
    })
  }

  // Dapatkan seluruh data database untuk sinkronisasi cloud
  const getFullDatabasePayload = async () => {
    const allProducts = await db.products.toArray()
    const allCustomers = await db.customers.toArray()
    const allTransactions = await db.transactions.toArray()
    const allDebtPayments = await db.debtPayments.toArray()
    const allSettings = await db.settings.toArray()

    return {
      app: 'Kasiry POS',
      version: '2.2',
      exportedAt: new Date().toISOString(),
      storeProfile: storeProfile.value,
      data: {
        products: allProducts,
        customers: allCustomers,
        transactions: allTransactions,
        debtPayments: allDebtPayments,
        settings: allSettings
      }
    }
  }

  // Ekspor Cadangan ke File JSON
  const exportBackupJSON = async () => {
    const backupData = await getFullDatabasePayload()

    const jsonString = JSON.stringify(backupData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    const safeStoreName = (storeProfile.value.name || 'Kasiry').replace(/\s+/g, '_')
    a.href = url
    a.download = `Backup_${safeStoreName}_${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }

  // Impor / Pulihkan Cadangan dari File JSON
  const importBackupJSON = async (jsonStringOrObj) => {
    try {
      const payload = typeof jsonStringOrObj === 'string' 
        ? JSON.parse(jsonStringOrObj) 
        : jsonStringOrObj

      if (!payload || !payload.data) {
        throw new Error('Format file cadangan tidak valid (tidak ada node data).')
      }

      const { products: inProducts, customers: inCustomers, transactions: inTransactions, debtPayments: inDebtPayments, settings: inSettings } = payload.data

      // Gunakan Dexie transaction untuk atomic import
      await db.transaction('rw', [db.products, db.customers, db.transactions, db.debtPayments, db.settings], async () => {
        if (Array.isArray(inProducts) && inProducts.length > 0) {
          await db.products.bulkPut(inProducts)
        }
        if (Array.isArray(inCustomers) && inCustomers.length > 0) {
          await db.customers.bulkPut(inCustomers)
        }
        if (Array.isArray(inTransactions) && inTransactions.length > 0) {
          await db.transactions.bulkPut(inTransactions)
        }
        if (Array.isArray(inDebtPayments) && inDebtPayments.length > 0) {
          await db.debtPayments.bulkPut(inDebtPayments)
        }
        if (Array.isArray(inSettings) && inSettings.length > 0) {
          await db.settings.bulkPut(inSettings)
        }
      })

      await refreshAllData()
      return { success: true, count: (inProducts?.length || 0) + (inTransactions?.length || 0) }
    } catch (err) {
      console.error('[Kasiry DB] Gagal memulihkan cadangan:', err)
      throw err
    }
  }

  // Manajemen Kategori
  const addCategory = async (catName) => {
    const trimmed = (catName || '').trim()
    if (!trimmed) return false
    if (!customCategories.value.includes(trimmed)) {
      customCategories.value = [...customCategories.value, trimmed]
      await db.settings.put({
        key: 'customCategories',
        value: customCategories.value,
        updatedAt: Date.now()
      })
    }
    return true
  }

  const deleteCategory = async (catName) => {
    customCategories.value = customCategories.value.filter(c => c !== catName)
    await db.settings.put({
      key: 'customCategories',
      value: customCategories.value,
      updatedAt: Date.now()
    })
    return true
  }

  return {
    isDbReady,
    products,
    frequentProducts,
    customers,
    transactions,
    debtPayments,
    storeProfile,
    licenseStatus,
    categories,
    customCategories,
    defaultCategories,
    addCategory,
    deleteCategory,
    loadDatabase,
    refreshAllData,
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
  }
}
