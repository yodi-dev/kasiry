import { describe, it, expect } from 'vitest'
import { buildProductUsageMap } from '../src/utils/productUsage'

describe('buildProductUsageMap (Unpriced, Unsold & Slow-Moving Catalog Analytics)', () => {
  it('identifies unpriced, never-sold, and slow-moving (>= 30 days) products across multi-year history', () => {
    const now = 1_750_000_000_000
    const DAY = 24 * 60 * 60 * 1000

    const products = [
      { id: 1, name: 'Beras 5kg', sellPrice: 70000, deleted: false },
      { id: 2, name: 'Keripik Sepi', sellPrice: 8000, deleted: false },
      { id: 3, name: 'Sabun Mati', sellPrice: 5000, deleted: false },
      { id: 4, name: 'Gula Starter Baru', sellPrice: 0, deleted: false },
      { id: 5, name: 'Barang Terhapus', sellPrice: 10000, deleted: true }
    ]

    const transactions = [
      {
        invoiceNumber: 'KSR-1',
        createdAt: now - 3 * DAY,
        items: [{ id: 1, name: 'Beras 5kg', qty: 4 }]
      },
      {
        invoiceNumber: 'KSR-OLD',
        createdAt: now - 45 * DAY,
        items: [{ id: 2, name: 'Keripik Sepi', qty: 2 }]
      }
    ]

    const result = buildProductUsageMap(products, transactions, now, 30)

    expect(result.unpricedCount).toBe(1)
    expect(result.neverSoldCount).toBe(2) // id 3 & id 4
    expect(result.slowMovingCount).toBe(1) // id 2 (>= 30 hari lalu)

    expect(result.byId[1]).toMatchObject({
      totalQtySold: 4,
      txCount: 1,
      isUnpriced: false,
      isNeverSold: false,
      isSlowMoving: false
    })
    expect(result.byId[2]).toMatchObject({
      totalQtySold: 2,
      txCount: 1,
      isNeverSold: false,
      isSlowMoving: true
    })
    expect(result.byId[3]).toMatchObject({
      totalQtySold: 0,
      txCount: 0,
      isUnpriced: false,
      isNeverSold: true,
      isSlowMoving: false
    })
    expect(result.byId[4].isUnpriced).toBe(true)
    expect(result.byId[5]).toBeUndefined()
  })
})
