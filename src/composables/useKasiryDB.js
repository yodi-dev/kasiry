import { ref, computed } from 'vue'
import { db, initDatabase } from '../db/index'

// Helper agar objek/array reaktif Vue (Proxy) selalu dikonversi menjadi plain JS sebelum disimpan ke IndexedDB
const toPlain = (val) => {
  if (val === undefined) return undefined
  return JSON.parse(JSON.stringify(val))
}

// Generator ID numerik unik lintas perangkat & dijamin monotonik walau dipanggil di 1ms yang sama
let lastGeneratedId = 0
const generateUniqueId = () => {
  const candidate = Date.now() * 1000 + Math.floor(Math.random() * 1000)
  lastGeneratedId = candidate > lastGeneratedId ? candidate : lastGeneratedId + 1
  return lastGeneratedId
}

// Shared Reactive State
const isDbReady = ref(false)
const products = ref([])
const customers = ref([])
const transactions = ref([])
const debtPayments = ref([])
const lastLocalBackupTime = ref(
  typeof localStorage !== 'undefined' ? localStorage.getItem('kasiry_last_local_backup') || null : null
)
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
const initialDefaultCategories = ['Sembako', 'Makanan', 'Minuman', 'Kebersihan', 'Rokok', 'Curah', 'Lainnya']
const categoryList = ref([...initialDefaultCategories])

