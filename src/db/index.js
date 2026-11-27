import Dexie from 'dexie'

export class KasiryDatabase extends Dexie {
  constructor() {
    super('KasiryDB')
    
    // Schema Version 1
    // Indeks dengan & adalah unik, yang lain adalah indeks pencarian
    // Setiap tabel memiliki `updatedAt` untuk keselarasan sinkronisasi multi-device Google Drive/Sheets
    this.version(1).stores({
      products: '++id, barcode, name, category, isMacro, updatedAt, deleted',
      transactions: '++id, invoiceNumber, createdAt, paymentMethod, customerId, updatedAt',
      transactionItems: '++id, transactionId, productId, updatedAt',
      customers: '++id, name, phone, totalDebt, updatedAt, deleted',
      debtPayments: '++id, customerId, paymentDate, updatedAt',
      settings: 'key, updatedAt'
    })

    // Schema Version 2: Bersihkan tabel legacy transactionItems (item transaksi sudah disimpan inline di transactions.items)
    this.version(2).stores({
      transactionItems: null
    })

    // Schema Version 3: Tabel expenses untuk pencatatan kas keluar / pengeluaran harian
    this.version(3).stores({
      expenses: '++id, expenseNumber, createdAt, category, source, updatedAt, deleted'
    })

    // Schema Version 4: Tabel shifts untuk sistem buka & tutup shift / tutup buku harian
    this.version(4).stores({
      shifts: '++id, shiftCode, status, openedAt, closedAt, updatedAt, deleted'
    })

    // Schema Version 5: Tabel restocks untuk pencatatan kulakan / belanja stok barang
    this.version(5).stores({
      restocks: '++id, restockNumber, createdAt, source, supplierName, updatedAt, deleted'
    })

    // Schema Version 6: Tabel cashServices untuk layanan tarik tunai & transfer / top-up
    this.version(6).stores({
      cashServices: '++id, serviceNumber, createdAt, type, cashSource, shiftId, updatedAt, deleted'
    })

    // Schema Version 7: Tabel digitalProducts untuk penjualan Pulsa, Paket Data & Token Listrik PLN
    this.version(7).stores({
      digitalProducts: '++id, digitalNumber, createdAt, category, paymentMethod, customerId, shiftId, updatedAt, deleted'
    })

    // Schema Version 8: Tabel fundMovements untuk Manajemen Keuangan (Uang Kas, Rekening, Tabungan & Mutasi)
    this.version(8).stores({
      fundMovements: '++id, movementNumber, createdAt, type, fromAccount, toAccount, shiftId, updatedAt, deleted'
    })

    this.products = this.table('products')
    this.transactions = this.table('transactions')
    this.customers = this.table('customers')
    this.debtPayments = this.table('debtPayments')
    this.expenses = this.table('expenses')
    this.shifts = this.table('shifts')
    this.restocks = this.table('restocks')
    this.cashServices = this.table('cashServices')
    this.digitalProducts = this.table('digitalProducts')
    this.fundMovements = this.table('fundMovements')
    this.settings = this.table('settings')
  }
}

export const db = new KasiryDatabase()

// Mencegah peramban menghapus IndexedDB saat memori HP menipis
export async function ensureStoragePersistence() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted()
      if (!isPersisted) {
        const granted = await navigator.storage.persist()
        console.log(`[Kasiry DB] Storage persistence granted: ${granted}`)
      }
    } catch (e) {
      console.warn('[Kasiry DB] Storage persistence request failed', e)
    }
  }
}

// Inisialisasi Seed Data Otomatis secara dinamis hanya saat database masih kosong
export async function initDatabase() {
  await ensureStoragePersistence()

  const [productCount, customerCount, settingsCount] = await Promise.all([
    db.products.count(),
    db.customers.count(),
    db.settings.count()
  ])

  if (productCount === 0 || customerCount === 0 || settingsCount === 0) {
    const { seedProducts, seedCustomers, seedSettings } = await import('./seedData')

    if (productCount === 0) {
      console.log('[Kasiry DB] Inisialisasi katalog bawaan warung (300 barang)...')
      await db.products.bulkAdd(seedProducts)
    }

    if (customerCount === 0) {
      console.log('[Kasiry DB] Inisialisasi akun pelanggan dasar...')
      await db.customers.bulkAdd(seedCustomers)
    }

    if (settingsCount === 0) {
      for (const [key, value] of Object.entries(seedSettings)) {
        await db.settings.put({
          key,
          value,
          updatedAt: Date.now()
        })
      }
    }
  }
}
