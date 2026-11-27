import Dexie from 'dexie'
import { describe, it, expect } from 'vitest'

describe('KasiryDB v1 -> v7 IndexedDB Schema Migration', () => {
  it('upgrades existing v1 database seamlessly to v7, removes transactionItems, and creates expenses, shifts, restocks, cashServices, & digitalProducts tables', async () => {
    // 1. Buat database legacy v1 yang masih memiliki tabel transactionItems
    const legacyDb = new Dexie('KasiryDB')
    legacyDb.version(1).stores({
      products: '++id, barcode, name, category, isMacro, updatedAt, deleted',
      transactions: '++id, invoiceNumber, createdAt, paymentMethod, customerId, updatedAt',
      transactionItems: '++id, transactionId, productId, updatedAt',
      customers: '++id, name, phone, totalDebt, updatedAt, deleted',
      debtPayments: '++id, customerId, paymentDate, updatedAt',
      settings: 'key, updatedAt'
    })

    await legacyDb.open()
    await legacyDb.table('products').add({
      id: 101,
      barcode: '899000111222',
      name: 'Beras Lama 5kg',
      category: 'Sembako',
      sellPrice: 68000,
      buyPrice: 63000,
      isMacro: true,
      updatedAt: 1700000000000,
      deleted: false
    })
    await legacyDb.table('transactionItems').add({
      id: 1,
      transactionId: 1,
      productId: 101,
      updatedAt: 1700000000000
    })
    legacyDb.close()

    // 2. Buka memakai instance v7 resmi aplikasi
    const { db } = await import('../src/db/index')
    await db.open()

    expect(db.verno).toBe(7)
    expect(db.tables.some(t => t.name === 'transactionItems')).toBe(false)
    expect(db.tables.some(t => t.name === 'expenses')).toBe(true)
    expect(db.tables.some(t => t.name === 'shifts')).toBe(true)
    expect(db.tables.some(t => t.name === 'restocks')).toBe(true)
    expect(db.tables.some(t => t.name === 'cashServices')).toBe(true)
    expect(db.tables.some(t => t.name === 'digitalProducts')).toBe(true)

    // Data existing tetap selamat 100%
    const existingProd = await db.products.get(101)
    expect(existingProd?.name).toBe('Beras Lama 5kg')
    await db.delete()
  })
})
