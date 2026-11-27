import { recordBelongsToShift, computeDailyStats } from './dailyStats'

export const FINANCE_ACCOUNT_META = {
  LACI: {
    id: 'LACI',
    label: 'Uang Laci Kasir',
    shortLabel: 'Laci Kasir',
    description: 'Uang tunai harian operasional kasir / shift aktif',
    badgeClass: 'bg-sky-50 text-[#0284c7] border-sky-200'
  },
  KAS: {
    id: 'KAS',
    label: 'Uang Kas Toko',
    shortLabel: 'Uang Kas',
    description: 'Simpanan kas tunai cadangan di luar laci (brankas / dompet toko)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  REKENING: {
    id: 'REKENING',
    label: 'Rekening & QRIS',
    shortLabel: 'Rekening/QRIS',
    description: 'Saldo bank / e-wallet penerima QRIS & sumber dana transfer',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  TABUNGAN: {
    id: 'TABUNGAN',
    label: 'Tabungan Toko',
    shortLabel: 'Tabungan',
    description: 'Dana tabungan usaha / simpanan khusus pemilik',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  PIHAK_KETIGA: {
    id: 'PIHAK_KETIGA',
    label: 'Saldo Pihak Ketiga',
    shortLabel: 'Pihak Ketiga',
    description: 'Saldo mitra / aplikasi untuk modal isi pulsa, data & token PLN',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
  }
}

export function getFinanceAccountMeta(accountId) {
  if (accountId === 'SALDO_AGEN') return FINANCE_ACCOUNT_META.PIHAK_KETIGA
  return FINANCE_ACCOUNT_META[accountId] || {
    id: accountId || 'LUAR',
    label: accountId === 'LUAR' ? 'Dana Luar / Pemilik' : (accountId || 'Lainnya'),
    shortLabel: accountId === 'LUAR' ? 'Dana Luar' : (accountId || 'Lainnya'),
    description: '',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

/**
 * Hitung saldo kumulatif 4 kantong non-laci (Uang Kas, Rekening/QRIS, Tabungan, Saldo Pihak Ketiga)
 * serta gabungkan dengan saldo Laci Kasir & Piutang Pelanggan menjadi Kekayaan Bersih.
 */
export function computeFinanceBalances({
  transactions = [],
  debtPayments = [],
  expenses = [],
  cashServices = [],
  digitalProducts = [],
  fundMovements = [],
  customers = [],
  liveDrawerBalance = 0,
  financeBaseline = null,
  precomputedPockets = null
} = {}) {
  let kasBalance = Math.round(Number(financeBaseline?.kasBalance || 0))
  let rekeningBalance = Math.round(Number(financeBaseline?.rekeningBalance || 0))
  let tabunganBalance = Math.round(Number(financeBaseline?.tabunganBalance || 0))
  let pihakKetigaBalance = Math.round(Number(financeBaseline?.pihakKetigaBalance || 0))

  if (precomputedPockets && typeof precomputedPockets === 'object') {
    kasBalance = Math.round(Number(precomputedPockets.kasBalance || 0))
    rekeningBalance = Math.round(Number(precomputedPockets.rekeningBalance || 0))
    tabunganBalance = Math.round(Number(precomputedPockets.tabunganBalance || 0))
    pihakKetigaBalance = Math.round(Number(precomputedPockets.pihakKetigaBalance || 0))
  } else {
    ;(transactions || []).forEach(t => {
      if (!t || t.deleted) return
      const amount = Math.round(Number(t.totalAmount || 0))
      const debtAmt = Math.round(Number(t.debtAmount || 0))
      if (t.paymentMethod === 'QRIS (SEBAGIAN BON)' || (t.paymentMethod === 'QRIS' && debtAmt > 0)) {
        rekeningBalance += Math.max(0, Math.min(amount, Math.round(Number(t.paidAmount ?? t.cashGiven ?? 0))))
      } else if (t.paymentMethod === 'QRIS') {
        rekeningBalance += amount
      }
    })

    ;(debtPayments || []).forEach(p => {
      if (!p) return
      if (p.paymentMethod === 'QRIS') {
        rekeningBalance += Math.round(Number(p.amount || 0))
      }
    })

    ;(digitalProducts || []).forEach(d => {
      if (!d || d.deleted) return
      const sellPrice = Math.round(Number(d.sellPrice || 0))
      const costPrice = Math.max(0, Math.round(Number(d.costPrice || 0)))
      if (d.paymentMethod === 'QRIS') {
        rekeningBalance += sellPrice
      }
      const costSrc = d.costSource || 'PIHAK_KETIGA'
      if (costSrc === 'REKENING') {
        rekeningBalance -= costPrice
      } else if (costSrc === 'KAS') {
        kasBalance -= costPrice
      } else if (costSrc !== 'LUAR' && costSrc !== 'DANA_LUAR') {
        pihakKetigaBalance -= costPrice
      }
    })

    ;(expenses || []).forEach(e => {
      if (!e || e.deleted) return
      const amt = Math.round(Number(e.amount || 0))
      if (e.source === 'NON_TUNAI') {
        rekeningBalance -= amt
      } else if (e.source === 'KAS') {
        kasBalance -= amt
      }
    })

    ;(cashServices || []).forEach(svc => {
      if (!svc || svc.deleted) return
      const amount = Math.round(Number(svc.amount || 0))
      const adminFee = Math.max(0, Math.round(Number(svc.adminFee || 0)))
      const totalPaid = amount + adminFee
      const usesKas = svc.cashSource === 'KAS'

      if (svc.type === 'TRANSFER') {
        if (usesKas) {
          kasBalance += totalPaid
        }
        rekeningBalance -= amount
      } else {
        // TARIK_TUNAI
        if (usesKas) {
          kasBalance -= amount
        }
        rekeningBalance += totalPaid
      }
    })

    ;(fundMovements || []).forEach(mv => {
      if (!mv || mv.deleted) return
      const amt = Math.round(Number(mv.amount || 0))
      if (!Number.isFinite(amt) || amt <= 0) return

      if (mv.toAccount === 'KAS') kasBalance += amt
      else if (mv.toAccount === 'REKENING') rekeningBalance += amt
      else if (mv.toAccount === 'TABUNGAN') tabunganBalance += amt
      else if (mv.toAccount === 'PIHAK_KETIGA' || mv.toAccount === 'SALDO_AGEN') pihakKetigaBalance += amt

      if (mv.fromAccount === 'KAS') kasBalance -= amt
      else if (mv.fromAccount === 'REKENING') rekeningBalance -= amt
      else if (mv.fromAccount === 'TABUNGAN') tabunganBalance -= amt
      else if (mv.fromAccount === 'PIHAK_KETIGA' || mv.fromAccount === 'SALDO_AGEN') pihakKetigaBalance -= amt
    })
  }

  const laciBalance = Math.round(Number(liveDrawerBalance || 0))
  const totalReceivables = (customers || [])
    .filter(c => c && !c.deleted)
    .reduce((sum, c) => sum + Math.max(0, Math.round(Number(c.totalDebt || 0))), 0)

  const totalLiquidAssets = laciBalance + kasBalance + rekeningBalance + tabunganBalance + pihakKetigaBalance
  const totalNetWealth = totalLiquidAssets + totalReceivables

  return {
    laciBalance,
    kasBalance,
    rekeningBalance,
    tabunganBalance,
    pihakKetigaBalance,
    totalLiquidAssets,
    totalReceivables,
    totalNetWealth
  }
}

/**
 * Ringkasan arus kas & laba bersih per rentang waktu untuk Manajemen Keuangan terpisah dari Laporan Harian.
 */
export function computePeriodFinanceSummary({
  range = 'today',
  activeShift = null,
  transactions = [],
  debtPayments = [],
  expenses = [],
  cashServices = [],
  digitalProducts = [],
  fundMovements = [],
  nowTs = Date.now()
} = {}) {
  const startOfToday = new Date(nowTs)
  startOfToday.setHours(0, 0, 0, 0)
  const todayTs = startOfToday.getTime()
  const MS_PER_DAY = 24 * 60 * 60 * 1000

  let cutoffTs = todayTs
  if (range === '7d') {
    cutoffTs = todayTs - 6 * MS_PER_DAY
  } else if (range === '30d') {
    cutoffTs = todayTs - 29 * MS_PER_DAY
  }

  let periodStats
  let periodMovements

  if (range === 'today' && activeShift && activeShift.status === 'OPEN') {
    periodStats = computeDailyStats(transactions, debtPayments, expenses, {
      activeShift,
      nowTs,
      cashServices,
      digitalProducts,
      fundMovements
    })
    periodMovements = (fundMovements || []).filter(m => !m?.deleted && recordBelongsToShift(m, activeShift, 'createdAt'))
  } else {
    const fTx = (transactions || []).filter(t => !t?.deleted && (t?.createdAt || 0) >= cutoffTs)
    const fPays = (debtPayments || []).filter(p => (p?.paymentDate || 0) >= cutoffTs)
    const fExps = (expenses || []).filter(e => !e?.deleted && (e?.createdAt || 0) >= cutoffTs)
    const fSvcs = (cashServices || []).filter(s => !s?.deleted && (s?.createdAt || 0) >= cutoffTs)
    const fDigs = (digitalProducts || []).filter(d => !d?.deleted && (d?.createdAt || 0) >= cutoffTs)
    periodMovements = (fundMovements || []).filter(m => !m?.deleted && (m?.createdAt || 0) >= cutoffTs)

    // Gunakan hitung periode dengan floor cutoffTs
    periodStats = computeDailyStats(fTx, fPays, fExps, {
      nowTs: cutoffTs,
      cashServices: fSvcs,
      digitalProducts: fDigs,
      fundMovements: periodMovements
    })
  }

  let addedToTabungan = 0
  let withdrawnFromTabungan = 0
  let movedToKas = 0
  let withdrawnFromKas = 0
  let addedToPihakKetiga = 0

  periodMovements.forEach(m => {
    const amt = Math.round(Number(m.amount || 0))
    if (amt <= 0) return
    if (m.toAccount === 'TABUNGAN') addedToTabungan += amt
    if (m.fromAccount === 'TABUNGAN') withdrawnFromTabungan += amt
    if (m.toAccount === 'KAS') movedToKas += amt
    if (m.fromAccount === 'KAS') withdrawnFromKas += amt
    if (m.toAccount === 'PIHAK_KETIGA' || m.toAccount === 'SALDO_AGEN') addedToPihakKetiga += amt
  })

  return {
    range,
    salesTotal: (periodStats.todaySales || 0) + (periodStats.todayDigitalSales || 0),
    goodsSales: periodStats.todaySales || 0,
    digitalSales: periodStats.todayDigitalSales || 0,
    debtPaid: periodStats.todayDebtPaid || 0,
    newDebt: periodStats.todayNewDebt || 0,
    cashServiceAdminProfit: periodStats.todayCashServiceAdminProfit || 0,
    digitalProfit: periodStats.todayDigitalProfit || 0,
    expensesTotal: periodStats.todayExpensesTotal || 0,
    expensesKas: periodStats.todayExpensesKas || 0,
    operationalExpenses: periodStats.todayOperationalExpenses || 0,
    priveTotal: periodStats.todayPriveTotal || 0,
    netProfit: periodStats.todayProfit || 0,
    addedToTabungan,
    withdrawnFromTabungan,
    movedToKas,
    withdrawnFromKas,
    addedToPihakKetiga,
    movementCount: periodMovements.length
  }
}
