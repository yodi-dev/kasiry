import { describe, it, expect } from 'vitest'
import { computeFinanceBalances, computePeriodFinanceSummary } from '../src/utils/financeEngine'

describe('financeEngine (4 Pocket Balances & Multi-Period Summary)', () => {
  it('computes LACI, KAS, REKENING, TABUNGAN, receivables, and Net Wealth across all inflows & fundMovements', () => {
    const now = Date.now()
    const transactions = [
      {
        invoiceNumber: 'KSR-1',
        createdAt: now,
        paymentMethod: 'TUNAI',
        totalAmount: 100000,
        items: [{ name: 'Beras', sellPrice: 100000, buyPrice: 80000, qty: 1 }]
      },
      {
        invoiceNumber: 'QRS-1',
        createdAt: now,
        paymentMethod: 'QRIS',
        totalAmount: 50000,
        items: [{ name: 'Minyak', sellPrice: 50000, buyPrice: 40000, qty: 1 }]
      }
    ]
    const cashServices = [
      // Tarik Tunai dari Laci: Rekening +105.000, Admin +5.000
      { id: 1, createdAt: now, type: 'TARIK_TUNAI', cashSource: 'LACI', amount: 100000, adminFee: 5000, deleted: false },
      // Transfer masuk ke Uang Kas: Uang Kas +63.000, Rekening -60.000, Admin +3.000
      { id: 2, createdAt: now, type: 'TRANSFER', cashSource: 'KAS', amount: 60000, adminFee: 3000, deleted: false }
    ]
    const fundMovements = [
      // Setor modal awal ke Uang Kas dari Luar: KAS +500.000
      { id: 1, createdAt: now, type: 'SETOR_MODAL', fromAccount: 'LUAR', toAccount: 'KAS', amount: 500000, deleted: false },
      // Tambah Tabungan dari Rekening 40.000 & dari Laci 30.000: TABUNGAN +70.000
      { id: 2, createdAt: now, type: 'TAMBAH_TABUNGAN', fromAccount: 'REKENING', toAccount: 'TABUNGAN', amount: 40000, deleted: false },
      { id: 3, createdAt: now, type: 'TAMBAH_TABUNGAN', fromAccount: 'LACI', toAccount: 'TABUNGAN', amount: 30000, deleted: false }
    ]
    const customers = [
      { id: 1, name: 'Umum', totalDebt: 0, deleted: false },
      { id: 2, name: 'Bu Sari', totalDebt: 75000, deleted: false }
    ]

    const balances = computeFinanceBalances({
      transactions,
      debtPayments: [],
      expenses: [],
      cashServices,
      digitalProducts: [],
      fundMovements,
      customers,
      liveDrawerBalance: 70000
    })

    // LACI mengikuti liveDrawerBalance = 70.000
    expect(balances.laciBalance).toBe(70000)
    // KAS = 500.000 (modal) + 63.000 (Transfer ke KAS) = 563.000
    expect(balances.kasBalance).toBe(563000)
    // REKENING = 50.000 (QRIS) + 105.000 (TT) - 60.000 (TF) - 40.000 (Tabungan) = 55.000
    expect(balances.rekeningBalance).toBe(55000)
    // TABUNGAN = 40.000 + 30.000 = 70.000
    expect(balances.tabunganBalance).toBe(70000)
    expect(balances.pihakKetigaBalance).toBe(0)
    expect(balances.totalLiquidAssets).toBe(70000 + 563000 + 55000 + 70000)
    expect(balances.totalReceivables).toBe(75000)
    expect(balances.totalNetWealth).toBe(758000 + 75000)
  })

  it('tracks 5th pocket Saldo Pihak Ketiga, KAS expenses, digital cost sources, and archived financeBaseline', () => {
    const now = Date.now()
    const fundMovements = [
      { id: 1, createdAt: now, type: 'MUTASI', fromAccount: 'REKENING', toAccount: 'PIHAK_KETIGA', amount: 250000, deleted: false }
    ]
    const digitalProducts = [
      { id: 1, createdAt: now, category: 'TOKEN_LISTRIK', costPrice: 50500, sellPrice: 52500, costSource: 'PIHAK_KETIGA', paymentMethod: 'QRIS', deleted: false },
      { id: 2, createdAt: now, category: 'PULSA', costPrice: 10500, sellPrice: 12000, costSource: 'KAS', paymentMethod: 'TUNAI', deleted: false },
      { id: 3, createdAt: now, category: 'PULSA', costPrice: 20500, sellPrice: 22000, costSource: 'SALDO_AGEN', paymentMethod: 'TUNAI', deleted: false }
    ]
    const expenses = [
      { id: 1, createdAt: now, category: 'operasional', source: 'KAS', amount: 15000, deleted: false }
    ]

    const res = computeFinanceBalances({
      digitalProducts,
      fundMovements,
      expenses,
      liveDrawerBalance: 34000,
      financeBaseline: {
        kasBalance: 100000,
        rekeningBalance: 300000,
        tabunganBalance: 50000,
        pihakKetigaBalance: 20000
      }
    })

    // PIHAK_KETIGA = 20rb baseline + 250rb topup - 50.5rb (PIHAK_KETIGA) - 20.5rb (legacy SALDO_AGEN) = 199.000
    expect(res.pihakKetigaBalance).toBe(199000)
    // KAS = 100rb baseline - 10.5rb (digital KAS) - 15rb (expense KAS) = 74.500
    expect(res.kasBalance).toBe(74500)
    // REKENING = 300rb baseline - 250rb (topup mitra) + 52.5rb (QRIS PLN) = 102.500
    expect(res.rekeningBalance).toBe(102500)
    expect(res.tabunganBalance).toBe(50000)
  })

  it('aggregates 7d and 30d finance summaries accurately including savings flows', () => {
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    const transactions = [
      { invoiceNumber: 'KSR-NOW', createdAt: now, paymentMethod: 'TUNAI', totalAmount: 80000, items: [{ sellPrice: 80000, buyPrice: 60000, qty: 1 }] },
      { invoiceNumber: 'KSR-10D', createdAt: now - 10 * DAY, paymentMethod: 'QRIS', totalAmount: 120000, items: [{ sellPrice: 120000, buyPrice: 90000, qty: 1 }] },
      { invoiceNumber: 'KSR-45D', createdAt: now - 45 * DAY, paymentMethod: 'TUNAI', totalAmount: 500000, items: [{ sellPrice: 500000, buyPrice: 400000, qty: 1 }] }
    ]
    const fundMovements = [
      { id: 1, createdAt: now - 2 * DAY, type: 'TAMBAH_TABUNGAN', fromAccount: 'LACI', toAccount: 'TABUNGAN', amount: 50000, deleted: false },
      { id: 2, createdAt: now - 15 * DAY, type: 'TAMBAH_TABUNGAN', fromAccount: 'KAS', toAccount: 'TABUNGAN', amount: 150000, deleted: false }
    ]

    const sum7d = computePeriodFinanceSummary({
      range: '7d',
      transactions,
      fundMovements,
      nowTs: now
    })
    expect(sum7d.salesTotal).toBe(80000)
    expect(sum7d.addedToTabungan).toBe(50000)
    expect(sum7d.netProfit).toBe(20000)

    const sum30d = computePeriodFinanceSummary({
      range: '30d',
      transactions,
      fundMovements,
      nowTs: now
    })
    expect(sum30d.salesTotal).toBe(200000)
    expect(sum30d.addedToTabungan).toBe(200000)
    expect(sum30d.netProfit).toBe(50000)
  })
})
