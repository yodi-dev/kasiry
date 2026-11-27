const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Hitung statistik penjualan & penggunaan setiap produk dari riwayat transaksi.
 * Mengidentifikasi barang yang belum diatur harganya, belum pernah terjual, maupun pasif/sepi >= N hari
 * agar pemilik warung mudah merapikan katalog atau menyusun promo barang kurang laku.
 *
 * @param {Array} products Daftar produk aktif
 * @param {Array} transactions Daftar seluruh transaksi di database
 * @param {number} nowTs Timestamp saat ini
 * @param {number} slowThresholdDays Batas hari dianggap pasif/kurang laku (default 30 hari)
 */
export function buildProductUsageMap(
  products = [],
  transactions = [],
  nowTs = Date.now(),
  slowThresholdDays = 30
) {
  const byId = new Map()
  const nameToId = new Map()

  for (const prod of products || []) {
    if (!prod || prod.deleted) continue
    byId.set(prod.id, {
      totalQtySold: 0,
      txCount: 0,
      lastSoldAt: null
    })
    if (prod.name) {
      const cleanName = String(prod.name).trim().toLowerCase()
      if (!nameToId.has(cleanName)) {
        nameToId.set(cleanName, prod.id)
      }
    }
  }

  for (const tx of transactions || []) {
    if (!tx || tx.deleted || !Array.isArray(tx.items)) continue
    const txTime = Number(tx.createdAt || 0)
    const seenInTx = new Set()

    for (const item of tx.items) {
      if (!item) continue
      let targetId = item.id !== null && item.id !== undefined && byId.has(item.id)
        ? item.id
        : null

      if (targetId === null && item.name) {
        const mappedId = nameToId.get(String(item.name).trim().toLowerCase())
        if (mappedId !== undefined) targetId = mappedId
      }

      if (targetId === null) continue
      const entry = byId.get(targetId)
      const qty = Math.max(0, Number(item.qty || 0))
      if (!entry || qty <= 0) continue

      entry.totalQtySold += qty
      if (!seenInTx.has(targetId)) {
        entry.txCount += 1
        seenInTx.add(targetId)
      }
      if (txTime > 0 && (entry.lastSoldAt === null || txTime > entry.lastSoldAt)) {
        entry.lastSoldAt = txTime
      }
    }
  }

  const cutoffMs = slowThresholdDays * MS_PER_DAY
  const statsById = {}
  let unpricedCount = 0
  let neverSoldCount = 0
  let slowMovingCount = 0

  for (const prod of products || []) {
    if (!prod || prod.deleted) continue
    const raw = byId.get(prod.id) || { totalQtySold: 0, txCount: 0, lastSoldAt: null }
    const isUnpriced = !(Number(prod.sellPrice || 0) > 0)
    const isNeverSold = raw.totalQtySold === 0
    const isSlowMoving =
      raw.totalQtySold > 0 &&
      raw.lastSoldAt !== null &&
      nowTs - raw.lastSoldAt >= cutoffMs

    if (isUnpriced) unpricedCount += 1
    if (isNeverSold) neverSoldCount += 1
    if (isSlowMoving) slowMovingCount += 1

    statsById[prod.id] = {
      ...raw,
      isUnpriced,
      isNeverSold,
      isSlowMoving
    }
  }

  return {
    byId: statsById,
    unpricedCount,
    neverSoldCount,
    slowMovingCount
  }
}
