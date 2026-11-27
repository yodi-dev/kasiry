import { getExpenseCategoryMeta } from './expenseConstants'

/**
 * Cek apakah sebuah catatan transaksi / pelunasan / pengeluaran termasuk dalam lingkup shift tertentu.
 */
export function recordBelongsToShift(record, shift, tsKey = 'createdAt') {
  if (!record || !shift) return false
  if (shift.id != null && record.shiftId != null && record.shiftId === shift.id) return true
  if (shift.shiftCode && record.shiftCode && record.shiftCode === shift.shiftCode) return true
  if (record.shiftId != null || record.shiftCode) return false

  const ts = Number(record[tsKey] || 0)
  const endTs = shift.closedAt ? Number(shift.closedAt) : Infinity
  return ts >= Number(shift.openedAt || 0) && ts <= endTs
}

/**
 * Mesin agregasi keuangan inti yang dipakai bersama oleh Laporan Harian / Shift Aktif
 * maupun pratinjau Tutup Buku Shift.
 */
function aggregateRecords(periodTx = [], periodDebtPays = [], periodExpenses = [], openingCash = 0) {
  let cashSales = 0
  let qrisSales = 0
  let profit = 0
  let debt = 0
  const productCountMap = {}

  periodTx.forEach(t => {
    const amount = Number(t.totalAmount || 0)
    if (t.paymentMethod === 'TUNAI') {
      cashSales += amount
    } else if (t.paymentMethod === 'QRIS') {
      qrisSales += amount
    } else {
      debt += amount
    }

    if (t.items) {
      t.items.forEach(item => {
        const sell = Number(item.sellPrice || 0)
        const buy = Number(item.buyPrice ?? sell * 0.8)
        const qty = Number(item.qty || 0)
        profit += (sell - buy) * qty

        if (!productCountMap[item.name]) {
          productCountMap[item.name] = { name: item.name, qty: 0, subtotal: 0 }
        }
        productCountMap[item.name].qty += qty
        productCountMap[item.name].subtotal += sell * qty
      })
    }
  })

  let todayDebtPaidCash = 0
  let todayDebtPaidQris = 0
  periodDebtPays.forEach(p => {
    const amt = Number(p.amount || 0)
    if (p.paymentMethod === 'QRIS') {
      todayDebtPaidQris += amt
    } else {
      todayDebtPaidCash += amt
    }
  })

  let todayExpensesCash = 0
  let todayExpensesNonCash = 0
  let todayOperationalExpenses = 0
  let todayPriveTotal = 0
  let todayExpenseCount = 0

  periodExpenses.forEach(exp => {
    if (!exp || exp.deleted) return
    const amt = Number(exp.amount || 0)
    if (!Number.isFinite(amt) || amt <= 0) return

    todayExpenseCount += 1
    if (exp.source === 'NON_TUNAI') {
      todayExpensesNonCash += amt
    } else {
      todayExpensesCash += amt
    }

    const meta = getExpenseCategoryMeta(exp.category)
    if (exp.category === 'prive') {
      todayPriveTotal += amt
    }
    if (meta.affectsProfit) {
      todayOperationalExpenses += amt
    }
  })

  const topProducts = Object.values(productCountMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const todayCashDrawer = cashSales + todayDebtPaidCash
  const todayQrisTotal = qrisSales + todayDebtPaidQris
  const todayGrossProfit = Math.round(profit)
  const cleanOpening = Math.max(0, Number(openingCash || 0))
  const todayNetCashDrawer = todayCashDrawer - todayExpensesCash

  return {
    openingCash: cleanOpening,
    todaySales: cashSales + qrisSales,
    todayCashSales: cashSales,
    todayQrisSales: qrisSales,
    todayDebtPaid: todayDebtPaidCash + todayDebtPaidQris,
    todayDebtPaidCash,
    todayDebtPaidQris,
    todayCashDrawer,
    todayQrisTotal,
    todayExpensesCash,
    todayExpensesNonCash,
    todayExpensesTotal: todayExpensesCash + todayExpensesNonCash,
    todayOperationalExpenses,
    todayPriveTotal,
    todayExpenseCount,
    todayNetCashDrawer,
    expectedCashDrawer: cleanOpening + todayNetCashDrawer,
    todayNetQris: todayQrisTotal - todayExpensesNonCash,
    todayGrossProfit,
    todayProfit: todayGrossProfit - todayOperationalExpenses,
    transactionCount: periodTx.length,
    todayNewDebt: debt,
    topProducts
  }
}

/**
 * Hitung ringkasan kas harian kasir secara real-time.
 * Jika `activeShift` diberikan (status `'OPEN'`), seluruh angka otomatis berada dalam lingkup
 * shift aktif tersebut (mendukung buka/tutup fleksibel lintas tengah malam). Jika belum ada shift,
 * jatuh balik ke hari kalender sejak 00:00.
 *
 * Tetap kompatibel dengan pemanggilan `(transactions, debtPayments, nowTs)` dan
 * `(transactions, debtPayments, expenses, nowTs)` maupun `(transactions, debtPayments, expenses, { activeShift, nowTs })`.
 */
export function computeDailyStats(
  transactions = [],
  debtPayments = [],
  expensesOrNow = [],
  maybeNowOrOptions = Date.now()
) {
  const expenses = Array.isArray(expensesOrNow) ? expensesOrNow : []
  let nowTs = Date.now()
  let activeShift = null

  if (typeof expensesOrNow === 'number') {
    nowTs = expensesOrNow
  } else if (typeof maybeNowOrOptions === 'number') {
    nowTs = maybeNowOrOptions
  } else if (maybeNowOrOptions && typeof maybeNowOrOptions === 'object') {
    nowTs = Number(maybeNowOrOptions.nowTs || Date.now())
    activeShift = maybeNowOrOptions.activeShift || null
  }

  let periodTx
  let periodPays
  let periodExpenses

  if (activeShift && activeShift.status === 'OPEN') {
    periodTx = (transactions || []).filter(t => recordBelongsToShift(t, activeShift, 'createdAt'))
    periodPays = (debtPayments || []).filter(p => recordBelongsToShift(p, activeShift, 'paymentDate'))
    periodExpenses = (expenses || []).filter(e => !e?.deleted && recordBelongsToShift(e, activeShift, 'createdAt'))
  } else {
    const startOfDay = new Date(nowTs)
    startOfDay.setHours(0, 0, 0, 0)
    const todayTimestamp = startOfDay.getTime()

    periodTx = (transactions || []).filter(t => (t?.createdAt || 0) >= todayTimestamp)
    periodPays = (debtPayments || []).filter(p => (p?.paymentDate || 0) >= todayTimestamp)
    periodExpenses = (expenses || []).filter(e => !e?.deleted && (e?.createdAt || 0) >= todayTimestamp)
  }

  const agg = aggregateRecords(periodTx, periodPays, periodExpenses, activeShift?.openingCash || 0)

  return {
    ...agg,
    isShiftScoped: Boolean(activeShift && activeShift.status === 'OPEN'),
    shiftId: activeShift?.id || null,
    shiftCode: activeShift?.shiftCode || null,
    shiftCashierName: activeShift?.cashierName || '',
    shiftOpenedAt: activeShift?.openedAt || null
  }
}

/**
 * Hitung pratinjau lengkap & selisih kas untuk proses Tutup Shift / Tutup Buku Harian.
 */
export function computeShiftClosingPreview({
  shift,
  transactions = [],
  debtPayments = [],
  expenses = [],
  actualCash = 0
} = {}) {
  if (!shift) return null
  const periodTx = (transactions || []).filter(t => recordBelongsToShift(t, shift, 'createdAt'))
  const periodPays = (debtPayments || []).filter(p => recordBelongsToShift(p, shift, 'paymentDate'))
  const periodExpenses = (expenses || []).filter(e => !e?.deleted && recordBelongsToShift(e, shift, 'createdAt'))

  const stats = aggregateRecords(periodTx, periodPays, periodExpenses, shift.openingCash || 0)
  const cleanActualCash = Math.round(Number(actualCash || 0))
  const expectedCash = stats.expectedCashDrawer
  const cashDifference = cleanActualCash - expectedCash

  return {
    ...stats,
    expectedCash,
    actualCash: cleanActualCash,
    cashDifference
  }
}

/**
 * Format laporan tutup shift / tutup buku harian siap kirim ke WhatsApp.
 */
export function formatShiftWhatsAppText(shift, storeName = 'Habiba Store') {
  if (!shift) return ''
  const s = shift.summary || {}
  const openStr = shift.openedAt
    ? new Date(shift.openedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-'
  const closeStr = shift.closedAt
    ? new Date(shift.closedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-'

  const openingCash = Number(shift.openingCash || s.openingCash || 0)
  const cashSales = Number(s.todayCashSales || 0)
  const debtPaidCash = Number(s.todayDebtPaidCash || 0)
  const expensesCash = Number(s.todayExpensesCash || 0)
  const qrisTotal = Number(s.todayQrisTotal || 0)
  const newDebt = Number(s.todayNewDebt || 0)
  const netProfit = Number(s.todayProfit || 0)
  const expectedCash = Number(shift.expectedCash ?? s.expectedCash ?? openingCash)
  const actualCash = Number(shift.actualCash ?? expectedCash)
  const diff = Number(shift.cashDifference ?? (actualCash - expectedCash))
  const diffText =
    diff === 0
      ? 'Pas / Cocok (Rp 0)'
      : diff > 0
      ? `Lebih +Rp ${diff.toLocaleString('id-ID')}`
      : `Kurang -Rp ${Math.abs(diff).toLocaleString('id-ID')}`

  let text = `*🔐 TUTUP SHIFT / BUKU HARIAN ${String(storeName || 'Kasiry').toUpperCase()}*\n`
  text += `🆔 Kode Shift: ${shift.shiftCode || '-'}\n`
  text += `👤 Kasir: ${shift.cashierName || '-'}\n`
  text += `🕒 Waktu: ${openStr} s/d ${closeStr}\n`
  text += `--------------------------------\n`
  text += `💼 Modal Awal Laci: Rp ${openingCash.toLocaleString('id-ID')}\n`
  text += `💵 Penjualan Tunai: Rp ${cashSales.toLocaleString('id-ID')}\n`
  if (debtPaidCash > 0) {
    text += `🧾 Pelunasan Bon (Tunai): Rp ${debtPaidCash.toLocaleString('id-ID')}\n`
  }
  if (expensesCash > 0) {
    text += `💸 Kas Keluar Dari Laci: -Rp ${expensesCash.toLocaleString('id-ID')}\n`
  }
  text += `🧮 Seharusnya di Laci: Rp ${expectedCash.toLocaleString('id-ID')}\n`
  text += `🪙 Uang Fisik Laci: Rp ${actualCash.toLocaleString('id-ID')}\n`
  text += `⚖️ *Selisih Laci:* ${diffText}\n`
  text += `--------------------------------\n`
  if (qrisTotal > 0) {
    text += `📱 QRIS (Non-Tunai): Rp ${qrisTotal.toLocaleString('id-ID')}\n`
  }
  if (newDebt > 0) {
    text += `📋 Bon / Utang Baru: Rp ${newDebt.toLocaleString('id-ID')}\n`
  }
  text += `📈 Estimasi Untung Bersih: Rp ${netProfit.toLocaleString('id-ID')}\n`
  text += `🧾 Total Transaksi: ${s.transactionCount || 0} struk\n`
  if (shift.closingNote) {
    text += `📝 Catatan: ${shift.closingNote}\n`
  }
  text += `--------------------------------\n`
  text += `Dicatat otomatis via Kasiry POS.`
  return text
}
