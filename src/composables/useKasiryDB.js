import { ref, shallowRef, computed } from 'vue'
import { db, initDatabase } from '../db/index'
import { computeShiftClosingPreview } from '../utils/dailyStats'
import { normalizePriceTier, sanitizeOptionalPrice, sanitizeMinQty } from '../utils/pricing'
import { buildProductUsageMap } from '../utils/productUsage'

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

const normalizeStock = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val === 'string' && val.trim() === '') return null
  const num = Math.round(Number(val))
  if (!Number.isFinite(num)) return null
  return Math.max(0, num)
}

// Shared Reactive State (shallowRef untuk daftar besar agar bebas beban deep Proxy Vue)
const isDbReady = ref(false)
const products = shallowRef([])
const customers = ref([])
const transactions = shallowRef([])
const debtPayments = shallowRef([])
const expenses = shallowRef([])
const restocks = shallowRef([])
const cashServices = shallowRef([])
const digitalProducts = shallowRef([])
const fundMovements = shallowRef([])
const shifts = shallowRef([])
const lastOpeningCash = ref(0)
const totalTransactionCount = ref(0)
const totalDebtPaymentCount = ref(0)
const totalExpenseCount = ref(0)
const totalRestockCount = ref(0)
const totalCashServiceCount = ref(0)
const totalDigitalProductCount = ref(0)
const totalFundMovementCount = ref(0)
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
  const unassignedServices = cashServices.value.filter(
    s => !s?.deleted && (s?.createdAt || 0) >= todayTs && !s.shiftId && !s.shiftCode
  ).length
  const unassignedDigitals = digitalProducts.value.filter(
    d => !d?.deleted && (d?.createdAt || 0) >= todayTs && !d.shiftId && !d.shiftCode
  ).length
  const unassignedFundMovements = fundMovements.value.filter(
    m => !m?.deleted && (m?.createdAt || 0) >= todayTs && !m.shiftId && !m.shiftCode
  ).length
  return unassignedTx + unassignedPays + unassignedExps + unassignedServices + unassignedDigitals + unassignedFundMovements
})
const lastLocalBackupTime = ref(
  typeof localStorage !== 'undefined' ? localStorage.getItem('kasiry_last_local_backup') || null : null
)
const storeProfile = ref({
  name: 'Warung Kasiry',
  owner: 'Pemilik Toko',
  phone: ''
})

