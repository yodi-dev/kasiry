import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Helper stub DOM download browser agar exportBackupJSON & archiveOldTransactions bisa diuji penuh di Node
const installDownloadStub = () => {
  const downloads = []
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:kasiry-test')
  globalThis.URL.revokeObjectURL = vi.fn()
  globalThis.document = {
    createElement: vi.fn(() => ({
      href: '',
      download: '',
      click: vi.fn(function onClick() {
        downloads.push(this.download)
      })
    })),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  }
  return downloads
}

describe('useKasiryDB (IndexedDB, Accounting, Windowing, Restore & Archive)', () => {
  let dbModule
  let kasiry
  let downloads

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    downloads = installDownloadStub()

    dbModule = await import('../src/db/index')
    await dbModule.db.open()
    await Promise.all(dbModule.db.tables.map(t => t.clear()))
    const { useKasiryDB } = await import('../src/composables/useKasiryDB')
    kasiry = useKasiryDB()
    kasiry.archiveCutoffAt.value = 0
    await kasiry.loadDatabase()
  })

  afterEach(() => {
    try {
      dbModule?.db?.close()
    } catch {
      // Abaikan jika sudah tertutup
    }
  })

  it('seeds initial warung catalog, customers, and settings cleanly', async () => {
    expect(kasiry.isDbReady.value).toBe(true)
    expect(kasiry.products.value.length).toBe(38)
    expect(kasiry.customers.value.length).toBe(5)
    expect(kasiry.customers.value.some(c => c.name === 'Umum')).toBe(true)
    expect(kasiry.storeProfile.value.name).toBe('Habiba Store')
    expect(kasiry.categories.value).toContain('Sembako')
  })

  it('records cash and bon transactions, caps overpayment debt, and guards Umum from bon debt', async () => {
    const prod = kasiry.products.value[0]
    await kasiry.recordTransaction({
      invoiceNumber: 'KSR-1001',
      totalAmount: prod.sellPrice,
      paymentMethod: 'TUNAI',
      cashGiven: prod.sellPrice + 5000,
      changeAmount: 5000,
      customer: { id: 1, name: 'Umum' },
      items: [{ ...prod, qty: 1 }]
    })
    expect(kasiry.totalTransactionCount.value).toBe(1)

    // Guard UTANG atas nama Umum tidak membuat utang
    await kasiry.recordTransaction({
      invoiceNumber: 'BON-BAD',
      totalAmount: 10000,
      paymentMethod: 'UTANG / BON',
      customer: { id: 1, name: 'Umum' },
      items: [{ ...prod, qty: 1 }]
    })
    const umum = kasiry.customers.value.find(c => c.name === 'Umum')
    expect(umum.totalDebt).toBe(0)

    // Catat BON ke pelanggan baru "Mas Andi"
    await kasiry.recordTransaction({
      invoiceNumber: 'BON-2001',
      totalAmount: 25000,
      paymentMethod: 'UTANG / BON',
      customer: { name: 'Mas Andi', phone: '08123456' },
      items: [{ ...prod, qty: 1 }]
    })
    const masAndi = kasiry.customers.value.find(c => c.name === 'Mas Andi')
    expect(masAndi).toBeTruthy()
    expect(masAndi.totalDebt).toBe(25000)

    // Cicilan Rp 10.000 tunai -> sisa Rp 15.000
    const pay1 = await kasiry.recordDebtPayment({ customerId: masAndi.id, amount: 10000, paymentMethod: 'TUNAI' })
    expect(pay1.appliedAmount).toBe(10000)
    expect(pay1.paymentMethod).toBe('TUNAI')
    expect(pay1.remainingDebt).toBe(15000)

    // Bayar dengan pecahan besar Rp 50.000 tunai -> appliedAmount hanya Rp 15.000 (sisa bon 0)
    const pay2 = await kasiry.recordDebtPayment({ customerId: masAndi.id, amount: 50000, paymentMethod: 'TUNAI' })
    expect(pay2.appliedAmount).toBe(15000)
    expect(pay2.remainingDebt).toBe(0)

    // Catat BON ke pelanggan lain & lunasi lewat QRIS -> paymentMethod tersimpan 'QRIS'
    await kasiry.recordTransaction({
      invoiceNumber: 'BON-QRIS-1',
      totalAmount: 40000,
      paymentMethod: 'UTANG / BON',
      customer: masAndi,
      items: [{ ...prod, qty: 1 }]
    })
    const payQris = await kasiry.recordDebtPayment({ customerId: masAndi.id, amount: 40000, paymentMethod: 'QRIS' })
    expect(payQris.appliedAmount).toBe(40000)
    expect(payQris.paymentMethod).toBe('QRIS')
    expect(payQris.remainingDebt).toBe(0)
    expect(kasiry.debtPayments.value[0].paymentMethod).toBe('QRIS')

    // Input tidak valid / <= 0 ditolak bersih
    expect(await kasiry.recordDebtPayment({ customerId: masAndi.id, amount: -500 })).toBeUndefined()
    expect(await kasiry.recordDebtPayment({ customerId: masAndi.id, amount: Number.NaN })).toBeUndefined()
  })

  it('protects categories in use and respects 90-day RAM window with multi-year indexed queries', async () => {
    const blocked = await kasiry.deleteCategory('Sembako')
    expect(blocked.success).toBe(false)

    await kasiry.addCategory('Jajanan Unik')
    expect(kasiry.categories.value).toContain('Jajanan Unik')
    const ok = await kasiry.deleteCategory('Jajanan Unik')
    expect(ok.success).toBe(true)

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    const buTejo = kasiry.customers.value.find(c => c.name === 'Bu Tejo')

    await dbModule.db.transactions.bulkAdd([
      {
        id: 800001,
        invoiceNumber: 'KSR-OLD-120D',
        createdAt: now - 120 * DAY,
        totalAmount: 40000,
        paymentMethod: 'TUNAI',
        customerId: buTejo.id,
        customerName: buTejo.name,
        items: [{ id: 1, name: 'Beras', sellPrice: 40000, buyPrice: 36000, qty: 1 }],
        updatedAt: now - 120 * DAY
      },
      {
        id: 800002,
        invoiceNumber: 'KSR-RECENT-5D',
        createdAt: now - 5 * DAY,
        totalAmount: 18000,
        paymentMethod: 'TUNAI',
        customerId: buTejo.id,
        customerName: buTejo.name,
        items: [{ id: 2, name: 'Minyak', sellPrice: 18000, buyPrice: 16000, qty: 1 }],
        updatedAt: now - 5 * DAY
      }
    ])

    await kasiry.refreshAllData()

    expect(kasiry.totalTransactionCount.value).toBe(2)
    expect(kasiry.transactions.value.length).toBe(1)
    expect(kasiry.transactions.value[0].invoiceNumber).toBe('KSR-RECENT-5D')
    expect(kasiry.olderTransactionCount.value).toBe(1)

    // Query riwayat 1 pelanggan menembus batas 90 hari lewat indeks customerId
    const fullBuTejo = await kasiry.getCustomerTransactions(buTejo.id, buTejo.name)
    expect(fullBuTejo.map(t => t.invoiceNumber)).toEqual(['KSR-RECENT-5D', 'KSR-OLD-120D'])

    // Query penuh ekspor Excel mengembalikan semua transaksi
    const fullExport = await kasiry.getAllTransactionsForExport()
    expect(fullExport.transactions).toHaveLength(2)
  })

  it('archives old transactions to JSON while keeping product catalog and customer debts intact', async () => {
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    const buTejoBefore = kasiry.customers.value.find(c => c.name === 'Bu Tejo')
    const initialDebt = buTejoBefore.totalDebt

    await dbModule.db.transactions.bulkAdd([
      {
        id: 900001,
        invoiceNumber: 'BON-ARCHIVE-200D',
        createdAt: now - 200 * DAY,
        totalAmount: 50000,
        paymentMethod: 'UTANG / BON',
        customerId: buTejoBefore.id,
        customerName: buTejoBefore.name,
        items: [],
        updatedAt: now - 200 * DAY
      },
      {
        id: 900002,
        invoiceNumber: 'KSR-ACTIVE-10D',
        createdAt: now - 10 * DAY,
        totalAmount: 15000,
        paymentMethod: 'TUNAI',
        customerId: 1,
        customerName: 'Umum',
        items: [],
        updatedAt: now - 10 * DAY
      }
    ])
    await dbModule.db.debtPayments.add({
      id: 900011,
      customerId: buTejoBefore.id,
      amount: 5000,
      paymentDate: now - 200 * DAY,
      updatedAt: now - 200 * DAY
    })
    await kasiry.refreshAllData()

    const preview = await kasiry.getArchivableSummary(180)
    expect(preview.txCount).toBe(1)
    expect(preview.payCount).toBe(1)

    const archiveRes = await kasiry.archiveOldTransactions(180)
    expect(archiveRes.archivedTxCount).toBe(1)
    expect(archiveRes.archivedPayCount).toBe(1)
    expect(archiveRes.archiveFilename).toMatch(/^Arsip_Habiba_Store_sd_\d{4}-\d{2}-\d{2}\.json$/)
    expect(downloads).toContain(archiveRes.archiveFilename)

    // Transaksi lama terhapus dari IndexedDB, transaksi baru tetap ada, utang & barang tetap 100% utuh
    expect(kasiry.totalTransactionCount.value).toBe(1)
    expect(kasiry.products.value.length).toBe(38)
    const buTejoAfter = kasiry.customers.value.find(c => c.name === 'Bu Tejo')
    expect(buTejoAfter.totalDebt).toBe(initialDebt)

    // Simulasikan sync cloud mencoba menghidupkan transaksi terarsip (honorArchiveCutoff: true -> terblokir)
    await kasiry.importBackupJSON(archiveRes.archivePayload, 'merge', { honorArchiveCutoff: true })
    expect(kasiry.totalTransactionCount.value).toBe(1)

    // Simulasikan restore file arsip manual oleh user (honorArchiveCutoff: false -> dipulihkan kembali)
    await kasiry.importBackupJSON(archiveRes.archivePayload, 'merge', { honorArchiveCutoff: false })
    expect(kasiry.totalTransactionCount.value).toBe(2)
  })

  it('records, soft-deletes, exports, merges, and archives expenses seamlessly', async () => {
    const exp1 = await kasiry.recordExpense({
      amount: 19000,
      category: 'operasional',
      source: 'TUNAI_LACI',
      note: 'Isi galon & kresek'
    })
    const exp2 = await kasiry.recordExpense({
      amount: 50000,
      category: 'prive',
      source: 'NON_TUNAI',
      note: 'Setor owner'
    })

    expect(exp1.expenseNumber).toMatch(/^KLR-/)
    expect(kasiry.expenses.value).toHaveLength(2)
    expect(kasiry.totalExpenseCount.value).toBe(2)

    // Input <= 0 atau tidak valid ditolak
    expect(await kasiry.recordExpense({ amount: 0 })).toBeUndefined()
    expect(await kasiry.recordExpense({ amount: -1000 })).toBeUndefined()

    // Soft-delete pengeluaran kedua
    const deleted = await kasiry.deleteExpense(exp2.id)
    expect(deleted).toBe(true)
    expect(kasiry.expenses.value).toHaveLength(1)
    expect(kasiry.totalExpenseCount.value).toBe(1)

    // Backup payload memuat daftar expenses & inspectBackupJSON mendeteksi jumlah aktif
    const payload = await kasiry.getFullDatabasePayload()
    expect(payload.data.expenses).toHaveLength(2)
    const inspected = kasiry.inspectBackupJSON(payload)
    expect(inspected.expenseCount).toBe(1)

    // Merge remote delete dengan updatedAt lebih baru tetap dihormati
    await kasiry.importBackupJSON({
      data: {
        expenses: [{ ...exp1, deleted: true, updatedAt: exp1.updatedAt + 5000 }]
      }
    }, 'merge')
    expect(kasiry.expenses.value).toHaveLength(0)

    // Arsip pengeluaran lama > 180 hari bersih tanpa mengganggu data barang
    const oldTs = Date.now() - 200 * 24 * 60 * 60 * 1000
    await kasiry.recordExpense({
      amount: 12000,
      category: 'transport',
      source: 'TUNAI_LACI',
      note: 'Bensin lama',
      createdAt: oldTs
    })
    const archiveSummary = await kasiry.getArchivableSummary(180)
    expect(archiveSummary.expenseCount).toBe(1)
    const archiveRes = await kasiry.archiveOldTransactions(180)
    expect(archiveRes.archivedExpenseCount).toBe(1)
    expect(kasiry.totalExpenseCount.value).toBe(0)
  })

  it('opens shift with unassigned today adoption, tags records, and closes shift with cash reconciliation', async () => {
    const prod = kasiry.products.value[0]
    // Simulasikan lupa klik Buka Shift -> jualan & kas keluar berjalan dulu hari ini
    await kasiry.recordTransaction({
      invoiceNumber: 'KSR-PRE-1',
      totalAmount: 25000,
      paymentMethod: 'TUNAI',
      cashGiven: 50000,
      changeAmount: 25000,
      customer: { id: 1, name: 'Umum' },
      items: [{ ...prod, sellPrice: 25000, buyPrice: 20000, qty: 1 }]
    })
    await kasiry.recordExpense({
      amount: 5000,
      category: 'operasional',
      source: 'TUNAI_LACI',
      note: 'Plastik pagi'
    })
    expect(kasiry.unassignedTodayCount.value).toBe(2)

    // Buka shift sambil mengadopsi 2 catatan hari ini
    const opened = await kasiry.openShift({
      cashierName: 'Mbak Siti',
      openingCash: 200000,
      adoptUnassignedToday: true
    })
    expect(opened.status).toBe('OPEN')
    expect(opened.shiftCode).toMatch(/^SHF-/)
    expect(kasiry.activeShift.value?.id).toBe(opened.id)
    expect(kasiry.lastOpeningCash.value).toBe(200000)
    expect(kasiry.unassignedTodayCount.value).toBe(0)
    expect(kasiry.transactions.value[0].shiftCode).toBe(opened.shiftCode)
    expect(kasiry.expenses.value[0].shiftCode).toBe(opened.shiftCode)

    // Tambah 1 transaksi QRIS saat shift sudah aktif
    await kasiry.recordTransaction({
      invoiceNumber: 'QRS-SHIFT-2',
      totalAmount: 30000,
      paymentMethod: 'QRIS',
      cashGiven: 30000,
      changeAmount: 0,
      customer: { id: 1, name: 'Umum' },
      items: [{ ...prod, sellPrice: 30000, buyPrice: 25000, qty: 1 }]
    })
    expect(kasiry.transactions.value[0].shiftId).toBe(opened.id)

    // Expected laci = 200.000 modal + 25.000 tunai - 5.000 keluar laci = 220.000 (QRIS tidak masuk laci)
    const closed = await kasiry.closeShift({
      shiftId: opened.id,
      actualCash: 222000,
      closingNote: 'Lebih dua ribu'
    })
    expect(closed.status).toBe('CLOSED')
    expect(closed.expectedCash).toBe(220000)
    expect(closed.actualCash).toBe(222000)
    expect(closed.cashDifference).toBe(2000)
    expect(closed.summary.todayQrisTotal).toBe(30000)
    expect(kasiry.activeShift.value).toBeNull()

    // Full backup payload & inspectBackupJSON mendeteksi 1 shift
    const payload = await kasiry.getFullDatabasePayload()
    expect(payload.data.shifts).toHaveLength(1)
    expect(kasiry.inspectBackupJSON(payload).shiftCount).toBe(1)
  })

  it('saves multi-tier product prices and customer priceTier (guarding Umum as ecer)', async () => {
    const savedProd = await kasiry.saveProduct({
      name: 'Indomie Special Test',
      sellPrice: 3500,
      buyPrice: 3000,
      wholesalePrice: 3200,
      wholesaleMinQty: 5,
      agentPrice: 3050,
      category: 'Makanan'
    })
    expect(savedProd.wholesalePrice).toBe(3200)
    expect(savedProd.wholesaleMinQty).toBe(5)
    expect(savedProd.agentPrice).toBe(3050)

    const agenCust = await kasiry.saveCustomer({
      name: 'Warung Maju',
      phone: '081234567899',
      priceTier: 'agen'
    })
    expect(agenCust.priceTier).toBe('agen')

    // Akun Umum tetap dikunci pada tier 'ecer'
    const umumBefore = kasiry.customers.value.find(c => c.name === 'Umum')
    const umumUpdated = await kasiry.saveCustomer({ ...umumBefore, priceTier: 'agen' })
    expect(umumUpdated.priceTier).toBe('ecer')

    await kasiry.recordTransaction({
      invoiceNumber: 'KSR-MULTI-1',
      totalAmount: 15250,
      paymentMethod: 'TUNAI',
      cashGiven: 20000,
      changeAmount: 4750,
      customer: agenCust,
      items: [{
        ...savedProd,
        sellPrice: 3050,
        baseSellPrice: 3500,
        qty: 5,
        appliedTier: 'agen',
        tierLabel: 'Agen'
      }]
    })
    expect(kasiry.transactions.value[0].items[0].priceTier).toBe('agen')
    expect(kasiry.transactions.value[0].items[0].priceLabel).toBe('Agen')
  })

  it('handles soft non-blocking stock, restocks across funding sources, linked expenses, and safe rollback delete', async () => {
    // 1. Produk dengan stok lunak awal = 2 dan produk kedua tanpa pelacakan stok (null)
    const trackedProd = await kasiry.saveProduct({
      name: 'Minyak Goreng 1L',
      sellPrice: 18000,
      buyPrice: 15000,
      stock: 2,
      category: 'Sembako'
    })
    const untrackedProd = await kasiry.saveProduct({
      name: 'Es Batu',
      sellPrice: 2000,
      buyPrice: 1000,
      stock: '',
      category: 'Minuman'
    })
    expect(trackedProd.stock).toBe(2)
    expect(untrackedProd.stock).toBeNull()

    // 2. Beli melebihi sisa stok (qty 5 > stock 2) -> TIDAK BOLEH memblokir checkout, stok berhenti di 0
    await kasiry.recordTransaction({
      invoiceNumber: 'KSR-OVER-1',
      totalAmount: 94000,
      paymentMethod: 'TUNAI',
      cashGiven: 100000,
      changeAmount: 6000,
      customer: { id: 1, name: 'Umum' },
      items: [
        { ...trackedProd, qty: 5 },
        { ...untrackedProd, qty: 2 }
      ]
    })
    const afterSaleTracked = kasiry.products.value.find(p => p.id === trackedProd.id)
    const afterSaleUntracked = kasiry.products.value.find(p => p.id === untrackedProd.id)
    expect(afterSaleTracked.stock).toBe(0)
    expect(afterSaleUntracked.stock).toBeNull()

    // Transaksi saat stok sudah 0 juga tetap berjalan mulus (soft/non-blocking)
    await expect(kasiry.recordTransaction({
      invoiceNumber: 'KSR-ZERO-2',
      totalAmount: 18000,
      paymentMethod: 'TUNAI',
      cashGiven: 20000,
      changeAmount: 2000,
      customer: { id: 1, name: 'Umum' },
      items: [{ ...afterSaleTracked, qty: 1 }]
    })).resolves.toBeTruthy()

    // 3. Kulakan Tunai dari Laci: tambah stok + update modal/jual + buat kas keluar kategori 'kulakan'
    const res1 = await kasiry.recordRestock({
      supplierName: 'Agen Sumber Rezeki',
      source: 'TUNAI_LACI',
      note: 'Nota kulakan #1',
      items: [
        {
          productId: trackedProd.id,
          productName: trackedProd.name,
          qty: 12,
          unitBuyPrice: 16000,
          newSellPrice: 19000,
          trackStock: true
        }
      ]
    })
    expect(res1.restock.restockNumber).toMatch(/^KLK-/)
    expect(res1.restock.totalCost).toBe(192000)
    expect(res1.expense).toBeTruthy()
    expect(res1.expense.category).toBe('kulakan')
    expect(res1.expense.amount).toBe(192000)
    expect(kasiry.expenses.value.some(e => e.id === res1.expense.id)).toBe(true)

    const updatedTracked = kasiry.products.value.find(p => p.id === trackedProd.id)
    expect(updatedTracked.stock).toBe(12)
    expect(updatedTracked.buyPrice).toBe(16000)
    expect(updatedTracked.sellPrice).toBe(19000)

    // 4. Kulakan dari Dana Luar / Pribadi Owner: TIDAK membuat catatan kas keluar di laci
    const prevExpCount = kasiry.expenses.value.length
    const resDanaLuar = await kasiry.recordRestock({
      supplierName: 'Owner',
      source: 'DANA_LUAR',
      items: [
        {
          productId: untrackedProd.id,
          productName: untrackedProd.name,
          qty: 10,
          unitBuyPrice: 1000,
          trackStock: true
        }
      ]
    })
    expect(resDanaLuar.expense).toBeNull()
    expect(kasiry.expenses.value).toHaveLength(prevExpCount)
    expect(kasiry.products.value.find(p => p.id === untrackedProd.id).stock).toBe(10)

    // 5. Inspect backup menyertakan restockCount
    const payload = await kasiry.getFullDatabasePayload()
    expect(payload.data.restocks).toHaveLength(2)
    expect(kasiry.inspectBackupJSON(payload).restockCount).toBe(2)

    // 6. Hapus nota kulakan pertama -> soft delete nota + linked expense + rollback stok & harga modal/jual
    const deletedOk = await kasiry.deleteRestock(res1.restock.id)
    expect(deletedOk).toBe(true)
    expect(kasiry.restocks.value).toHaveLength(1)
    expect(kasiry.expenses.value.some(e => e.id === res1.expense.id)).toBe(false)
    const rolledBack = kasiry.products.value.find(p => p.id === trackedProd.id)
    expect(rolledBack.stock).toBe(0)
    expect(rolledBack.buyPrice).toBe(15000)
    expect(rolledBack.sellPrice).toBe(18000)
  })
})
