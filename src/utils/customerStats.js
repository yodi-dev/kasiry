/**
 * Bangun peta statistik transaksi pelanggan dalam satu kali lintasan O(N)
 * agar pengurutan & pencarian pelanggan tetap instan meski riwayat mencapai puluhan ribu transaksi.
 *
 * @param {Array} transactions
 * @returns {{ getStats: (customer: Object) => { count: number, totalSpent: number } }}
 */
export function buildCustomerStatsMap(transactions = []) {
  const byId = new Map()
  const byNameOnly = new Map()

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!tx) continue
    const amount = Number(tx.totalAmount || 0)

    const cid = tx.customerId ?? tx.customer?.id ?? null
    if (cid !== null && cid !== undefined && cid !== '') {
      const prev = byId.get(cid)
      if (prev) {
        prev.count += 1
        prev.totalSpent += amount
      } else {
        byId.set(cid, { count: 1, totalSpent: amount })
      }
      continue
    }

    const rawName = tx.customerName ?? tx.customer?.name ?? ''
    const cleanName = typeof rawName === 'string' ? rawName.trim().toLowerCase() : ''
    if (cleanName) {
      const prev = byNameOnly.get(cleanName)
      if (prev) {
        prev.count += 1
        prev.totalSpent += amount
      } else {
        byNameOnly.set(cleanName, { count: 1, totalSpent: amount })
      }
    }
  }

  return {
    getStats(customer) {
      if (!customer) return { count: 0, totalSpent: 0 }
      let count = 0
      let totalSpent = 0

      if (customer.id !== null && customer.id !== undefined && byId.has(customer.id)) {
        const s = byId.get(customer.id)
        count += s.count
        totalSpent += s.totalSpent
      }

      const cleanName = typeof customer.name === 'string' ? customer.name.trim().toLowerCase() : ''
      if (cleanName && byNameOnly.has(cleanName)) {
        const s = byNameOnly.get(cleanName)
        count += s.count
        totalSpent += s.totalSpent
      }

      return { count, totalSpent }
    }
  }
}
