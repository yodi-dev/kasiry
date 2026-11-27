import { ref, shallowRef, computed } from 'vue'
import { db, initDatabase } from '../db/index'
import { computeShiftClosingPreview } from '../utils/dailyStats'
import { normalizePriceTier, sanitizeOptionalPrice, sanitizeMinQty } from '../utils/pricing'

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
const expenses = shallowRef([])
const shifts = shallowRef([])
const lastOpeningCash = ref(0)
const totalTransactionCount = ref(0)
const totalDebtPaymentCount = ref(0)
const totalExpenseCount = ref(0)
const totalShiftCount = ref(0)
const archiveCutoffAt = ref(0)
const olderTransactionCount = computed(() =>
  Math.max(0, totalTransactionCount.value - transactions.value.length)
)

const activeShift = computed(() =>
  shifts.value.find(s => !s.deleted && s.status === 'OPEN') || null
)

const isActiveShiftStale = computed(() => {
  if (!activeShift.value) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return Number(activeShift.value.openedAt || 0) < startOfToday.getTime()
})

const unassignedTodayCount = computed(() => {
  if (activeShift.value) return 0
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayTs = startOfToday.getTime()
  const unassignedTx = transactions.value.filter(
    t => (t?.createdAt || 0) >= todayTs && !t.shiftId && !t.shiftCode
  ).length
  const unassignedPays = debtPayments.value.filter(
    p => (p?.paymentDate || 0) >= todayTs && !p.shiftId && !p.shiftCode
  ).length
  const unassignedExps = expenses.value.filter(
    e => !e?.deleted && (e?.createdAt || 0) >= todayTs && !e.shiftId && !e.shiftCode
  ).length
  return unassignedTx + unassignedPays + unassignedExps
})
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
    const [recentTx, recentPays, recentExpenses, recentShifts, openShifts, txCount, payCount, expCount, shiftCount] = await Promise.all([
      db.transactions.where('createdAt').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.debtPayments.where('paymentDate').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.expenses.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(e => !e.deleted).toArray(),
      db.shifts.where('openedAt').aboveOrEqual(windowCutoff).reverse().filter(s => !s.deleted).toArray(),
      db.shifts.where('status').equals('OPEN').filter(s => !s.deleted).toArray(),
      db.transactions.count(),
      db.debtPayments.count(),
      db.expenses.filter(e => !e.deleted).count(),
      db.shifts.filter(s => !s.deleted).count()
    ])

    const shiftMap = new Map()
    ;[...openShifts, ...recentShifts].forEach(s => {
      if (s && !s.deleted) shiftMap.set(s.id, s)
    })

    transactions.value = recentTx
    debtPayments.value = recentPays
    expenses.value = recentExpenses
    shifts.value = Array.from(shiftMap.values()).sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
    totalTransactionCount.value = txCount
    totalDebtPaymentCount.value = payCount
    totalExpenseCount.value = expCount
    totalShiftCount.value = shiftCount
  }

  const refreshSettings = async () => {
    const [profileSetting, catSetting, archiveSetting, openingCashSetting] = await Promise.all([
      db.settings.get('storeProfile'),
      db.settings.get('categories'),
      db.settings.get('archiveState'),
      db.settings.get('lastOpeningCash')
    ])

    if (profileSetting && profileSetting.value) {
      storeProfile.value = { ...profileSetting.value }
    }

    archiveCutoffAt.value = Number(archiveSetting?.value?.cutoffAt || 0)
    lastOpeningCash.value = Math.max(0, Number(openingCashSetting?.value || 0))

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

  // CRUD Produk (mendukung harga ecer + opsional multi harga grosir/agen)
  const saveProduct = async (productData) => {
    const now = Date.now()
    const payload = toPlain({
      ...productData,
      sellPrice: Math.max(0, Number(productData.sellPrice || 0)),
      buyPrice: Math.max(0, Number(productData.buyPrice || 0)),
      wholesalePrice: sanitizeOptionalPrice(productData.wholesalePrice),
      wholesaleMinQty: sanitizeMinQty(productData.wholesaleMinQty),
      agentPrice: sanitizeOptionalPrice(productData.agentPrice),
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

  // CRUD Pelanggan (Buku Utang & Level Harga Pelanggan)
  const saveCustomer = async (custData) => {
    const now = Date.now()
    const isSystemUmum = (custData.name || '').trim().toLowerCase() === 'umum'
    const normalizedTier = isSystemUmum ? 'ecer' : normalizePriceTier(custData.priceTier)
    const payload = toPlain({
      ...custData,
      priceTier: normalizedTier,
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
        existing.priceTier = custData.priceTier ? normalizedTier : normalizePriceTier(existing.priceTier)
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
  const recordDebtPayment = async ({ customerId, amount, paymentMethod = 'TUNAI' }) => {
    const cust = await db.customers.get(customerId)
    if (!cust) return

    const now = Date.now()
    const currentDebt = cust.totalDebt || 0
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return

    const method = paymentMethod === 'QRIS' ? 'QRIS' : 'TUNAI'

    // Catat kas masuk hanya sebatas nominal utang yang benar-benar terlunasi (tanpa uang kembalian)
    const appliedAmount = Math.min(numericAmount, currentDebt)
    if (appliedAmount <= 0) return

    const nextDebt = Math.max(0, currentDebt - appliedAmount)
    cust.totalDebt = nextDebt
    cust.lastDate = 'Hari ini'
    cust.updatedAt = now
    await db.customers.put(cust)

    // Catat histori pelunasan sebesar nominal utang yang dibayarkan
    const currentShift = activeShift.value
    const paymentRecord = toPlain({
      id: generateUniqueId(),
      customerId,
      amount: appliedAmount,
      paymentMethod: method,
      paymentDate: now,
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
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
      paymentMethod: method,
      paymentDate: now
    }
  }

  // Pencatatan Pengeluaran / Kas Keluar Harian
  const recordExpense = async ({
    amount,
    category = 'operasional',
    source = 'TUNAI_LACI',
    note = '',
    createdAt,
    expenseNumber
  } = {}) => {
    const numericAmount = Math.round(Number(amount))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return

    const now = Date.now()
    const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : now
    const id = generateUniqueId()
    const cleanSource = source === 'NON_TUNAI' ? 'NON_TUNAI' : 'TUNAI_LACI'
    const cleanCategory = typeof category === 'string' && category.trim() ? category.trim() : 'operasional'
    const cleanNote = typeof note === 'string' ? note.trim() : ''
    const expNo = (typeof expenseNumber === 'string' && expenseNumber.trim())
      ? expenseNumber.trim()
      : `KLR-${String(id).slice(-7)}`

    const currentShift = activeShift.value
    const expenseRecord = toPlain({
      id,
      expenseNumber: expNo,
      createdAt: timestamp,
      amount: numericAmount,
      category: cleanCategory,
      source: cleanSource,
      note: cleanNote,
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
      updatedAt: now,
      deleted: false
    })

    await db.expenses.add(expenseRecord)
    expenses.value = [expenseRecord, ...expenses.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    totalExpenseCount.value += 1
    return expenseRecord
  }

  const deleteExpense = async (expenseId) => {
    const exp = await db.expenses.get(expenseId)
    if (!exp || exp.deleted) return false
    exp.deleted = true
    exp.updatedAt = Date.now()
    await db.expenses.put(toPlain(exp))
    expenses.value = expenses.value.filter(e => e.id !== expenseId)
    totalExpenseCount.value = Math.max(0, totalExpenseCount.value - 1)
    return true
  }

  // Buka & Tutup Shift (1 shift = 1 hari operasional toko dengan modal awal & tutup buku laci)
  const openShift = async ({
    cashierName,
    openingCash = 0,
    adoptUnassignedToday = true,
    openedAt
  } = {}) => {
    const existingOpen = await db.shifts.where('status').equals('OPEN').filter(s => !s.deleted).first()
    if (existingOpen) {
      await refreshRecentTransactions()
      return existingOpen
    }

    const now = Date.now()
    const cleanOpenedAt = Number.isFinite(Number(openedAt)) ? Number(openedAt) : now
    const numericOpening = Math.round(Number(openingCash || 0))
    const cleanOpening = Number.isFinite(numericOpening) && numericOpening >= 0 ? numericOpening : 0
    const cleanCashier = (cashierName || storeProfile.value?.owner || 'Kasir').trim() || 'Kasir'
    const id = generateUniqueId()
    const shiftCode = `SHF-${String(id).slice(-7)}`

    const shiftRecord = toPlain({
      id,
      shiftCode,
      cashierName: cleanCashier,
      openingCash: cleanOpening,
      openedAt: cleanOpenedAt,
      closedAt: null,
      status: 'OPEN',
      actualCash: null,
      expectedCash: null,
      cashDifference: null,
      closingNote: '',
      summary: null,
      updatedAt: now,
      deleted: false
    })

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()

    await db.transaction('rw', [db.shifts, db.transactions, db.debtPayments, db.expenses, db.settings], async () => {
      await db.shifts.add(shiftRecord)
      await db.settings.put({
        key: 'lastOpeningCash',
        value: cleanOpening,
        updatedAt: now
      })

      if (adoptUnassignedToday) {
        const [unassignedTx, unassignedPays, unassignedExps] = await Promise.all([
          db.transactions.where('createdAt').aboveOrEqual(todayTs).filter(t => !t.shiftId && !t.shiftCode).toArray(),
          db.debtPayments.where('paymentDate').aboveOrEqual(todayTs).filter(p => !p.shiftId && !p.shiftCode).toArray(),
          db.expenses.where('createdAt').aboveOrEqual(todayTs).filter(e => !e.deleted && !e.shiftId && !e.shiftCode).toArray()
        ])

        if (unassignedTx.length > 0) {
          await db.transactions.bulkPut(toPlain(unassignedTx.map(t => ({ ...t, shiftId: id, shiftCode, updatedAt: now }))))
        }
        if (unassignedPays.length > 0) {
          await db.debtPayments.bulkPut(toPlain(unassignedPays.map(p => ({ ...p, shiftId: id, shiftCode, updatedAt: now }))))
        }
        if (unassignedExps.length > 0) {
          await db.expenses.bulkPut(toPlain(unassignedExps.map(e => ({ ...e, shiftId: id, shiftCode, updatedAt: now }))))
        }
      }
    })

    lastOpeningCash.value = cleanOpening
    await refreshRecentTransactions()
    return shiftRecord
  }

  const closeShift = async ({
    shiftId,
    actualCash,
    closingNote = '',
    closedAt
  } = {}) => {
    const targetId = shiftId ?? activeShift.value?.id
    const shift = targetId
      ? await db.shifts.get(targetId)
      : await db.shifts.where('status').equals('OPEN').filter(s => !s.deleted).first()
    if (!shift || shift.deleted || shift.status === 'CLOSED') return null

    const now = Date.now()
    const cleanClosedAt = Number.isFinite(Number(closedAt)) ? Number(closedAt) : now
    const startOfOpenedDay = new Date(shift.openedAt || now)
    startOfOpenedDay.setHours(0, 0, 0, 0)
    const queryStart = Math.min(Number(shift.openedAt || now), startOfOpenedDay.getTime())

    const [periodTx, periodPays, periodExps] = await Promise.all([
      db.transactions.where('createdAt').aboveOrEqual(queryStart).toArray(),
      db.debtPayments.where('paymentDate').aboveOrEqual(queryStart).toArray(),
      db.expenses.where('createdAt').aboveOrEqual(queryStart).filter(e => !e.deleted).toArray()
    ])

    const numericActual = Math.round(Number(actualCash))
    if (!Number.isFinite(numericActual) || numericActual < 0) return null

    const preview = computeShiftClosingPreview({
      shift: { ...shift, closedAt: cleanClosedAt },
      transactions: periodTx,
      debtPayments: periodPays,
      expenses: periodExps,
      actualCash: numericActual
    })

    const updatedShift = toPlain({
      ...shift,
      status: 'CLOSED',
      closedAt: cleanClosedAt,
      actualCash: preview.actualCash,
      expectedCash: preview.expectedCash,
      cashDifference: preview.cashDifference,
      closingNote: typeof closingNote === 'string' ? closingNote.trim() : '',
      summary: preview,
      updatedAt: now
    })

    await db.shifts.put(updatedShift)
    await refreshRecentTransactions()
    return updatedShift
  }

  // Pencatatan Transaksi Baru (update state inkremental agar checkout selalu instan <5ms)
  const recordTransaction = async ({ invoiceNumber, totalAmount, paymentMethod, cashGiven, changeAmount, customer, items }) => {
    const now = Date.now()
    const currentShift = activeShift.value
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
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        sellPrice: item.sellPrice,
        baseSellPrice: item.baseSellPrice ?? item.sellPrice,
        buyPrice: item.buyPrice ?? Math.round(item.sellPrice * 0.8),
        qty: item.qty,
        subtotal: item.sellPrice * item.qty,
        priceTier: item.appliedTier || 'ecer',
        priceLabel: item.tierLabel || 'Ecer'
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
    const [allProducts, allCustomers, allTransactions, allDebtPayments, allExpenses, allShifts, allSettings] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.transactions.toArray(),
      db.debtPayments.toArray(),
      db.expenses.toArray(),
      db.shifts.toArray(),
      db.settings.toArray()
    ])

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
        expenses: allExpenses,
        shifts: allShifts,
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

  // Ambil seluruh transaksi, pelunasan, pengeluaran, & shift dari IndexedDB on-demand (khusus ekspor Excel lengkap)
  const getAllTransactionsForExport = async () => {
    const [allTransactions, allDebtPayments, allExpenses, allShifts] = await Promise.all([
      db.transactions.orderBy('createdAt').reverse().toArray(),
      db.debtPayments.orderBy('paymentDate').reverse().toArray(),
      db.expenses.orderBy('createdAt').reverse().filter(e => !e.deleted).toArray(),
      db.shifts.orderBy('openedAt').reverse().filter(s => !s.deleted).toArray()
    ])
    return {
      transactions: allTransactions,
      debtPayments: allDebtPayments,
      expenses: allExpenses,
      shifts: allShifts
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
    const [txCount, payCount, expenseCount, shiftCount] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).count(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).count(),
      db.expenses.where('createdAt').below(cutoffTimestamp).count(),
      db.shifts.where('openedAt').below(cutoffTimestamp).filter(s => s.status !== 'OPEN').count()
    ])
    return {
      retentionDays,
      cutoffTimestamp,
      txCount,
      payCount,
      expenseCount,
      shiftCount
    }
  }

  // Arsipkan & pangkas transaksi lama ke file JSON (+ siapkan payload untuk arsip Drive) tanpa menyentuh utang/barang/pelanggan
  const archiveOldTransactions = async (retentionDays = 180) => {
    const cutoffTimestamp = Date.now() - retentionDays * MS_PER_DAY
    const [oldTx, oldPays, oldExpenses, oldShifts] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).toArray(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).toArray(),
      db.expenses.where('createdAt').below(cutoffTimestamp).toArray(),
      db.shifts.where('openedAt').below(cutoffTimestamp).filter(s => s.status !== 'OPEN').toArray()
    ])

    if (oldTx.length === 0 && oldPays.length === 0 && oldExpenses.length === 0 && oldShifts.length === 0) {
      return {
        archivedTxCount: 0,
        archivedPayCount: 0,
        archivedExpenseCount: 0,
        archivedShiftCount: 0,
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
        debtPayments: oldPays,
        expenses: oldExpenses,
        shifts: oldShifts
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
    await db.transaction('rw', [db.transactions, db.debtPayments, db.expenses, db.shifts, db.settings], async () => {
      await db.transactions.where('createdAt').below(cutoffTimestamp).delete()
      await db.debtPayments.where('paymentDate').below(cutoffTimestamp).delete()
      await db.expenses.where('createdAt').below(cutoffTimestamp).delete()
      if (oldShifts.length > 0) {
        await db.shifts.bulkDelete(oldShifts.map(s => s.id))
      }
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
      archivedExpenseCount: oldExpenses.length,
      archivedShiftCount: oldShifts.length,
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
    const activeExpenses = Array.isArray(d.expenses) ? d.expenses.filter(e => !e.deleted) : []
    const activeShifts = Array.isArray(d.shifts) ? d.shifts.filter(s => !s.deleted) : []

    return {
      valid: true,
      exportedAt: payload.exportedAt || null,
      storeName: payload.storeProfile?.name || d.settings?.find(s => s.key === 'storeProfile')?.value?.name || 'Toko Kasiry',
      productCount: activeProducts.length,
      customerCount: activeCustomers.length,
      transactionCount: txList.length,
      debtPaymentCount: payList.length,
      expenseCount: activeExpenses.length,
      shiftCount: activeShifts.length,
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
        expenses: inExpenses = [],
        shifts: inShifts = [],
        settings: inSettings = []
      } = payload.data

      await db.transaction('rw', [db.products, db.customers, db.transactions, db.debtPayments, db.expenses, db.shifts, db.settings], async () => {
        if (mode === 'replace') {
          await db.products.clear()
          await db.customers.clear()
          await db.transactions.clear()
          await db.debtPayments.clear()
          await db.expenses.clear()
          await db.shifts.clear()
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
          if (Array.isArray(inExpenses) && inExpenses.length > 0) {
            await db.expenses.bulkPut(toPlain(inExpenses))
          }
          if (Array.isArray(inShifts) && inShifts.length > 0) {
            await db.shifts.bulkPut(toPlain(inShifts))
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

        if (Array.isArray(inExpenses) && inExpenses.length > 0) {
          const existingExps = await db.expenses.toArray()
          const expById = new Map(existingExps.map(e => [e.id, e]))
          const expByNo = new Map(existingExps.filter(e => e.expenseNumber).map(e => [e.expenseNumber, e]))
          const usedExpIds = new Set(existingExps.map(e => e.id))
          const toPutExps = []

          for (const re of inExpenses) {
            if (effectiveCutoff > 0 && (re.createdAt || 0) < effectiveCutoff) continue
            const localMatch = (re.expenseNumber && expByNo.get(re.expenseNumber)) || expById.get(re.id)
            if (!localMatch) {
              const cleanExp = toPlain(re)
              if (!cleanExp.id || usedExpIds.has(cleanExp.id)) {
                cleanExp.id = generateUniqueId()
              }
              usedExpIds.add(cleanExp.id)
              toPutExps.push(cleanExp)
            } else if ((re.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutExps.push(toPlain({ ...re, id: localMatch.id }))
            }
          }
          if (toPutExps.length > 0) await db.expenses.bulkPut(toPutExps)
        }

        if (Array.isArray(inShifts) && inShifts.length > 0) {
          const existingShifts = await db.shifts.toArray()
          const shiftById = new Map(existingShifts.map(s => [s.id, s]))
          const shiftByCode = new Map(existingShifts.filter(s => s.shiftCode).map(s => [s.shiftCode, s]))
          const usedShiftIds = new Set(existingShifts.map(s => s.id))
          const toPutShifts = []

          for (const rs of inShifts) {
            if (effectiveCutoff > 0 && rs.status !== 'OPEN' && (rs.openedAt || 0) < effectiveCutoff) continue
            const localMatch = (rs.shiftCode && shiftByCode.get(rs.shiftCode)) || shiftById.get(rs.id)
            if (!localMatch) {
              const cleanShift = toPlain(rs)
              if (!cleanShift.id || usedShiftIds.has(cleanShift.id)) {
                cleanShift.id = generateUniqueId()
              }
              usedShiftIds.add(cleanShift.id)
              toPutShifts.push(cleanShift)
            } else if ((rs.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutShifts.push(toPlain({ ...rs, id: localMatch.id }))
            }
          }
          if (toPutShifts.length > 0) await db.shifts.bulkPut(toPutShifts)
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
        customerCount: inCustomers?.length || 0,
        expenseCount: inExpenses?.length || 0,
        shiftCount: inShifts?.length || 0
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
    expenses,
    shifts,
    activeShift,
    isActiveShiftStale,
    lastOpeningCash,
    unassignedTodayCount,
    totalTransactionCount,
    totalDebtPaymentCount,
    totalExpenseCount,
    totalShiftCount,
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
    recordExpense,
    deleteExpense,
    openShift,
    closeShift,
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
