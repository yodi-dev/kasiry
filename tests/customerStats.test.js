import { describe, it, expect } from 'vitest'
import { buildCustomerStatsMap } from '../src/utils/customerStats'

describe('buildCustomerStatsMap', () => {
  it('handles empty and malformed transaction arrays gracefully', () => {
    const emptyMap = buildCustomerStatsMap([])
    expect(emptyMap.getStats({ id: 1, name: 'Umum' })).toEqual({ count: 0, totalSpent: 0 })

    const partialMap = buildCustomerStatsMap([null, undefined, { totalAmount: 5000 }])
    expect(partialMap.getStats(null)).toEqual({ count: 0, totalSpent: 0 })
    expect(partialMap.getStats({ id: 99, name: 'Anon' })).toEqual({ count: 0, totalSpent: 0 })
  })

  it('aggregates by customerId and falls back to trimmed case-insensitive name without double counting', () => {
    const txs = [
      { customerId: 10, customerName: 'Bu Tejo', totalAmount: 25000 },
      { customerId: 10, customerName: 'Bu Tejo Lama', totalAmount: 15000 },
      { customerId: null, customerName: '  bu tejo ', totalAmount: 10000 },
      { customer: { id: 20, name: 'Pak RT' }, totalAmount: 50000 },
      { customer: { name: 'PAK RT' }, totalAmount: 12000 }
    ]

    const stats = buildCustomerStatsMap(txs)
    expect(stats.getStats({ id: 10, name: 'Bu Tejo' })).toEqual({
      count: 3,
      totalSpent: 50000
    })
    expect(stats.getStats({ id: 20, name: 'Pak RT' })).toEqual({
      count: 2,
      totalSpent: 62000
    })
  })

  it('computes stats across 50,000 transactions and 300 customers in single O(N) pass cleanly', () => {
    const customers = Array.from({ length: 300 }, (_, i) => ({
      id: i + 1,
      name: `Pelanggan ${i + 1}`
    }))

    const txs = []
    let expectedTopCount = 0
    let expectedTopTotal = 0

    for (let i = 0; i < 50000; i++) {
      const c = customers[i % 300]
      const byNameOnly = i % 7 === 0
      const amt = byNameOnly ? 10000 : 15000
      if (c.id === 1) {
        expectedTopCount += 1
        expectedTopTotal += amt
      }
      txs.push(
        byNameOnly
          ? { customerName: c.name, totalAmount: amt }
          : { customerId: c.id, totalAmount: amt }
      )
    }

    const map = buildCustomerStatsMap(txs)
    const c1 = map.getStats(customers[0])
    expect(c1.count).toBe(expectedTopCount)
    expect(c1.totalSpent).toBe(expectedTopTotal)
    expect(map.getStats(customers[299]).count).toBe(166)
  })
})
