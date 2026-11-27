import { describe, it, expect } from 'vitest'
import {
  computeDailyStats,
  computeShiftClosingPreview,
  formatShiftWhatsAppText
} from '../src/utils/dailyStats'

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

  it('deducts cash drawer expenses cleanly and isolates prive from operating profit', () => {
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000

    const transactions = [
      {
        invoiceNumber: 'KSR-1',
        createdAt: now,
        paymentMethod: 'TUNAI',
        totalAmount: 100000,
        items: [{ name: 'Beras', sellPrice: 100000, buyPrice: 80000, qty: 1 }] // laba kotor 20.000
      },
      {
        invoiceNumber: 'QRS-1',
        createdAt: now,
        paymentMethod: 'QRIS',
        totalAmount: 50000,
        items: [{ name: 'Minyak', sellPrice: 50000, buyPrice: 40000, qty: 1 }] // laba kotor 10.000
      }
    ]

    const expenses = [
      { id: 1, expenseNumber: 'KLR-1', createdAt: now, amount: 5000, category: 'operasional', source: 'TUNAI_LACI', deleted: false },
      { id: 2, expenseNumber: 'KLR-2', createdAt: now, amount: 25000, category: 'prive', source: 'TUNAI_LACI', deleted: false },
      { id: 3, expenseNumber: 'KLR-3', createdAt: now, amount: 10000, category: 'transport', source: 'NON_TUNAI', deleted: false },
      { id: 4, expenseNumber: 'KLR-DEL', createdAt: now, amount: 99000, category: 'operasional', source: 'TUNAI_LACI', deleted: true },
      { id: 5, expenseNumber: 'KLR-OLD', createdAt: yesterday, amount: 88000, category: 'operasional', source: 'TUNAI_LACI', deleted: false }
    ]

    const stats = computeDailyStats(transactions, [], expenses, now)

    expect(stats.todayExpenseCount).toBe(3)
    expect(stats.todayExpensesCash).toBe(30000) // 5.000 ops + 25.000 prive
    expect(stats.todayExpensesNonCash).toBe(10000)
    expect(stats.todayExpensesTotal).toBe(40000)
    expect(stats.todayPriveTotal).toBe(25000)
    expect(stats.todayOperationalExpenses).toBe(15000) // 5.000 ops + 10.000 transport

    // Laci tunai = 100.000 - 30.000 = 70.000; Non-tunai = 50.000 - 10.000 = 40.000
    expect(stats.todayCashDrawer).toBe(100000)
    expect(stats.todayNetCashDrawer).toBe(70000)
    expect(stats.todayNetQris).toBe(40000)

    // Laba kotor 30.000 - biaya ops 15.000 = 15.000 (prive 25.000 tidak memotong untung jualan)
    expect(stats.todayGrossProfit).toBe(30000)
    expect(stats.todayProfit).toBe(15000)
  })

  it('scopes stats cleanly to active shift across midnight and computes closing drawer variance', () => {
    const activeShift = {
      id: 77,
      shiftCode: 'SHF-77',
      cashierName: 'Ibu Habiba',
      openingCash: 200000,
      openedAt: 1700070000000, // buka malam
      status: 'OPEN'
    }
    const transactions = [
      // Transaksi dari shift sebelumnya yang sudah tutup -> TIDAK BOLEH masuk hitungan shift aktif
      {
        invoiceNumber: 'KSR-PREV',
        createdAt: 1700060000000,
        paymentMethod: 'TUNAI',
        totalAmount: 90000,
        shiftId: 66,
        shiftCode: 'SHF-66',
        items: [{ name: 'Gula', sellPrice: 90000, buyPrice: 80000, qty: 1 }]
      },
      // Transaksi shift aktif (termasuk setelah lewat tengah malam)
      {
        invoiceNumber: 'KSR-NOW-1',
        createdAt: 1700090000000,
        paymentMethod: 'TUNAI',
        totalAmount: 50000,
        shiftId: 77,
        shiftCode: 'SHF-77',
        items: [{ name: 'Beras', sellPrice: 50000, buyPrice: 43000, qty: 1 }]
      },
      {
        invoiceNumber: 'QRS-NOW-2',
        createdAt: 1700095000000,
        paymentMethod: 'QRIS',
        totalAmount: 30000,
        shiftId: 77,
        shiftCode: 'SHF-77',
        items: [{ name: 'Minyak', sellPrice: 30000, buyPrice: 25000, qty: 1 }]
      }
    ]
    const debtPayments = [
      { customerId: 2, amount: 20000, paymentMethod: 'TUNAI', paymentDate: 1700092000000, shiftId: 77, shiftCode: 'SHF-77' }
    ]
    const expenses = [
      { id: 1, expenseNumber: 'KLR-1', createdAt: 1700093000000, amount: 15000, category: 'operasional', source: 'TUNAI_LACI', shiftId: 77, shiftCode: 'SHF-77', deleted: false }
    ]

    const scoped = computeDailyStats(transactions, debtPayments, expenses, {
      activeShift,
      nowTs: 1700100000000
    })
    expect(scoped.isShiftScoped).toBe(true)
    expect(scoped.transactionCount).toBe(2)
    expect(scoped.openingCash).toBe(200000)
    expect(scoped.todayCashDrawer).toBe(70000) // 50k tunai + 20k bon tunai
    expect(scoped.todayExpensesCash).toBe(15000)
    // Seharusnya di laci = 200.000 modal + 70.000 masuk - 15.000 keluar = 255.000
    expect(scoped.expectedCashDrawer).toBe(255000)

    const preview = computeShiftClosingPreview({
      shift: activeShift,
      transactions,
      debtPayments,
      expenses,
      actualCash: 250000
    })
    expect(preview.expectedCash).toBe(255000)
    expect(preview.actualCash).toBe(250000)
    expect(preview.cashDifference).toBe(-5000)

    const waText = formatShiftWhatsAppText({
      ...activeShift,
      closedAt: 1700100000000,
      expectedCash: preview.expectedCash,
      actualCash: preview.actualCash,
      cashDifference: preview.cashDifference,
      closingNote: 'Uang kembalian kurang',
      summary: preview
    }, 'Habiba Store')
    expect(waText).toContain('SHF-77')
    expect(waText).toContain('Kurang -Rp 5.000')
  })

  it('deducts kulakan expenses from drawer/non-cash balance without double-cutting operating profit', () => {
    const now = Date.now()
    const transactions = [
      {
        invoiceNumber: 'KSR-10',
        createdAt: now,
        paymentMethod: 'TUNAI',
        totalAmount: 200000,
        items: [{ name: 'Beras', sellPrice: 200000, buyPrice: 170000, qty: 1 }] // laba kotor 30.000
      }
    ]
    const expenses = [
      { id: 1, expenseNumber: 'KLR-KUL1', createdAt: now, amount: 120000, category: 'kulakan', source: 'TUNAI_LACI', deleted: false },
      { id: 2, expenseNumber: 'KLR-OPS1', createdAt: now, amount: 5000, category: 'operasional', source: 'TUNAI_LACI', deleted: false }
    ]

    const stats = computeDailyStats(transactions, [], expenses, now)
    expect(stats.todayExpensesCash).toBe(125000)
    expect(stats.todayNetCashDrawer).toBe(75000) // 200.000 - 120.000 kulakan - 5.000 ops
    expect(stats.todayOperationalExpenses).toBe(5000) // hanya biaya ops; kulakan non-biaya
    expect(stats.todayProfit).toBe(25000) // 30.000 laba kotor - 5.000 ops
  })
})
