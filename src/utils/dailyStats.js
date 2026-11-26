/**
 * Hitung ringkasan kas harian kasir secara real-time dengan memisahkan arus kas fisik (Tunai Laci),
 * non-tunai (QRIS), dan piutang baru (Utang / Bon).
 *
 * @param {Array} transactions
 * @param {Array} debtPayments
 * @param {number} [nowTs]
 * @returns {Object}
 */
export function computeDailyStats(transactions = [], debtPayments = [], nowTs = Date.now()) {
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

  const topProducts = Object.values(productCountMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  return {
    todaySales: cashSales + qrisSales,
    todayCashSales: cashSales,
    todayQrisSales: qrisSales,
    todayDebtPaid: todayDebtPaidCash + todayDebtPaidQris,
    todayDebtPaidCash,
    todayDebtPaidQris,
    todayCashDrawer: cashSales + todayDebtPaidCash,
    todayQrisTotal: qrisSales + todayDebtPaidQris,
    todayProfit: Math.round(profit),
    transactionCount: todayTx.length,
    todayNewDebt: debt,
    topProducts
  }
}