// Kategori Barang Warung Indonesia
const initialDefaultCategories = [
  'Sembako',
  'Makanan',
  'Minuman',
  'Jajanan & Kopi',
  'Bumbu Dapur',
  'Kebersihan',
  'Rokok',
  'Curah',
  'Obat & Lainnya'
]
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
    const [recentTx, recentPays, recentExpenses, recentRestocks, recentCashServices, recentDigitalProducts, recentFundMovements, recentShifts, openShifts, txCount, payCount, expCount, restockCount, cashServiceCount, digitalCount, fundMovementCount, shiftCount] = await Promise.all([
      db.transactions.where('createdAt').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.debtPayments.where('paymentDate').aboveOrEqual(windowCutoff).reverse().toArray(),
      db.expenses.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(e => !e.deleted).toArray(),
      db.restocks.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(r => !r.deleted).toArray(),
      db.cashServices.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(s => !s.deleted).toArray(),
      db.digitalProducts.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(d => !d.deleted).toArray(),
      db.fundMovements.where('createdAt').aboveOrEqual(windowCutoff).reverse().filter(m => !m.deleted).toArray(),
      db.shifts.where('openedAt').aboveOrEqual(windowCutoff).reverse().filter(s => !s.deleted).toArray(),
      db.shifts.where('status').equals('OPEN').filter(s => !s.deleted).toArray(),
      db.transactions.count(),
      db.debtPayments.count(),
      db.expenses.filter(e => !e.deleted).count(),
      db.restocks.filter(r => !r.deleted).count(),
      db.cashServices.filter(s => !s.deleted).count(),
      db.digitalProducts.filter(d => !d.deleted).count(),
      db.fundMovements.filter(m => !m.deleted).count(),
      db.shifts.filter(s => !s.deleted).count()
    ])

    const shiftMap = new Map()
    ;[...openShifts, ...recentShifts].forEach(s => {
      if (s && !s.deleted) shiftMap.set(s.id, s)
    })

    transactions.value = recentTx
    debtPayments.value = recentPays
    expenses.value = recentExpenses
    restocks.value = recentRestocks
    cashServices.value = recentCashServices
    digitalProducts.value = recentDigitalProducts
    fundMovements.value = recentFundMovements
    shifts.value = Array.from(shiftMap.values()).sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
    totalTransactionCount.value = txCount
    totalDebtPaymentCount.value = payCount
    totalExpenseCount.value = expCount
    totalRestockCount.value = restockCount
    totalCashServiceCount.value = cashServiceCount
    totalDigitalProductCount.value = digitalCount
    totalFundMovementCount.value = fundMovementCount
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

  const FREQUENT_PRODUCTS_LIMIT = 24

  // Computed: hingga 24 Barang Terlaris (prioritas: laku terjual 90hr -> sudah punya harga -> isMacro -> urutan katalog)
  const frequentProducts = computed(() => {
    const active = products.value
    if (!active || active.length === 0) return []

    const usage = buildProductUsageMap(active, transactions.value)
    const ranked = active.map((prod, idx) => {
      const stats = usage.byId[prod.id]
      return {
        prod,
        idx,
        soldQty: stats?.totalQtySold || 0,
        hasPrice: Number(prod.sellPrice || 0) > 0 ? 1 : 0,
        isMacro: prod.isMacro ? 1 : 0
      }
    })

    ranked.sort((a, b) => {
      if (b.soldQty !== a.soldQty) return b.soldQty - a.soldQty
      if (b.hasPrice !== a.hasPrice) return b.hasPrice - a.hasPrice
      if (b.isMacro !== a.isMacro) return b.isMacro - a.isMacro
      return a.idx - b.idx
    })

    return ranked.slice(0, FREQUENT_PRODUCTS_LIMIT).map(entry => entry.prod)
  })

  // CRUD Produk (mendukung harga ecer + opsional multi harga grosir/agen + stok lunak opsional)
  const saveProduct = async (productData) => {
    const now = Date.now()
    const payload = toPlain({
      ...productData,
      sellPrice: Math.max(0, Number(productData.sellPrice || 0)),
      buyPrice: Math.max(0, Number(productData.buyPrice || 0)),
      wholesalePrice: sanitizeOptionalPrice(productData.wholesalePrice),
      wholesaleMinQty: sanitizeMinQty(productData.wholesaleMinQty),
      agentPrice: sanitizeOptionalPrice(productData.agentPrice),
      stock: normalizeStock(productData.stock),
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

  const deleteProductsBulk = async (productIds = []) => {
    const uniqueIds = Array.from(new Set(productIds)).filter(id => id !== null && id !== undefined)
    if (uniqueIds.length === 0) return 0
    const now = Date.now()
    const docs = await db.products.bulkGet(uniqueIds)
    const toSoftDelete = docs
      .filter(p => p && !p.deleted)
      .map(p => toPlain({ ...p, deleted: true, updatedAt: now }))
    if (toSoftDelete.length > 0) {
      await db.products.bulkPut(toSoftDelete)
      await refreshProducts()
    }
    return toSoftDelete.length
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

  // Pencatatan Layanan Tarik Tunai & Transfer / Top-Up (Cara A: Total Dibayar = Nominal + Biaya Admin)
  const recordCashService = async ({
    type = 'TARIK_TUNAI',
    amount,
    adminFee = 0,
    channel = 'QRIS / Transfer',
    customerName = '',
    cashSource = 'LACI',
    note = '',
    createdAt,
    serviceNumber,
    availableDrawerCash
  } = {}) => {
    const cleanType = type === 'TRANSFER' ? 'TRANSFER' : 'TARIK_TUNAI'
    const numericAmount = Math.round(Number(amount))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Nominal layanan harus lebih dari Rp 0.')
    }

    const rawAdmin = Math.round(Number(adminFee || 0))
    const cleanAdminFee = Number.isFinite(rawAdmin) && rawAdmin > 0 ? rawAdmin : 0
    const cleanSource = cashSource === 'KAS' ? 'KAS' : 'LACI'

    if (cleanType === 'TARIK_TUNAI' && availableDrawerCash !== undefined && availableDrawerCash !== null) {
      const cleanAvailable = Math.round(Number(availableDrawerCash || 0))
      if (cleanAvailable <= 0 || numericAmount > cleanAvailable) {
        const sourceName = cleanSource === 'KAS' ? 'Uang Kas Toko' : 'laci kasir'
        throw new Error(
          `Uang tunai di ${sourceName} tidak mencukupi (tersedia Rp ${Math.max(0, cleanAvailable).toLocaleString('id-ID')}).`
        )
      }
    }

    const now = Date.now()
    const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : now
    const id = generateUniqueId()
    const cleanServiceNo = (typeof serviceNumber === 'string' && serviceNumber.trim())
      ? serviceNumber.trim()
      : `${cleanType === 'TRANSFER' ? 'TF' : 'TT'}-${String(id).slice(-7)}`
    const cleanChannel = typeof channel === 'string' && channel.trim() ? channel.trim() : 'QRIS / Transfer'
    const cleanCustomer = typeof customerName === 'string' ? customerName.trim() : ''
    const cleanNote = typeof note === 'string' ? note.trim() : ''
    const currentShift = activeShift.value

    const serviceRecord = toPlain({
      id,
      serviceNumber: cleanServiceNo,
      createdAt: timestamp,
      type: cleanType,
      cashSource: cleanSource,
      amount: numericAmount,
      adminFee: cleanAdminFee,
      totalPaid: numericAmount + cleanAdminFee,
      channel: cleanChannel,
      customerName: cleanCustomer,
      note: cleanNote,
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
      updatedAt: now,
      deleted: false
    })

    await db.cashServices.add(serviceRecord)
    cashServices.value = [serviceRecord, ...cashServices.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    totalCashServiceCount.value += 1
    return serviceRecord
  }

  const deleteCashService = async (serviceId) => {
    const svc = await db.cashServices.get(serviceId)
    if (!svc || svc.deleted) return false
    svc.deleted = true
    svc.updatedAt = Date.now()
    await db.cashServices.put(toPlain(svc))
    cashServices.value = cashServices.value.filter(s => s.id !== serviceId)
    totalCashServiceCount.value = Math.max(0, totalCashServiceCount.value - 1)
    return true
  }

  // Pencatatan Mutasi Dana & Tabungan Toko (Laci Kasir <-> Uang Kas <-> Rekening/QRIS <-> Tabungan <-> Dana Luar)
  const ALLOWED_FUND_TYPES = new Set(['TAMBAH_TABUNGAN', 'MUTASI', 'SETOR_MODAL', 'TARIK_DANA'])
  const ALLOWED_FUND_ACCOUNTS = new Set(['LACI', 'KAS', 'REKENING', 'TABUNGAN', 'LUAR'])

  const recordFundMovement = async ({
    type = 'MUTASI',
    fromAccount = 'LACI',
    toAccount = 'KAS',
    amount,
    availableSourceBalance,
    note = '',
    createdAt,
    movementNumber
  } = {}) => {
    const cleanType = ALLOWED_FUND_TYPES.has(type) ? type : 'MUTASI'
    const cleanFrom = ALLOWED_FUND_ACCOUNTS.has(fromAccount) ? fromAccount : 'LACI'
    const cleanTo = ALLOWED_FUND_ACCOUNTS.has(toAccount) ? toAccount : 'KAS'

    if (cleanFrom === cleanTo) {
      throw new Error('Kantong asal dan tujuan tidak boleh sama.')
    }

    const numericAmount = Math.round(Number(amount))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Nominal mutasi dana harus lebih dari Rp 0.')
    }

    if (
      cleanFrom !== 'LUAR' &&
      availableSourceBalance !== undefined &&
      availableSourceBalance !== null
    ) {
      const cleanAvailable = Math.round(Number(availableSourceBalance || 0))
      if (cleanAvailable <= 0 || numericAmount > cleanAvailable) {
        const sourceLabelMap = {
          LACI: 'Uang Laci Kasir',
          KAS: 'Uang Kas Toko',
          REKENING: 'Rekening & QRIS',
          TABUNGAN: 'Tabungan Toko'
        }
        throw new Error(
          `Saldo ${sourceLabelMap[cleanFrom] || cleanFrom} tidak mencukupi (tersedia Rp ${Math.max(0, cleanAvailable).toLocaleString('id-ID')}).`
        )
      }
    }

    const now = Date.now()
    const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : now
    const id = generateUniqueId()
    const prefix = cleanType === 'TAMBAH_TABUNGAN' || cleanTo === 'TABUNGAN' ? 'TBG' : 'KEU'
    const cleanMovementNo = (typeof movementNumber === 'string' && movementNumber.trim())
      ? movementNumber.trim()
      : `${prefix}-${String(id).slice(-7)}`
    const cleanNote = typeof note === 'string' ? note.trim() : ''
    const currentShift = activeShift.value

    const movementRecord = toPlain({
      id,
      movementNumber: cleanMovementNo,
      createdAt: timestamp,
      type: cleanType,
      fromAccount: cleanFrom,
      toAccount: cleanTo,
      amount: numericAmount,
      note: cleanNote,
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
      updatedAt: now,
      deleted: false
    })

    await db.fundMovements.add(movementRecord)
    fundMovements.value = [movementRecord, ...fundMovements.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    totalFundMovementCount.value += 1
    return movementRecord
  }

  const deleteFundMovement = async (movementId) => {
    const rec = await db.fundMovements.get(movementId)
    if (!rec || rec.deleted) return false
    rec.deleted = true
    rec.updatedAt = Date.now()
    await db.fundMovements.put(toPlain(rec))
    fundMovements.value = fundMovements.value.filter(m => m.id !== movementId)
    totalFundMovementCount.value = Math.max(0, totalFundMovementCount.value - 1)
    return true
  }

  // Pencatatan Penjualan Pulsa, Paket Data, & Token Listrik PLN (modal dari saldo agen PPOB; pembayaran bisa Tunai/QRIS/Utang)
  const recordDigitalProduct = async ({
    category = 'PULSA',
    productName = '',
    provider = '',
    targetNumber = '',
    tokenCode = '',
    nominal = 0,
    costPrice = 0,
    sellPrice,
    costSource = 'SALDO_AGEN',
    paymentMethod = 'TUNAI',
    customer = null,
    note = '',
    createdAt,
    digitalNumber
  } = {}) => {
    const cleanCategory = ['PULSA', 'PAKET_DATA', 'TOKEN_LISTRIK', 'TAGIHAN'].includes(category)
      ? category
      : 'PULSA'
    const numericSell = Math.round(Number(sellPrice))
    if (!Number.isFinite(numericSell) || numericSell <= 0) {
      throw new Error('Harga jual pulsa/token harus lebih dari Rp 0.')
    }

    const rawCost = Math.round(Number(costPrice || 0))
    const cleanCost = Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : 0
    const rawNominal = Math.round(Number(nominal || 0))
    const cleanNominal = Number.isFinite(rawNominal) && rawNominal >= 0 ? rawNominal : 0

    let method = 'TUNAI'
    if (paymentMethod === 'QRIS') method = 'QRIS'
    else if (paymentMethod === 'UTANG / BON') method = 'UTANG / BON'

    const cleanCustomerName = (customer?.name || '').trim()
    if (method === 'UTANG / BON' && (!cleanCustomerName || cleanCustomerName.toLowerCase() === 'umum')) {
      throw new Error('Penjualan Pulsa/Token dengan Utang / Bon wajib memilih pelanggan selain "Umum".')
    }

    const now = Date.now()
    const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : now
    const id = generateUniqueId()
    const prefix = cleanCategory === 'TOKEN_LISTRIK'
      ? 'PLN'
      : cleanCategory === 'TAGIHAN'
        ? 'PPB'
        : 'PLS'
    const cleanDigitalNo = (typeof digitalNumber === 'string' && digitalNumber.trim())
      ? digitalNumber.trim()
      : `${prefix}-${String(id).slice(-7)}`
    const defaultLabel = cleanCategory === 'TOKEN_LISTRIK'
      ? `Token Listrik ${cleanNominal ? `${(cleanNominal / 1000).toLocaleString('id-ID')}rb` : ''}`.trim()
      : cleanCategory === 'PAKET_DATA'
        ? `Paket Data ${cleanNominal ? `Rp ${cleanNominal.toLocaleString('id-ID')}` : ''}`.trim()
        : `Pulsa ${cleanNominal ? `${(cleanNominal / 1000).toLocaleString('id-ID')}rb` : ''}`.trim()

    const currentShift = activeShift.value
    let customerMutated = false

    const digitalRecord = toPlain({
      id,
      digitalNumber: cleanDigitalNo,
      createdAt: timestamp,
      category: cleanCategory,
      productName: (typeof productName === 'string' && productName.trim()) ? productName.trim() : defaultLabel,
      provider: (typeof provider === 'string' && provider.trim())
        ? provider.trim()
        : (cleanCategory === 'TOKEN_LISTRIK' ? 'PLN' : 'Umum'),
      targetNumber: typeof targetNumber === 'string' ? targetNumber.trim() : '',
      tokenCode: typeof tokenCode === 'string' ? tokenCode.trim() : '',
      nominal: cleanNominal,
      costPrice: cleanCost,
      sellPrice: numericSell,
      profit: numericSell - cleanCost,
      costSource: costSource || 'SALDO_AGEN',
      paymentMethod: method,
      customerId: customer?.id || null,
      customerName: cleanCustomerName || 'Umum',
      note: typeof note === 'string' ? note.trim() : '',
      shiftId: currentShift?.id || null,
      shiftCode: currentShift?.shiftCode || null,
      updatedAt: now,
      deleted: false
    })

    await db.transaction('rw', [db.digitalProducts, db.customers], async () => {
      if (method === 'UTANG / BON') {
        let cust = customer?.id ? await db.customers.get(customer.id) : null
        if (!cust && cleanCustomerName) {
          const lower = cleanCustomerName.toLowerCase()
          cust = await db.customers.filter(c => !c.deleted && c.name?.toLowerCase() === lower).first()
        }
        if (cust) {
          cust.totalDebt = (cust.totalDebt || 0) + numericSell
          cust.lastDate = 'Hari ini'
          cust.updatedAt = now
          await db.customers.put(toPlain(cust))
        } else {
          cust = toPlain({
            id: customer?.id || generateUniqueId(),
            name: cleanCustomerName,
            phone: customer?.phone || '',
            totalDebt: numericSell,
            priceTier: 'ecer',
            lastDate: 'Hari ini',
            updatedAt: now,
            deleted: false
          })
          await db.customers.add(cust)
        }
        digitalRecord.customerId = cust.id
        digitalRecord.customerName = cust.name
        customerMutated = true
      }

      await db.digitalProducts.add(digitalRecord)
    })

    digitalProducts.value = [digitalRecord, ...digitalProducts.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    totalDigitalProductCount.value += 1
    if (customerMutated) {
      await refreshCustomers()
    }
    return digitalRecord
  }

  const updateDigitalTokenCode = async (digitalId, tokenCode = '', note = null) => {
    const rec = await db.digitalProducts.get(digitalId)
    if (!rec || rec.deleted) return null
    const now = Date.now()
    rec.tokenCode = typeof tokenCode === 'string' ? tokenCode.trim() : ''
    if (note !== null && typeof note === 'string') {
      rec.note = note.trim()
    }
    rec.updatedAt = now
    const plain = toPlain(rec)
    await db.digitalProducts.put(plain)
    digitalProducts.value = digitalProducts.value.map(d => (d.id === digitalId ? plain : d))
    return plain
  }

  const deleteDigitalProduct = async (digitalId) => {
    const rec = await db.digitalProducts.get(digitalId)
    if (!rec || rec.deleted) return false
    const now = Date.now()
    let customerMutated = false

    await db.transaction('rw', [db.digitalProducts, db.customers], async () => {
      rec.deleted = true
      rec.updatedAt = now
      await db.digitalProducts.put(toPlain(rec))

      if (rec.paymentMethod === 'UTANG / BON' && rec.customerId) {
        const cust = await db.customers.get(rec.customerId)
        if (cust && !cust.deleted) {
          cust.totalDebt = Math.max(0, Number(cust.totalDebt || 0) - Math.round(Number(rec.sellPrice || 0)))
          cust.updatedAt = now
          await db.customers.put(toPlain(cust))
          customerMutated = true
        }
      }
    })

    digitalProducts.value = digitalProducts.value.filter(d => d.id !== digitalId)
    totalDigitalProductCount.value = Math.max(0, totalDigitalProductCount.value - 1)
    if (customerMutated) {
      await refreshCustomers()
    }
    return true
  }

  // Pencatatan Kulakan / Belanja Stok Barang (update harga beli, stok lunak opsional, & kas keluar otomatis bila dari laci/rekening)
  const recordRestock = async ({
    supplierName = '',
    source = 'TUNAI_LACI',
    note = '',
    items = [],
    createdAt
  } = {}) => {
    if (!Array.isArray(items) || items.length === 0) return null

    const now = Date.now()
    const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : now
    const cleanSource = ['TUNAI_LACI', 'NON_TUNAI', 'DANA_LUAR'].includes(source) ? source : 'TUNAI_LACI'
    const cleanSupplier = typeof supplierName === 'string' ? supplierName.trim() : ''
    const cleanNote = typeof note === 'string' ? note.trim() : ''

    const normalizedItems = items
      .map(raw => {
        const qty = Math.round(Number(raw?.qty || 0))
        const unitBuyPrice = Math.max(0, Math.round(Number(raw?.unitBuyPrice ?? raw?.buyPrice ?? 0)))
        const hasNewSell = raw?.newSellPrice !== null && raw?.newSellPrice !== undefined && raw?.newSellPrice !== '' && Number.isFinite(Number(raw.newSellPrice))
        const newSellPrice = hasNewSell ? Math.max(0, Math.round(Number(raw.newSellPrice))) : null
        return {
          productId: raw?.productId ?? null,
          productName: typeof raw?.productName === 'string' ? raw.productName.trim() : (raw?.name || 'Barang'),
          qty,
          unitBuyPrice,
          subtotal: qty * unitBuyPrice,
          trackStock: raw?.trackStock !== false,
          newSellPrice,
          prevBuyPrice: null,
          prevSellPrice: null,
          prevStock: null,
          nextStock: null
        }
      })
      .filter(it => it.qty > 0)

    if (normalizedItems.length === 0) return null

    const totalCost = normalizedItems.reduce((sum, it) => sum + it.subtotal, 0)
    const id = generateUniqueId()
    const restockNumber = `KLK-${String(id).slice(-7)}`
    const currentShift = activeShift.value

    let expenseRecord = null
    let mutatedProds = []
    let restockRecord = null

    await db.transaction('rw', [db.restocks, db.products, db.expenses], async () => {
      const targetIds = Array.from(new Set(normalizedItems.map(i => i.productId).filter(pid => pid !== null && pid !== undefined && pid !== '')))
      const fetchedProds = targetIds.length > 0 ? await db.products.bulkGet(targetIds) : []
      const prodMap = new Map()
      for (const p of fetchedProds) {
        if (p && !p.deleted) {
          prodMap.set(p.id, toPlain(p))
        }
      }

      const dirtyProdIds = new Set()
      for (const item of normalizedItems) {
        if (item.productId === null || item.productId === undefined) continue
        const prod = prodMap.get(item.productId)
        if (!prod) continue

        item.productName = prod.name || item.productName
        item.prevBuyPrice = Math.max(0, Number(prod.buyPrice || 0))
        item.prevSellPrice = Math.max(0, Number(prod.sellPrice || 0))
        item.prevStock = (prod.stock !== null && prod.stock !== undefined && Number.isFinite(Number(prod.stock)))
          ? Math.max(0, Math.round(Number(prod.stock)))
          : null

        prod.buyPrice = item.unitBuyPrice
        if (item.newSellPrice !== null && item.newSellPrice !== undefined) {
          prod.sellPrice = item.newSellPrice
        }
        if (item.trackStock) {
          const baseStock = (prod.stock !== null && prod.stock !== undefined && Number.isFinite(Number(prod.stock)))
            ? Math.max(0, Math.round(Number(prod.stock)))
            : 0
          prod.stock = baseStock + item.qty
        }
        item.nextStock = prod.stock !== null && prod.stock !== undefined ? prod.stock : null
        prod.updatedAt = now
        dirtyProdIds.add(prod.id)
      }

      mutatedProds = Array.from(dirtyProdIds).map(pid => toPlain(prodMap.get(pid)))
      if (mutatedProds.length > 0) {
        await db.products.bulkPut(mutatedProds)
      }

      if ((cleanSource === 'TUNAI_LACI' || cleanSource === 'NON_TUNAI') && totalCost > 0) {
        const expId = generateUniqueId()
        const previewNames = normalizedItems.slice(0, 2).map(it => `${it.productName} x${it.qty}`).join(', ')
        const extraSuffix = normalizedItems.length > 2 ? ` +${normalizedItems.length - 2} item` : ''
        const supplierTag = cleanSupplier ? `Kulakan (${cleanSupplier})` : 'Kulakan'
        const detailTag = cleanNote ? ` — ${cleanNote}` : ''
        expenseRecord = toPlain({
          id: expId,
          expenseNumber: `KLR-${String(expId).slice(-7)}`,
          createdAt: timestamp,
          amount: totalCost,
          category: 'kulakan',
          source: cleanSource,
          note: `${supplierTag}: ${previewNames}${extraSuffix}${detailTag}`,
          shiftId: currentShift?.id || null,
          shiftCode: currentShift?.shiftCode || null,
          updatedAt: now,
          deleted: false
        })
        await db.expenses.add(expenseRecord)
      }

      restockRecord = toPlain({
        id,
        restockNumber,
        createdAt: timestamp,
        supplierName: cleanSupplier,
        source: cleanSource,
        note: cleanNote,
        totalCost,
        totalItems: normalizedItems.reduce((sum, it) => sum + it.qty, 0),
        items: normalizedItems,
        expenseId: expenseRecord ? expenseRecord.id : null,
        shiftId: currentShift?.id || null,
        shiftCode: currentShift?.shiftCode || null,
        updatedAt: now,
        deleted: false
      })
      await db.restocks.add(restockRecord)
    })

    restocks.value = [restockRecord, ...restocks.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    totalRestockCount.value += 1
    if (expenseRecord) {
      expenses.value = [expenseRecord, ...expenses.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      totalExpenseCount.value += 1
    }
    if (mutatedProds.length > 0) {
      await refreshProducts()
    }

    return {
      restock: restockRecord,
      expense: expenseRecord,
      updatedProducts: mutatedProds
    }
  }

  const deleteRestock = async (restockId) => {
    const rec = await db.restocks.get(restockId)
    if (!rec || rec.deleted) return false

    const now = Date.now()
    let expDeleted = false
    let productMutated = false

    await db.transaction('rw', [db.restocks, db.products, db.expenses], async () => {
      const cleanRec = toPlain({ ...rec, deleted: true, updatedAt: now })
      await db.restocks.put(cleanRec)

      if (rec.expenseId) {
        const exp = await db.expenses.get(rec.expenseId)
        if (exp && !exp.deleted) {
          exp.deleted = true
          exp.updatedAt = now
          await db.expenses.put(toPlain(exp))
          expDeleted = true
        }
      }

      const items = Array.isArray(rec.items) ? rec.items : []
      const targetIds = Array.from(new Set(items.map(i => i.productId).filter(pid => pid !== null && pid !== undefined && pid !== '')))
      if (targetIds.length > 0) {
        const fetchedProds = await db.products.bulkGet(targetIds)
        const prodMap = new Map()
        for (const p of fetchedProds) {
          if (p && !p.deleted) prodMap.set(p.id, toPlain(p))
        }
        const dirtyIds = new Set()

        for (const item of items) {
          const prod = prodMap.get(item.productId)
          if (!prod) continue

          if (item.trackStock && prod.stock !== null && prod.stock !== undefined && Number.isFinite(Number(prod.stock))) {
            const currentStock = Math.max(0, Math.round(Number(prod.stock)))
            const addedQty = Math.max(0, Math.round(Number(item.qty || 0)))
            if (item.prevStock === null && currentStock === addedQty) {
              prod.stock = null
            } else {
              prod.stock = Math.max(0, currentStock - addedQty)
            }
            prod.updatedAt = now
            dirtyIds.add(prod.id)
          }

          if (item.prevBuyPrice !== null && item.prevBuyPrice !== undefined && Number(prod.buyPrice) === Number(item.unitBuyPrice)) {
            prod.buyPrice = item.prevBuyPrice
            prod.updatedAt = now
            dirtyIds.add(prod.id)
          }
          if (
            item.newSellPrice !== null &&
            item.newSellPrice !== undefined &&
            item.prevSellPrice !== null &&
            item.prevSellPrice !== undefined &&
            Number(prod.sellPrice) === Number(item.newSellPrice)
          ) {
            prod.sellPrice = item.prevSellPrice
            prod.updatedAt = now
            dirtyIds.add(prod.id)
          }
        }

        if (dirtyIds.size > 0) {
          const toPut = Array.from(dirtyIds).map(pid => toPlain(prodMap.get(pid)))
          await db.products.bulkPut(toPut)
          productMutated = true
        }
      }
    })

    restocks.value = restocks.value.filter(r => r.id !== restockId)
    totalRestockCount.value = Math.max(0, totalRestockCount.value - 1)
    if (expDeleted) {
      expenses.value = expenses.value.filter(e => e.id !== rec.expenseId)
      totalExpenseCount.value = Math.max(0, totalExpenseCount.value - 1)
    }
    if (productMutated) {
      await refreshProducts()
    }
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

    await db.transaction('rw', [db.shifts, db.transactions, db.debtPayments, db.expenses, db.restocks, db.cashServices, db.digitalProducts, db.fundMovements, db.settings], async () => {
      await db.shifts.add(shiftRecord)
      await db.settings.put({
        key: 'lastOpeningCash',
        value: cleanOpening,
        updatedAt: now
      })

      if (adoptUnassignedToday) {
        const [unassignedTx, unassignedPays, unassignedExps, unassignedRestocks, unassignedCashServices, unassignedDigitals, unassignedFundMovements] = await Promise.all([
          db.transactions.where('createdAt').aboveOrEqual(todayTs).filter(t => !t.shiftId && !t.shiftCode).toArray(),
          db.debtPayments.where('paymentDate').aboveOrEqual(todayTs).filter(p => !p.shiftId && !p.shiftCode).toArray(),
          db.expenses.where('createdAt').aboveOrEqual(todayTs).filter(e => !e.deleted && !e.shiftId && !e.shiftCode).toArray(),
          db.restocks.where('createdAt').aboveOrEqual(todayTs).filter(r => !r.deleted && !r.shiftId && !r.shiftCode).toArray(),
          db.cashServices.where('createdAt').aboveOrEqual(todayTs).filter(s => !s.deleted && !s.shiftId && !s.shiftCode).toArray(),
          db.digitalProducts.where('createdAt').aboveOrEqual(todayTs).filter(d => !d.deleted && !d.shiftId && !d.shiftCode).toArray(),
          db.fundMovements.where('createdAt').aboveOrEqual(todayTs).filter(m => !m.deleted && !m.shiftId && !m.shiftCode).toArray()
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
        if (unassignedRestocks.length > 0) {
          await db.restocks.bulkPut(toPlain(unassignedRestocks.map(r => ({ ...r, shiftId: id, shiftCode, updatedAt: now }))))
        }
        if (unassignedCashServices.length > 0) {
          await db.cashServices.bulkPut(toPlain(unassignedCashServices.map(s => ({ ...s, shiftId: id, shiftCode, updatedAt: now }))))
        }
        if (unassignedDigitals.length > 0) {
          await db.digitalProducts.bulkPut(toPlain(unassignedDigitals.map(d => ({ ...d, shiftId: id, shiftCode, updatedAt: now }))))
        }
        if (unassignedFundMovements.length > 0) {
          await db.fundMovements.bulkPut(toPlain(unassignedFundMovements.map(m => ({ ...m, shiftId: id, shiftCode, updatedAt: now }))))
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

    const [periodTx, periodPays, periodExps, periodCashServices, periodDigitalProducts, periodFundMovements] = await Promise.all([
      db.transactions.where('createdAt').aboveOrEqual(queryStart).toArray(),
      db.debtPayments.where('paymentDate').aboveOrEqual(queryStart).toArray(),
      db.expenses.where('createdAt').aboveOrEqual(queryStart).filter(e => !e.deleted).toArray(),
      db.cashServices.where('createdAt').aboveOrEqual(queryStart).filter(s => !s.deleted).toArray(),
      db.digitalProducts.where('createdAt').aboveOrEqual(queryStart).filter(d => !d.deleted).toArray(),
      db.fundMovements.where('createdAt').aboveOrEqual(queryStart).filter(m => !m.deleted).toArray()
    ])

    const numericActual = Math.round(Number(actualCash))
    if (!Number.isFinite(numericActual) || numericActual < 0) return null

    const preview = computeShiftClosingPreview({
      shift: { ...shift, closedAt: cleanClosedAt },
      transactions: periodTx,
      debtPayments: periodPays,
      expenses: periodExps,
      cashServices: periodCashServices,
      digitalProducts: periodDigitalProducts,
      fundMovements: periodFundMovements,
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

  // Pencatatan Transaksi Baru (update state inkremental agar checkout selalu instan <5ms; mendukung bayar kurang masuk Buku Utang)
  const recordTransaction = async ({
    invoiceNumber,
    totalAmount,
    paymentMethod,
    cashGiven,
    paidAmount,
    debtAmount,
    changeAmount,
    customer,
    items
  }) => {
    const now = Date.now()
    const currentShift = activeShift.value
    const cleanTotal = Math.round(Number(totalAmount || 0))
    const rawExplicitDebt = Math.max(0, Math.round(Number(debtAmount || 0)))
    const isFullDebt = paymentMethod === 'UTANG / BON'
    const isPartialCash = paymentMethod === 'TUNAI (SEBAGIAN BON)' || (paymentMethod === 'TUNAI' && rawExplicitDebt > 0)
    const isPartialQris = paymentMethod === 'QRIS (SEBAGIAN BON)' || (paymentMethod === 'QRIS' && rawExplicitDebt > 0)

    const resolvedPaid = isFullDebt
      ? 0
      : (isPartialCash || isPartialQris)
        ? Math.max(0, Math.min(cleanTotal, Math.round(Number(paidAmount ?? cashGiven ?? 0))))
        : cleanTotal
    const resolvedDebt = isFullDebt
      ? cleanTotal
      : (isPartialCash || isPartialQris)
        ? (rawExplicitDebt > 0 ? rawExplicitDebt : Math.max(0, cleanTotal - resolvedPaid))
        : 0

    const isCustomerUmum = !customer || !customer.name || customer.name.trim().toLowerCase() === 'umum'
    if (resolvedDebt > 0 && isCustomerUmum) {
      throw new Error('Transaksi kurang bayar atau bon tidak boleh menggunakan pelanggan "Umum". Pilih pelanggan terlebih dahulu.')
    }

    const resolvedPaymentMethod = isPartialCash
      ? 'TUNAI (SEBAGIAN BON)'
      : isPartialQris
        ? 'QRIS (SEBAGIAN BON)'
        : paymentMethod

    const txRecord = toPlain({
      id: generateUniqueId(),
      invoiceNumber,
      createdAt: now,
      totalAmount: cleanTotal,
      paymentMethod: resolvedPaymentMethod,
      paidAmount: resolvedPaid,
      debtAmount: resolvedDebt,
      cashGiven: isFullDebt ? 0 : (cashGiven ?? resolvedPaid),
      changeAmount: resolvedDebt > 0 ? 0 : (changeAmount || 0),
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

    // 1. Simpan transaksi, akumulasi utang pelanggan (penuh maupun sebagian), & kurangi stok lunak secara atomik
    let txId = null
    let customerMutated = false
    let productMutated = false

    await db.transaction('rw', [db.transactions, db.customers, db.products], async () => {
      // 2. Jika ada sisa utang (penuh atau bayar kurang), akumulasikan saldo utang pelanggan (kecuali akun sistem "Umum")
      if (resolvedDebt > 0 && !isCustomerUmum) {
        let cust = customer.id ? await db.customers.get(customer.id) : null
        if (!cust && customer.name) {
          const cleanName = customer.name.trim().toLowerCase()
          cust = await db.customers.filter(c => !c.deleted && c.name?.toLowerCase() === cleanName).first()
        }
        if (cust) {
          cust.totalDebt = (cust.totalDebt || 0) + resolvedDebt
          cust.lastDate = 'Hari ini'
          cust.updatedAt = now
          await db.customers.put(toPlain(cust))
        } else {
          cust = toPlain({
            id: customer.id || generateUniqueId(),
            name: customer.name,
            phone: customer.phone || '',
            totalDebt: resolvedDebt,
            lastDate: 'Hari ini',
            updatedAt: now,
            deleted: false
          })
          await db.customers.add(cust)
        }
        txRecord.customerId = cust.id
        txRecord.customerName = cust.name
        customerMutated = true
      }

      txId = await db.transactions.add(txRecord)

      // 3. Kurangi stok secara lunak hanya untuk barang yang melacak stok (stock != null; 0 tetap boleh dibeli)
      const qtyByProductId = new Map()
      for (const item of items) {
        if (item && item.id !== null && item.id !== undefined && item.id !== '') {
          const q = Number(item.qty || 0)
          if (Number.isFinite(q) && q > 0) {
            qtyByProductId.set(item.id, (qtyByProductId.get(item.id) || 0) + q)
          }
        }
      }

      if (qtyByProductId.size > 0) {
        const prodDocs = await db.products.bulkGet(Array.from(qtyByProductId.keys()))
        const toUpdateProds = []
        for (const prod of prodDocs) {
          if (!prod || prod.deleted) continue
          if (prod.stock !== null && prod.stock !== undefined && Number.isFinite(Number(prod.stock))) {
            const currentStock = Math.max(0, Math.round(Number(prod.stock)))
            const soldQty = Math.round(qtyByProductId.get(prod.id) || 0)
            toUpdateProds.push(toPlain({
              ...prod,
              stock: Math.max(0, currentStock - soldQty),
              updatedAt: now
            }))
          }
        }
        if (toUpdateProds.length > 0) {
          await db.products.bulkPut(toUpdateProds)
          productMutated = true
        }
      }
    })

    // 4. Perbarui shallowRef & counter lokal langsung tanpa full reload 5 tabel
    transactions.value = [txRecord, ...transactions.value]
    totalTransactionCount.value += 1
    if (customerMutated) {
      await refreshCustomers()
    }
    if (productMutated) {
      await refreshProducts()
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
    const [allProducts, allCustomers, allTransactions, allDebtPayments, allExpenses, allRestocks, allCashServices, allDigitalProducts, allFundMovements, allShifts, allSettings] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.transactions.toArray(),
      db.debtPayments.toArray(),
      db.expenses.toArray(),
      db.restocks.toArray(),
      db.cashServices.toArray(),
      db.digitalProducts.toArray(),
      db.fundMovements.toArray(),
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
        restocks: allRestocks,
        cashServices: allCashServices,
        digitalProducts: allDigitalProducts,
        fundMovements: allFundMovements,
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

  // Ambil seluruh transaksi, pelunasan, pengeluaran, kulakan, layanan tunai/tf, pulsa/PLN, mutasi dana, & shift dari IndexedDB on-demand (khusus ekspor Excel lengkap)
  const getAllTransactionsForExport = async () => {
    const [allTransactions, allDebtPayments, allExpenses, allRestocks, allCashServices, allDigitalProducts, allFundMovements, allShifts] = await Promise.all([
      db.transactions.orderBy('createdAt').reverse().toArray(),
      db.debtPayments.orderBy('paymentDate').reverse().toArray(),
      db.expenses.orderBy('createdAt').reverse().filter(e => !e.deleted).toArray(),
      db.restocks.orderBy('createdAt').reverse().filter(r => !r.deleted).toArray(),
      db.cashServices.orderBy('createdAt').reverse().filter(s => !s.deleted).toArray(),
      db.digitalProducts.orderBy('createdAt').reverse().filter(d => !d.deleted).toArray(),
      db.fundMovements.orderBy('createdAt').reverse().filter(m => !m.deleted).toArray(),
      db.shifts.orderBy('openedAt').reverse().filter(s => !s.deleted).toArray()
    ])
    return {
      transactions: allTransactions,
      debtPayments: allDebtPayments,
      expenses: allExpenses,
      restocks: allRestocks,
      cashServices: allCashServices,
      digitalProducts: allDigitalProducts,
      fundMovements: allFundMovements,
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
    const [txCount, payCount, expenseCount, restockCount, cashServiceCount, digitalCount, fundMovementCount, shiftCount] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).count(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).count(),
      db.expenses.where('createdAt').below(cutoffTimestamp).count(),
      db.restocks.where('createdAt').below(cutoffTimestamp).count(),
      db.cashServices.where('createdAt').below(cutoffTimestamp).count(),
      db.digitalProducts.where('createdAt').below(cutoffTimestamp).count(),
      db.fundMovements.where('createdAt').below(cutoffTimestamp).count(),
      db.shifts.where('openedAt').below(cutoffTimestamp).filter(s => s.status !== 'OPEN').count()
    ])
    return {
      retentionDays,
      cutoffTimestamp,
      txCount,
      payCount,
      expenseCount,
      restockCount,
      cashServiceCount,
      digitalCount,
      fundMovementCount,
      shiftCount
    }
  }

  // Arsipkan & pangkas transaksi lama ke file JSON (+ siapkan payload untuk arsip Drive) tanpa menyentuh utang/barang/pelanggan
  const archiveOldTransactions = async (retentionDays = 180) => {
    const cutoffTimestamp = Date.now() - retentionDays * MS_PER_DAY
    const [oldTx, oldPays, oldExpenses, oldRestocks, oldCashServices, oldDigitalProducts, oldFundMovements, oldShifts] = await Promise.all([
      db.transactions.where('createdAt').below(cutoffTimestamp).toArray(),
      db.debtPayments.where('paymentDate').below(cutoffTimestamp).toArray(),
      db.expenses.where('createdAt').below(cutoffTimestamp).toArray(),
      db.restocks.where('createdAt').below(cutoffTimestamp).toArray(),
      db.cashServices.where('createdAt').below(cutoffTimestamp).toArray(),
      db.digitalProducts.where('createdAt').below(cutoffTimestamp).toArray(),
      db.fundMovements.where('createdAt').below(cutoffTimestamp).toArray(),
      db.shifts.where('openedAt').below(cutoffTimestamp).filter(s => s.status !== 'OPEN').toArray()
    ])

    if (oldTx.length === 0 && oldPays.length === 0 && oldExpenses.length === 0 && oldRestocks.length === 0 && oldCashServices.length === 0 && oldDigitalProducts.length === 0 && oldFundMovements.length === 0 && oldShifts.length === 0) {
      return {
        archivedTxCount: 0,
        archivedPayCount: 0,
        archivedExpenseCount: 0,
        archivedRestockCount: 0,
        archivedCashServiceCount: 0,
        archivedDigitalCount: 0,
        archivedFundMovementCount: 0,
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
        restocks: oldRestocks,
        cashServices: oldCashServices,
        digitalProducts: oldDigitalProducts,
        fundMovements: oldFundMovements,
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
    await db.transaction('rw', [db.transactions, db.debtPayments, db.expenses, db.restocks, db.cashServices, db.digitalProducts, db.fundMovements, db.shifts, db.settings], async () => {
      await db.transactions.where('createdAt').below(cutoffTimestamp).delete()
      await db.debtPayments.where('paymentDate').below(cutoffTimestamp).delete()
      await db.expenses.where('createdAt').below(cutoffTimestamp).delete()
      await db.restocks.where('createdAt').below(cutoffTimestamp).delete()
      await db.cashServices.where('createdAt').below(cutoffTimestamp).delete()
      await db.digitalProducts.where('createdAt').below(cutoffTimestamp).delete()
      await db.fundMovements.where('createdAt').below(cutoffTimestamp).delete()
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
      archivedRestockCount: oldRestocks.length,
      archivedCashServiceCount: oldCashServices.length,
      archivedDigitalCount: oldDigitalProducts.length,
      archivedFundMovementCount: oldFundMovements.length,
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
    const activeRestocks = Array.isArray(d.restocks) ? d.restocks.filter(r => !r.deleted) : []
    const activeCashServices = Array.isArray(d.cashServices) ? d.cashServices.filter(s => !s.deleted) : []
    const activeDigitalProducts = Array.isArray(d.digitalProducts) ? d.digitalProducts.filter(dig => !dig.deleted) : []
    const activeFundMovements = Array.isArray(d.fundMovements) ? d.fundMovements.filter(m => !m.deleted) : []
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
      restockCount: activeRestocks.length,
      cashServiceCount: activeCashServices.length,
      digitalProductCount: activeDigitalProducts.length,
      fundMovementCount: activeFundMovements.length,
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
        restocks: inRestocks = [],
        cashServices: inCashServices = [],
        digitalProducts: inDigitalProducts = [],
        fundMovements: inFundMovements = [],
        shifts: inShifts = [],
        settings: inSettings = []
      } = payload.data

      await db.transaction('rw', [db.products, db.customers, db.transactions, db.debtPayments, db.expenses, db.restocks, db.cashServices, db.digitalProducts, db.fundMovements, db.shifts, db.settings], async () => {
        if (mode === 'replace') {
          await db.products.clear()
          await db.customers.clear()
          await db.transactions.clear()
          await db.debtPayments.clear()
          await db.expenses.clear()
          await db.restocks.clear()
          await db.cashServices.clear()
          await db.digitalProducts.clear()
          await db.fundMovements.clear()
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
          if (Array.isArray(inRestocks) && inRestocks.length > 0) {
            await db.restocks.bulkPut(toPlain(inRestocks))
          }
          if (Array.isArray(inCashServices) && inCashServices.length > 0) {
            await db.cashServices.bulkPut(toPlain(inCashServices))
          }
          if (Array.isArray(inDigitalProducts) && inDigitalProducts.length > 0) {
            await db.digitalProducts.bulkPut(toPlain(inDigitalProducts))
          }
          if (Array.isArray(inFundMovements) && inFundMovements.length > 0) {
            await db.fundMovements.bulkPut(toPlain(inFundMovements))
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

        if (Array.isArray(inRestocks) && inRestocks.length > 0) {
          const existingRestocks = await db.restocks.toArray()
          const restockById = new Map(existingRestocks.map(r => [r.id, r]))
          const restockByNo = new Map(existingRestocks.filter(r => r.restockNumber).map(r => [r.restockNumber, r]))
          const usedRestockIds = new Set(existingRestocks.map(r => r.id))
          const toPutRestocks = []

          for (const rr of inRestocks) {
            if (effectiveCutoff > 0 && (rr.createdAt || 0) < effectiveCutoff) continue
            const localMatch = (rr.restockNumber && restockByNo.get(rr.restockNumber)) || restockById.get(rr.id)
            if (!localMatch) {
              const cleanRestock = toPlain(rr)
              if (!cleanRestock.id || usedRestockIds.has(cleanRestock.id)) {
                cleanRestock.id = generateUniqueId()
              }
              usedRestockIds.add(cleanRestock.id)
              toPutRestocks.push(cleanRestock)
            } else if ((rr.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutRestocks.push(toPlain({ ...rr, id: localMatch.id }))
            }
          }
          if (toPutRestocks.length > 0) await db.restocks.bulkPut(toPutRestocks)
        }

        if (Array.isArray(inCashServices) && inCashServices.length > 0) {
          const existingServices = await db.cashServices.toArray()
          const svcById = new Map(existingServices.map(s => [s.id, s]))
          const svcByNo = new Map(existingServices.filter(s => s.serviceNumber).map(s => [s.serviceNumber, s]))
          const usedSvcIds = new Set(existingServices.map(s => s.id))
          const toPutServices = []

          for (const rs of inCashServices) {
            if (effectiveCutoff > 0 && (rs.createdAt || 0) < effectiveCutoff) continue
            const localMatch = (rs.serviceNumber && svcByNo.get(rs.serviceNumber)) || svcById.get(rs.id)
            if (!localMatch) {
              const cleanSvc = toPlain(rs)
              if (!cleanSvc.id || usedSvcIds.has(cleanSvc.id)) {
                cleanSvc.id = generateUniqueId()
              }
              usedSvcIds.add(cleanSvc.id)
              toPutServices.push(cleanSvc)
            } else if ((rs.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutServices.push(toPlain({ ...rs, id: localMatch.id }))
            }
          }
          if (toPutServices.length > 0) await db.cashServices.bulkPut(toPutServices)
        }

        if (Array.isArray(inDigitalProducts) && inDigitalProducts.length > 0) {
          const existingDigitals = await db.digitalProducts.toArray()
          const digById = new Map(existingDigitals.map(d => [d.id, d]))
          const digByNo = new Map(existingDigitals.filter(d => d.digitalNumber).map(d => [d.digitalNumber, d]))
          const usedDigIds = new Set(existingDigitals.map(d => d.id))
          const toPutDigitals = []

          for (const rd of inDigitalProducts) {
            if (effectiveCutoff > 0 && (rd.createdAt || 0) < effectiveCutoff) continue
            const localMatch = (rd.digitalNumber && digByNo.get(rd.digitalNumber)) || digById.get(rd.id)
            if (!localMatch) {
              const cleanDig = toPlain(rd)
              if (!cleanDig.id || usedDigIds.has(cleanDig.id)) {
                cleanDig.id = generateUniqueId()
              }
              usedDigIds.add(cleanDig.id)
              toPutDigitals.push(cleanDig)
            } else if ((rd.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutDigitals.push(toPlain({ ...rd, id: localMatch.id }))
            }
          }
          if (toPutDigitals.length > 0) await db.digitalProducts.bulkPut(toPutDigitals)
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

        if (Array.isArray(inFundMovements) && inFundMovements.length > 0) {
          const existingMovements = await db.fundMovements.toArray()
          const fmById = new Map(existingMovements.map(m => [m.id, m]))
          const fmByNo = new Map(existingMovements.filter(m => m.movementNumber).map(m => [m.movementNumber, m]))
          const usedFmIds = new Set(existingMovements.map(m => m.id))
          const toPutMovements = []

          for (const rm of inFundMovements) {
            if (effectiveCutoff > 0 && (rm.createdAt || 0) < effectiveCutoff) continue
            const localMatch = (rm.movementNumber && fmByNo.get(rm.movementNumber)) || fmById.get(rm.id)
            if (!localMatch) {
              const cleanFm = toPlain(rm)
              if (!cleanFm.id || usedFmIds.has(cleanFm.id)) {
                cleanFm.id = generateUniqueId()
              }
              usedFmIds.add(cleanFm.id)
              toPutMovements.push(cleanFm)
            } else if ((rm.updatedAt || 0) >= (localMatch.updatedAt || 0)) {
              toPutMovements.push(toPlain({ ...rm, id: localMatch.id }))
            }
          }
          if (toPutMovements.length > 0) await db.fundMovements.bulkPut(toPutMovements)
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
        restockCount: inRestocks?.length || 0,
        cashServiceCount: inCashServices?.length || 0,
        digitalProductCount: inDigitalProducts?.length || 0,
        fundMovementCount: inFundMovements?.length || 0,
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

  // Hitung statistik barang terjual / tidak pernah terjual lintas histori penuh IndexedDB
  const getAllProductUsageStats = async (slowThresholdDays = 30) => {
    const allTx = await db.transactions.toArray()
    return buildProductUsageMap(products.value, allTx, Date.now(), slowThresholdDays)
  }

  // Atur ulang / reset data warung ke toko kosong (0 barang) atau katalog bawaan 300 barang populer
  const resetStoreData = async ({ mode = 'empty' } = {}) => {
    const now = Date.now()
    const cleanMode = mode === 'starter' ? 'starter' : 'empty'
    let starterCatalog = []
    let starterCustomers = [
      {
        id: 1,
        name: 'Umum',
        phone: '',
        totalDebt: 0,
        priceTier: 'ecer',
        lastDate: 'Hari ini',
        updatedAt: now,
        deleted: false
      }
    ]

    if (cleanMode === 'starter') {
      const seedMod = await import('../db/seedData')
      starterCatalog = seedMod.seedProducts.map(p => ({ ...p, updatedAt: now }))
      starterCustomers = seedMod.seedCustomers.map(c => ({ ...c, updatedAt: now }))
    }

    await db.transaction(
      'rw',
      [db.products, db.customers, db.transactions, db.debtPayments, db.expenses, db.restocks, db.cashServices, db.digitalProducts, db.fundMovements, db.shifts, db.settings],
      async () => {
        await Promise.all([
          db.products.clear(),
          db.customers.clear(),
          db.transactions.clear(),
          db.debtPayments.clear(),
          db.expenses.clear(),
          db.restocks.clear(),
          db.cashServices.clear(),
          db.digitalProducts.clear(),
          db.fundMovements.clear(),
          db.shifts.clear()
        ])

        if (starterCatalog.length > 0) {
          await db.products.bulkPut(toPlain(starterCatalog))
        }
        await db.customers.bulkPut(toPlain(starterCustomers))

        await db.settings.bulkPut([
          { key: 'categories', value: toPlain([...initialDefaultCategories]), updatedAt: now },
          { key: 'archiveState', value: { cutoffAt: 0 }, updatedAt: now },
          { key: 'lastOpeningCash', value: 0, updatedAt: now }
        ])
      }
    )

    archiveCutoffAt.value = 0
    lastOpeningCash.value = 0
    await refreshAllData()

    return {
      mode: cleanMode,
      productCount: starterCatalog.length,
      customerCount: starterCustomers.length
    }
  }

  return {
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
    unassignedTodayCount,
    totalTransactionCount,
    totalDebtPaymentCount,
    totalExpenseCount,
    totalRestockCount,
    totalCashServiceCount,
    totalDigitalProductCount,
    totalFundMovementCount,
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
