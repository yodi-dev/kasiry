import { ref, shallowRef, computed } from 'vue'
import { db, initDatabase } from '../db/index'

// Helper agar objek/array reaktif Vue (Proxy) selalu dikonversi menjadi plain JS sebelum disimpan ke IndexedDB
const toPlain = (val) => {
  if (val === undefined) return undefined
  return JSON.parse(JSON.stringify(val))
}

// Batas hari riwayat aktif yang dipertahankan di RAM Vue (data lebih lama tetap aman di IndexedDB)
const ACTIVE_HISTORY_DAYS = 90
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Generator ID numerik unik lintas perangkat & dijamin monotonik walau dipanggil di 1ms yang sama
let lastGeneratedId = 0
const generateUniqueId = () => {
  const candidate = Date.now() * 1000 + Math.floor(Math.random() * 1000)
  lastGeneratedId = candidate > lastGeneratedId ? candidate : lastGeneratedId + 1
  return lastGeneratedId
}

// Shared Reactive State (shallowRef untuk daftar besar agar bebas beban deep Proxy Vue)
const isDbReady = ref(false)
const products = shallowRef([])
const customers = ref([])
const transactions = shallowRef([])
const debtPayments = shallowRef([])
const totalTransactionCount = ref(0)
const totalDebtPaymentCount = ref(0)
const archiveCutoffAt = ref(0)
const olderTransactionCount = computed(() =>
  Math.max(0, totalTransactionCount.value - transactions.value.length)
)
const lastLocalBackupTime = ref(
  typeof localStorage !== 'undefined' ? localStorage.getItem('kasiry_last_local_backup') || null : null
)
const storeProfile = ref({
  name: 'Habiba Store',
  owner: 'Habiba',
  phone: '081234567890'
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

  // Query parsial: hanya muat tabel yang berubah (hindari membaca puluhan ribu transaksi berulang kali)
  const refreshProducts = async () => {
    products.value = await db.products
      .filter(p => !p.deleted)
      .reverse()
      .toArray()
  }

  const refreshCustomers = async () => {
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
  }

  const refreshRecentTransactions = async () => {
    const windowCutoff = Date.now() - ACTIVE_HISTORY_DAYS * MS_PER_DAY
    const [recentTx, recentPays, txCount, payCount] = await Promise.all([
      db.transactions.where('createdAt').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.debtPayments.where('paymentDate').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.transactions.count(),
      db.debtPayments.count()
    ])
    transactions.value = recentTx
    debtPayments.value = recentPays
    totalTransactionCount.value = txCount
    totalDebtPaymentCount.value = payCount
  }

  const refreshSettings = async () => {
    const [profileSetting, catSetting, archiveSetting] = await Promise.all([
      db.settings.get('storeProfile'),
      db.settings.get('categories'),
      db.settings.get('archiveState')
    ])

    if (profileSetting && profileSetting.value) {
      storeProfile.value = { ...profileSetting.value }
    }

    archiveCutoffAt.value = Number(archiveSetting?.value?.cutoffAt || 0)

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

  // Refresh penuh secara paralel (hanya saat startup & pemulihan cadangan)
  const refreshAllData = async () => {
    await Promise.all([
      refreshProducts(),
      refreshCustomers(),
      refreshRecentTransactions(),
      refreshSettings()
    ])
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

    await refreshProducts()
    return payload
  }

  const deleteProduct = async (productId) => {
    // Soft delete agar perubahan bisa tersinkronisasi antar-device
    const prod = await db.products.get(productId)
    if (prod) {
      prod.deleted = true
      prod.updatedAt = Date.now()
      await db.products.put(prod)
      await refreshProducts()
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
        await refreshCustomers()
        return existing
      }
      payload.id = generateUniqueId()
      payload.totalDebt = payload.totalDebt || 0
      payload.lastDate = 'Hari ini'
      await db.customers.add(payload)
    }

    await refreshCustomers()
    return payload
  }

  const deleteCustomer = async (customerId) => {
    const cust = await db.customers.get(customerId)
    if (cust) {
      cust.deleted = true
      cust.updatedAt = Date.now()
      await db.customers.put(cust)
      await refreshCustomers()
    }
  }

  // Pelunasan / Cicilan Utang (update inkremental tanpa membaca ulang seluruh riwayat transaksi)
  const recordDebtPayment = async ({ customerId, amount }) => {
    const cust = await db.customers.get(customerId)
    if (!cust) return

    const now = Date.now()
    const currentDebt = cust.totalDebt || 0
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return

    // Catat kas masuk hanya sebatas nominal utang yang benar-benar terlunasi (tanpa uang kembalian)
    const appliedAmount = Math.min(numericAmount, currentDebt)
    if (appliedAmount <= 0) return

    const nextDebt = Math.max(0, currentDebt - appliedAmount)
    cust.totalDebt = nextDebt
    cust.lastDate = 'Hari ini'
    cust.updatedAt = now
    await db.customers.put(cust)

    // Catat histori pelunasan sebesar nominal utang yang dibayarkan
    const paymentRecord = toPlain({
      id: generateUniqueId(),
      customerId,
      amount: appliedAmount,
      paymentDate: now,
      updatedAt: now
    })
    await db.debtPayments.add(paymentRecord)

    debtPayments.value = [paymentRecord, ...debtPayments.value]
    totalDebtPaymentCount.value += 1
    await refreshCustomers()
    return {
      appliedAmount,
      remainingDebt: nextDebt,
      customerName: cust.name,
      paymentDate: now
    }
  }

  // Pencatatan Transaksi Baru (update state inkremental agar checkout selalu instan <5ms)
  const recordTransaction = async ({ invoiceNumber, totalAmount, paymentMethod, cashGiven, changeAmount, customer, items }) => {
    const now = Date.now()
    const txRecord = toPlain({
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
    })

    // 1. Simpan Transaksi Induk ke IndexedDB
    const txId = await db.transactions.add(txRecord)

    // 2. Jika Metode Utang, akumulasikan saldo utang pelanggan (kecuali akun sistem "Umum")
    let customerMutated = false
    if (paymentMethod === 'UTANG / BON' && customer && customer.name?.trim().toLowerCase() !== 'umum') {
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
      customerMutated = true
    }

    // 3. Perbarui shallowRef & counter lokal langsung tanpa full reload 5 tabel
    transactions.value = [txRecord, ...transactions.value]
    totalTransactionCount.value += 1
    if (customerMutated) {
      await refreshCustomers()
    }
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

  // Ekspor Cadangan ke File JSON (otomatis compact bila transaksi besar agar hemat memori)
  const exportBackupJSON = async () => {
    const backupData = await getFullDatabasePayload()
    const txLen = backupData?.data?.transactions?.length || 0
    const jsonString = txLen >= 500 ? JSON.stringify(backupData) : JSON.stringify(backupData, null, 2)
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

  // Ambil seluruh transaksi & pelunasan dari IndexedDB on-demand (khusus ekspor Excel lengkap)
  const getAllTransactionsForExport = async () => {
    const [allTransactions, allDebtPayments] = await Promise.all([
      db.transactions.orderBy('createdAt').reverse().toArray(),
      db.debtPayments.orderBy('paymentDate').reverse().toArray()
    ])
    return {
      transactions: allTransactions,
      debtPayments: allDebtPayments
    }
  }

  // Ambil riwayat lengkap 1 pelanggan dari IndexedDB memakai indeks customerId (O(log N + K))
  const getCustomerTransactions = async (customerId, customerName = '') => {
    const mapByKey = new Map()
    const cleanTargetName = (customerName || '').trim().toLowerCase()

    if (customerId !== null && customerId !== undefined && customerId !== '') {
      const byIndex = await db.transactions.where('customerId').equals(customerId).toArray()
      byIndex.forEach(t => mapByKey.set(t.invoiceNumber || t.id, t))
    }

    if (cleanTargetName) {
      const byNameLegacy = await db.transactions
        .filter(t => {
          const tName = (t.customerName || t.customer?.name || '').trim().toLowerCase()
          return tName === cleanTargetName
        })
        .toArray()
      byNameLegacy.forEach(t => {
        const key = t.invoiceNumber || t.id
        if (!mapByKey.has(key)) mapByKey.set(key, t)
      })
    }

    return Array.from(mapByKey.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  // Hitung jumlah riwayat yang memenuhi syarat arsip (lebih tua dari retentionDays) tanpa memuat payload penuh
  const getArchivableSummary = async (retentionDays = 180) => {
    const cutoffTimestamp = Date.now() - retentionDays * MS_PER_DAY
    const [txCount, payCount] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).count(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).count()
    ])
    return {
      retentionDays,
      cutoffTimestamp,
      txCount,
      payCount
    }
  }

  // Arsipkan & pangkas transaksi lama ke file JSON (+ siapkan payload untuk arsip Drive) tanpa menyentuh utang/barang/pelanggan
  const archiveOldTransactions = async (retentionDays = 180) => {
    const cutoffTimestamp = Date.now() - retentionDays * MS_PER_DAY
    const [oldTx, oldPays] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).toArray(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).toArray()
    ])

    if (oldTx.length === 0 && oldPays.length === 0) {
      return {
        archivedTxCount: 0,
        archivedPayCount: 0,
        cutoffTimestamp,
        archiveFilename: null,
        archivePayload: null
      }
    }

    const cutoffDateStr = new Date(cutoffTimestamp).toISOString().slice(0, 10)
    const safeStoreName = (storeProfile.value.name || 'Kasiry').replace(/\s+/g, '_')
    const archiveFilename = `Arsip_${safeStoreName}_sd_${cutoffDateStr}.json`
    const archivePayload = toPlain({
      app: 'Kasiry POS Archive',
      version: '1.0',
      archivedAt: new Date().toISOString(),
      cutoffTimestamp,
      retentionDays,
      storeProfile: storeProfile.value,
      data: {
        transactions: oldTx,
        debtPayments: oldPays
      }
    })

    // Unduh file arsip JSON otomatis ke perangkat sebelum memangkas IndexedDB
    const jsonString = JSON.stringify(archivePayload)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = archiveFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const nextCutoff = Math.max(archiveCutoffAt.value || 0, cutoffTimestamp)
    await db.transaction('rw', [db.transactions, db.debtPayments, db.settings], async () => {
      await db.transactions.where('createdAt').below(cutoffTimestamp).delete()
      await db.debtPayments.where('paymentDate').below(cutoffTimestamp).delete()
      await db.settings.put({
        key: 'archiveState',
        value: { cutoffAt: nextCutoff },
        updatedAt: Date.now()
      })
    })

    archiveCutoffAt.value = nextCutoff
    await refreshRecentTransactions()

    return {
      archivedTxCount: oldTx.length,
      archivedPayCount: oldPays.length,
      cutoffTimestamp,
      archiveFilename,
      archivePayload
    }
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
  const importBackupJSON = async (jsonStringOrObj, mode = 'merge', options = {}) => {
    const { honorArchiveCutoff = false } = options
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

        const incomingArchiveSetting = Array.isArray(inSettings)
          ? inSettings.find(s => s.key === 'archiveState')
          : null
        const effectiveCutoff = honorArchiveCutoff
          ? Math.max(archiveCutoffAt.value || 0, incomingArchiveSetting?.value?.cutoffAt || 0)
          : 0

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
            if (effectiveCutoff > 0 && (rt.createdAt || 0) < effectiveCutoff) continue
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
            if (effectiveCutoff > 0 && (rdp.paymentDate || 0) < effectiveCutoff) continue
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
    totalTransactionCount,
    totalDebtPaymentCount,
    olderTransactionCount,
    archiveCutoffAt,
    storeProfile,
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
    getAllTransactionsForExport,
    getCustomerTransactions,
    getArchivableSummary,
    archiveOldTransactions,
    exportBackupJSON,
    inspectBackupJSON,
    importBackupJSON
  }
}
