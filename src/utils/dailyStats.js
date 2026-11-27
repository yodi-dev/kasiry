import { getExpenseCategoryMeta } from './expenseConstants'

/**
 * Hitung ringkasan kas harian kasir secara real-time dengan memisahkan arus kas fisik (Tunai Laci),
 * non-tunai (QRIS), piutang baru (Utang / Bon), serta pengeluaran kas keluar harian.
 *
 * Tetap kompatibel dengan pemanggilan lama 3 argumen `(transactions, debtPayments, nowTs)`
 * maupun pemanggilan baru `(transactions, debtPayments, expenses, nowTs)`.
 *
 * @param {Array} transactions
 * @param {Array} debtPayments
 * @param {Array|number} [expensesOrNow]
 * @param {number} [maybeNowTs]
 * @returns {Object}
 */
export function computeDailyStats(
  transactions = [],
  debtPayments = [],
  expensesOrNow = [],
  maybeNowTs = Date.now()
) {
  const expenses = Array.isArray(expensesOrNow) ? expensesOrNow : []
  const nowTs = typeof expensesOrNow === 'number' ? expensesOrNow : maybeNowTs

  const startOfDay = new Date(nowTs)
  startOfDay.setHours(0, 0, 0, 0)
  const todayTimestamp = startOfDay.getTime()

  const todayTx = (transactions || []).filter(t => (t?.createdAt || 0) >= todayTimestamp)

  let cashSales = 0
  let qrisSales = 0
  let profit = 0
  let debt = 0
  const productCountMap = {}

  todayTx.forEach(t => {
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
  ;(debtPayments || []).forEach(p => {
    if ((p?.paymentDate || 0) < todayTimestamp) return
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

  ;(expenses || []).forEach(exp => {
    if (!exp || exp.deleted) return
    if ((exp.createdAt || 0) < todayTimestamp) return
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

  return {
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
    todayNetCashDrawer: todayCashDrawer - todayExpensesCash,
    todayNetQris: todayQrisTotal - todayExpensesNonCash,
    todayGrossProfit,
    todayProfit: todayGrossProfit - todayOperationalExpenses,
    transactionCount: todayTx.length,
    todayNewDebt: debt,
    topProducts
  }
}
