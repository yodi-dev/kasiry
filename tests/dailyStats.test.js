import { describe, it, expect } from 'vitest'
import { computeDailyStats } from '../src/utils/dailyStats'

describe('computeDailyStats (Separation of Cash Drawer, QRIS Non-Cash, and Bon)', () => {
  it('separates TUNAI, QRIS, UTANG/BON sales and TUNAI vs QRIS debt repayments accurately', () => {
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000

    const transactions = [
      {
        invoiceNumber: 'KSR-1',
        createdAt: now,
        paymentMethod: 'TUNAI',
        totalAmount: 50000,
        items: [{ name: 'Beras', sellPrice: 50000, buyPrice: 45000, qty: 1 }]
      },
      {
        invoiceNumber: 'QRS-2',
        createdAt: now,
        paymentMethod: 'QRIS',
        totalAmount: 30000,
        items: [{ name: 'Minyak', sellPrice: 15000, buyPrice: 13000, qty: 2 }]
      },
      {
        invoiceNumber: 'BON-3',
        createdAt: now,
        paymentMethod: 'UTANG / BON',
        totalAmount: 20000,
        items: [{ name: 'Telur', sellPrice: 20000, buyPrice: 17000, qty: 1 }]
      },
      {
        invoiceNumber: 'QRS-OLD',
        createdAt: yesterday,
        paymentMethod: 'QRIS',
        totalAmount: 99000,
        items: [{ name: 'Gas', sellPrice: 99000, buyPrice: 90000, qty: 1 }]
      }
    ]

    const debtPayments = [
      { customerId: 2, amount: 15000, paymentDate: now }, // legacy record tanpa paymentMethod -> TUNAI
      { customerId: 3, amount: 40000, paymentMethod: 'QRIS', paymentDate: now },
      { customerId: 4, amount: 10000, paymentMethod: 'QRIS', paymentDate: yesterday }
    ]

    const stats = computeDailyStats(transactions, debtPayments, now)

    expect(stats.transactionCount).toBe(3)
    expect(stats.todayCashSales).toBe(50000)
    expect(stats.todayQrisSales).toBe(30000)
    expect(stats.todaySales).toBe(80000)
    expect(stats.todayNewDebt).toBe(20000)

    expect(stats.todayDebtPaidCash).toBe(15000)
    expect(stats.todayDebtPaidQris).toBe(40000)
    expect(stats.todayDebtPaid).toBe(55000)

    // Uang fisik laci hanya penjumlahan Tunai + Pelunasan Bon Tunai
    expect(stats.todayCashDrawer).toBe(65000)
    // Uang non-tunai QRIS hanya penjumlahan QRIS penjualan + Pelunasan Bon QRIS
    expect(stats.todayQrisTotal).toBe(70000)

    // Total estimasi laba bersih = 5000 + 4000 + 3000 = 12000
    expect(stats.todayProfit).toBe(12000)
    expect(stats.topProducts[0]).toEqual({ name: 'Minyak', qty: 2, subtotal: 30000 })
  })
})