// Gabungan kategori tersimpan + kategori yang ada di barang aktif
const categories = computed(() => {
  const set = new Set([...categoryList.value])
  products.value.forEach(p => {
    if (!p.deleted && p.category && typeof p.category === 'string' && p.category.trim()) {
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

    // 2. Ambil Pelanggan (Buku Utang & Pembeli)
    let allCustomers = await db.customers
      .filter(c => !c.deleted)
      .reverse()
      .toArray()

    // Pastikan pelanggan default "Umum" selalu tersedia
    const hasUmum = allCustomers.some(c => c.name.toLowerCase() === 'umum')
    if (!hasUmum) {
      const existingId1 = await db.customers.get(1)
      await db.customers.add({
        id: existingId1 ? generateUniqueId() : 1,
        name: 'Umum',
        phone: '',
        totalDebt: 0,
        lastDate: 'Hari ini',
        updatedAt: Date.now(),
        deleted: false
      })
      allCustomers = await db.customers
        .filter(c => !c.deleted)
        .reverse()
        .toArray()
    }
    customers.value = allCustomers

    // 3. Ambil seluruh riwayat transaksi terbaru agar rekap & statistik pelanggan selalu akurat
    const recentTx = await db.transactions
      .orderBy('createdAt')
      .reverse()
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

    // 5. Ambil Daftar Kategori
    const catSetting = await db.settings.get('categories')
    if (catSetting && Array.isArray(catSetting.value) && catSetting.value.length > 0) {
      categoryList.value = catSetting.value
    } else {
      categoryList.value = [...initialDefaultCategories]
      await db.settings.put({
        key: 'categories',
        value: toPlain(categoryList.value),
        updatedAt: Date.now()
      })
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
    const payload = toPlain({
      ...productData,
      updatedAt: now,
      deleted: false
    })

    if (payload.id) {
      await db.products.put(payload)
    } else {
      payload.id = generateUniqueId()
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
    const payload = toPlain({
      ...custData,
      updatedAt: now,
      deleted: false
    })

    if (payload.id) {
      await db.customers.put(payload)
    } else {
      const cleanName = (payload.name || '').trim().toLowerCase()
      const existing = cleanName
        ? await db.customers.filter(c => !c.deleted && c.name?.toLowerCase() === cleanName).first()
        : null
      if (existing) {
        existing.phone = payload.phone || existing.phone
        existing.address = payload.address || existing.address
        existing.updatedAt = now
        await db.customers.put(toPlain(existing))
        await refreshAllData()
        return existing
      }
      payload.id = generateUniqueId()
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
    const currentDebt = cust.totalDebt || 0
    // Catat kas masuk hanya sebatas nominal utang yang benar-benar terlunasi (tanpa uang kembalian)
    const appliedAmount = Math.min(amount, currentDebt)
    if (appliedAmount <= 0) return

    const nextDebt = Math.max(0, currentDebt - appliedAmount)
    cust.totalDebt = nextDebt
    cust.lastDate = 'Hari ini'
    cust.updatedAt = now
    await db.customers.put(cust)

    // Catat histori pelunasan sebesar nominal utang yang dibayarkan
    await db.debtPayments.add({
      id: generateUniqueId(),
      customerId,
      amount: appliedAmount,
      paymentDate: now,
      updatedAt: now
    })

    await refreshAllData()
    return {
      appliedAmount,
      remainingDebt: nextDebt,
      customerName: cust.name,
      paymentDate: now
    }
  }

  // Pencatatan Transaksi Baru (Tunai maupun Utang)
  const recordTransaction = async ({ invoiceNumber, totalAmount, paymentMethod, cashGiven, changeAmount, customer, items }) => {
    const now = Date.now()
    
    // 1. Simpan Transaksi Induk dengan ID unik global
    const txId = await db.transactions.add(toPlain({
      id: generateUniqueId(),
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
        buyPrice: item.buyPrice ?? Math.round(item.sellPrice * 0.8),
        qty: item.qty,
        subtotal: item.sellPrice * item.qty
      })),
      updatedAt: now
    }))

    // 2. Jika Metode Utang, akumulasikan saldo utang pelanggan
    if (paymentMethod === 'UTANG / BON' && customer) {
      let cust = customer.id ? await db.customers.get(customer.id) : null
      if (!cust && customer.name) {
        const cleanName = customer.name.trim().toLowerCase()
        cust = await db.customers.filter(c => !c.deleted && c.name?.toLowerCase() === cleanName).first()
      }
      if (cust) {
        cust.totalDebt = (cust.totalDebt || 0) + totalAmount
        cust.lastDate = 'Hari ini'
        cust.updatedAt = now
        await db.customers.put(toPlain(cust))
      } else {
        cust = toPlain({
          id: customer.id || generateUniqueId(),
          name: customer.name,
          phone: customer.phone || '',
          totalDebt: totalAmount,
          lastDate: 'Hari ini',
          updatedAt: now,
          deleted: false
        })
        await db.customers.add(cust)
      }
    }

    // 3. Update counter lisensi
    licenseStatus.value.txCount += 1
    await db.settings.put({
      key: 'licenseStatus',
      value: toPlain(licenseStatus.value),
      updatedAt: now
    })

    await refreshAllData()
    return txId
  }

  // Simpan Profil Toko
  const saveStoreProfile = async (newProfile) => {
    const cleanProfile = toPlain(newProfile)
    storeProfile.value = cleanProfile
    await db.settings.put({
      key: 'storeProfile',
      value: cleanProfile,
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

    return toPlain({
      app: 'Kasiry POS',
      version: '2.4',
      exportedAt: new Date().toISOString(),
      storeProfile: storeProfile.value,
      data: {
        products: allProducts,
        customers: allCustomers,
        transactions: allTransactions,
        debtPayments: allDebtPayments,
        settings: allSettings
      }
    })
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

    const nowIso = new Date().toISOString()
    lastLocalBackupTime.value = nowIso
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kasiry_last_local_backup', nowIso)
    }
    return true
  }

  // Periksa & Ringkas Isi File Cadangan JSON Sebelum Dipulihkan
  const inspectBackupJSON = (jsonStringOrObj) => {
    const payload = typeof jsonStringOrObj === 'string'
      ? JSON.parse(jsonStringOrObj)
      : jsonStringOrObj

    if (!payload || !payload.data) {
      throw new Error('Format file cadangan tidak valid (tidak ada node data).')
    }

    const d = payload.data
    const activeProducts = Array.isArray(d.products) ? d.products.filter(p => !p.deleted) : []
    const activeCustomers = Array.isArray(d.customers) ? d.customers.filter(c => !c.deleted) : []
    const txList = Array.isArray(d.transactions) ? d.transactions : []
    const payList = Array.isArray(d.debtPayments) ? d.debtPayments : []

    return {
      valid: true,
      exportedAt: payload.exportedAt || null,
      storeName: payload.storeProfile?.name || d.settings?.find(s => s.key === 'storeProfile')?.value?.name || 'Toko Kasiry',
      productCount: activeProducts.length,
      customerCount: activeCustomers.length,
      transactionCount: txList.length,
      debtPaymentCount: payList.length,
      payload
    }
  }

  // Impor / Pulihkan Cadangan dari File JSON (mendukung mode 'merge' aman & 'replace' timpa penuh)
  const importBackupJSON = async (jsonStringOrObj, mode = 'merge') => {
    try {
      const payload = typeof jsonStringOrObj === 'string' 
        ? JSON.parse(jsonStringOrObj) 
        : jsonStringOrObj

      if (!payload || !payload.data) {
        throw new Error('Format file cadangan tidak valid (tidak ada node data).')
      }

      const {
        products: inProducts = [],
        customers: inCustomers = [],
        transactions: inTransactions = [],
        debtPayments: inDebtPayments = [],
        settings: inSettings = []
      } = payload.data

      await db.transaction('rw', [db.products, db.customers, db.transactions, db.debtPayments, db.settings], async () => {
        if (mode === 'replace') {
          await db.products.clear()
          await db.customers.clear()
          await db.transactions.clear()
          await db.debtPayments.clear()
          await db.settings.clear()

          if (Array.isArray(inProducts) && inProducts.length > 0) {
            await db.products.bulkPut(toPlain(inProducts))
          }
          if (Array.isArray(inCustomers) && inCustomers.length > 0) {
            await db.customers.bulkPut(toPlain(inCustomers))
          }
          if (Array.isArray(inTransactions) && inTransactions.length > 0) {
            await db.transactions.bulkPut(toPlain(inTransactions))
          }
          if (Array.isArray(inDebtPayments) && inDebtPayments.length > 0) {
            await db.debtPayments.bulkPut(toPlain(inDebtPayments))
          }
          if (Array.isArray(inSettings) && inSettings.length > 0) {
            await db.settings.bulkPut(toPlain(inSettings))
          }
          return
        }

        // MODE MERGE AMAN: bandingkan updatedAt & hindari bentrok primary key lokal (++)
        if (Array.isArray(inProducts) && inProducts.length > 0) {
          const existingProds = await db.products.toArray()
          const prodMap = new Map(existingProds.map(p => [p.id, p]))
          const toPutProds = []
          for (const rp of inProducts) {
            const lp = prodMap.get(rp.id)
            if (!lp || (rp.updatedAt || 0) >= (lp.updatedAt || 0)) {
              toPutProds.push(toPlain(rp))
            }
          }
          if (toPutProds.length > 0) await db.products.bulkPut(toPutProds)
        }

        if (Array.isArray(inCustomers) && inCustomers.length > 0) {
          const existingCusts = await db.customers.toArray()
          const custById = new Map(existingCusts.map(c => [c.id, c]))
          const custByName = new Map(
            existingCusts
              .filter(c => c.name)
              .map(c => [c.name.trim().toLowerCase(), c])
          )
          const toPutCusts = []
          for (const rc of inCustomers) {
            const nameKey = rc.name?.trim().toLowerCase()
            const lc = custById.get(rc.id) || (nameKey ? custByName.get(nameKey) : null)
            if (!lc) {
              toPutCusts.push(toPlain(rc))
            } else if ((rc.updatedAt || 0) >= (lc.updatedAt || 0)) {
              toPutCusts.push(toPlain({ ...rc, id: lc.id }))
            }
          }
          if (toPutCusts.length > 0) await db.customers.bulkPut(toPutCusts)
        }

        if (Array.isArray(inTransactions) && inTransactions.length > 0) {
          const existingTx = await db.transactions.toArray()
          const usedIds = new Set(existingTx.map(t => t.id))
          const existingInvoices = new Set(existingTx.filter(t => t.invoiceNumber).map(t => t.invoiceNumber))
          const toAddTx = []
          for (const rt of inTransactions) {
            if (rt.invoiceNumber && existingInvoices.has(rt.invoiceNumber)) continue
            const cleanTx = toPlain(rt)
            if (!cleanTx.id || usedIds.has(cleanTx.id)) {
              cleanTx.id = generateUniqueId()
            }
            usedIds.add(cleanTx.id)
            if (cleanTx.invoiceNumber) existingInvoices.add(cleanTx.invoiceNumber)
            toAddTx.push(cleanTx)
          }
          if (toAddTx.length > 0) await db.transactions.bulkPut(toAddTx)
        }

        if (Array.isArray(inDebtPayments) && inDebtPayments.length > 0) {
          const existingPays = await db.debtPayments.toArray()
          const usedPayIds = new Set(existingPays.map(p => p.id))
          const existingKeys = new Set(existingPays.map(p => `${p.customerId}_${p.paymentDate}_${p.amount}`))
          const toAddPays = []
          for (const rdp of inDebtPayments) {
            const key = `${rdp.customerId}_${rdp.paymentDate}_${rdp.amount}`
            if (existingKeys.has(key)) continue
            const cleanPay = toPlain(rdp)
            if (!cleanPay.id || usedPayIds.has(cleanPay.id)) {
              cleanPay.id = generateUniqueId()
            }
            usedPayIds.add(cleanPay.id)
            existingKeys.add(key)
            toAddPays.push(cleanPay)
          }
          if (toAddPays.length > 0) await db.debtPayments.bulkPut(toAddPays)
        }

        if (Array.isArray(inSettings) && inSettings.length > 0) {
          const existingSettings = await db.settings.toArray()
          const setMap = new Map(existingSettings.map(s => [s.key, s]))
          const toPutSettings = []
          for (const rs of inSettings) {
            const ls = setMap.get(rs.key)
            if (!ls || (rs.updatedAt || 0) >= (ls.updatedAt || 0)) {
              toPutSettings.push(toPlain(rs))
            }
          }
          if (toPutSettings.length > 0) await db.settings.bulkPut(toPutSettings)
        }
      })

      await refreshAllData()
      return {
        success: true,
        mode,
        count: (inProducts?.length || 0) + (inTransactions?.length || 0),
        productCount: inProducts?.length || 0,
        transactionCount: inTransactions?.length || 0,
        customerCount: inCustomers?.length || 0
      }
    } catch (err) {
      console.error('[Kasiry DB] Gagal memulihkan cadangan:', err)
      throw err
    }
  }

  // Manajemen Kategori
  const addCategory = async (catName) => {
    const trimmed = (catName || '').trim()
    if (!trimmed) return false
    if (!categoryList.value.includes(trimmed)) {
      categoryList.value = [...categoryList.value, trimmed]
      await db.settings.put({
        key: 'categories',
        value: toPlain(categoryList.value),
        updatedAt: Date.now()
      })
    }
    return true
  }

  const deleteCategory = async (catName) => {
    const isUsed = products.value.some(p => !p.deleted && p.category === catName)
    if (isUsed) {
      return { success: false, reason: `Kategori "${catName}" masih digunakan oleh barang.` }
    }

    categoryList.value = categoryList.value.filter(c => c !== catName)
    await db.settings.put({
      key: 'categories',
      value: toPlain(categoryList.value),
      updatedAt: Date.now()
    })
    return { success: true }
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
    categoryList,
    lastLocalBackupTime,
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
    inspectBackupJSON,
    importBackupJSON
  }
}
