import Dexie from 'dexie'
import { seedProducts, seedCustomers, seedSettings } from './seedData'

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

    this.products = this.table('products')
    this.transactions = this.table('transactions')
    this.transactionItems = this.table('transactionItems')
    this.customers = this.table('customers')
    this.debtPayments = this.table('debtPayments')
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

// Inisialisasi Seed Data Otomatis jika database masih kosong
export async function initDatabase() {
  await ensureStoragePersistence()
  
  const productCount = await db.products.count()
  if (productCount === 0) {
    console.log('[Kasiry DB] Inisialisasi katalog bawaan warung...')
    await db.products.bulkAdd(seedProducts)
  }

  const customerCount = await db.customers.count()
  if (customerCount === 0) {
    console.log('[Kasiry DB] Inisialisasi buku utang awal...')
    await db.customers.bulkAdd(seedCustomers)
  }

  const settingsCount = await db.settings.count()
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
