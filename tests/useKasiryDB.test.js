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
})
