export const PRICE_TIERS = [
  { id: 'ecer', label: 'Ecer', shortLabel: 'Ecer' },
  { id: 'grosir', label: 'Grosir', shortLabel: 'Grosir' },
  { id: 'agen', label: 'Agen', shortLabel: 'Agen' }
]

export const normalizePriceTier = (tier) => {
  if (tier === 'grosir' || tier === 'agen') return tier
  return 'ecer'
}

export const getPriceTierMeta = (tier) => {
  if (tier === 'manual') {
    return { id: 'manual', label: 'Khusus', shortLabel: 'Khusus' }
  }
  const normalized = normalizePriceTier(tier)
  return PRICE_TIERS.find(t => t.id === normalized) || PRICE_TIERS[0]
}

export const sanitizeOptionalPrice = (val) => {
  const num = Math.round(Number(String(val ?? '').replace(/\D/g, '') || 0))
  return Number.isFinite(num) && num > 0 ? num : 0
}

export const sanitizeMinQty = (val) => {
  const num = Math.round(Number(String(val ?? '').replace(/\D/g, '') || 0))
  return Number.isFinite(num) && num >= 2 ? num : 0
}

/**
 * Tentukan harga satuan aktif untuk 1 item keranjang berdasarkan:
 * 1. Override harga manual pada baris item (`priceMode === 'manual'`)
 * 2. Pilihan tier khusus baris item (`priceMode === 'ecer' | 'grosir' | 'agen'`)
 * 3. Mode tier seluruh keranjang (`cartTier === 'grosir' | 'agen'`)
 * 4. Otomatis harga grosir jika qty mencapai `wholesaleMinQty` (saat mode ecer & `priceMode === 'auto'`)
 * Selalu fallback aman berjenjang (Agen -> Grosir -> Ecer) agar tidak pernah menghasilkan Rp 0.
 */
export function resolveCartItemPricing(item = {}, cartTier = 'ecer') {
  const baseSellPrice = Math.max(0, Number(item.baseSellPrice ?? item.sellPrice ?? 0))
  const wholesalePrice = Math.max(0, Number(item.wholesalePrice || 0))
  const wholesaleMinQty = Math.max(0, Number(item.wholesaleMinQty || 0))
  const agentPrice = Math.max(0, Number(item.agentPrice || 0))
  const qty = Math.max(1, Number(item.qty || 1))
  const priceMode = item.priceMode || 'auto'
  const customPrice = Math.max(0, Number(item.customPrice || 0))

  // 1. Harga manual / nego khusus di nota ini
  if (priceMode === 'manual' && customPrice > 0) {
    return {
      sellPrice: customPrice,
      baseSellPrice,
      appliedTier: 'manual',
      tierLabel: 'Khusus',
      isAutoQty: false,
      isFallback: false
    }
  }

  // Tentukan target tier: override per item mengalahkan mode keranjang
  const targetTier = priceMode === 'auto' ? normalizePriceTier(cartTier) : normalizePriceTier(priceMode)

  if (targetTier === 'agen') {
    if (agentPrice > 0) {
      return {
        sellPrice: agentPrice,
        baseSellPrice,
        appliedTier: 'agen',
        tierLabel: 'Agen',
        isAutoQty: false,
        isFallback: false
      }
    }
    if (wholesalePrice > 0) {
      return {
        sellPrice: wholesalePrice,
        baseSellPrice,
        appliedTier: 'grosir',
        tierLabel: 'Grosir',
        isAutoQty: false,
        isFallback: true
      }
    }
    return {
      sellPrice: baseSellPrice,
      baseSellPrice,
      appliedTier: 'ecer',
      tierLabel: 'Ecer',
      isAutoQty: false,
      isFallback: true
    }
  }

  if (targetTier === 'grosir') {
    if (wholesalePrice > 0) {
      return {
        sellPrice: wholesalePrice,
        baseSellPrice,
        appliedTier: 'grosir',
        tierLabel: 'Grosir',
        isAutoQty: false,
        isFallback: false
      }
    }
    return {
      sellPrice: baseSellPrice,
      baseSellPrice,
      appliedTier: 'ecer',
      tierLabel: 'Ecer',
      isAutoQty: false,
      isFallback: true
    }
  }

  // Mode 'ecer': cek aturan grosir otomatis berbasis Min. Qty saat item masih mode 'auto'
  if (priceMode === 'auto' && wholesalePrice > 0 && wholesaleMinQty >= 2 && qty >= wholesaleMinQty) {
    return {
      sellPrice: wholesalePrice,
      baseSellPrice,
      appliedTier: 'grosir',
      tierLabel: 'Grosir (Auto)',
      isAutoQty: true,
      isFallback: false
    }
  }

  return {
    sellPrice: baseSellPrice,
    baseSellPrice,
    appliedTier: 'ecer',
    tierLabel: 'Ecer',
    isAutoQty: false,
    isFallback: false
  }
}

/**
 * Bangun ulang properti item keranjang lengkap dengan harga aktif terhitung.
 */
export function buildPricedCartItem(item, cartTier = 'ecer') {
  const baseSellPrice = Math.max(0, Number(item.baseSellPrice ?? item.sellPrice ?? 0))
  const normalized = {
    ...item,
    baseSellPrice,
    wholesalePrice: Math.max(0, Number(item.wholesalePrice || 0)),
    wholesaleMinQty: Math.max(0, Number(item.wholesaleMinQty || 0)),
    agentPrice: Math.max(0, Number(item.agentPrice || 0)),
    priceMode: item.priceMode || 'auto',
    customPrice: item.customPrice ? Math.max(0, Number(item.customPrice)) : null,
    qty: Math.max(1, Number(item.qty || 1))
  }
  const resolved = resolveCartItemPricing(normalized, cartTier)
  return {
    ...normalized,
    sellPrice: resolved.sellPrice,
    appliedTier: resolved.appliedTier,
    tierLabel: resolved.tierLabel,
    isAutoQty: resolved.isAutoQty,
    isFallbackPrice: resolved.isFallback
  }
}

/**
 * Sinkronkan ulang harga seluruh item keranjang terhadap data katalog terbaru dan level harga nota aktif.
 * Jika `forceFollowNota` aktif (saat ganti level nota Ecer/Grosir/Agen atau ganti pelanggan),
 * item yang sebelumnya terkunci di tier katalog tertentu dikembalikan ke mode `'auto'`
 * agar langsung mengikuti level nota baru (hanya harga nego `'manual'` yang dipertahankan).
 */
export function repriceCartItems(cartItems = [], products = [], cartTier = 'ecer', options = {}) {
  const { forceFollowNota = false } = options
  const normalizedCartTier = normalizePriceTier(cartTier)
  const prodMap = new Map((products || []).map(p => [p.id, p]))

  return (cartItems || []).map(item => {
    const fresh = prodMap.get(item.id)
    const nextMode = forceFollowNota && item.priceMode !== 'manual'
      ? 'auto'
      : (item.priceMode || 'auto')

    return buildPricedCartItem(
      {
        ...item,
        ...(fresh ? {
          name: fresh.name,
          category: fresh.category,
          buyPrice: fresh.buyPrice,
          baseSellPrice: fresh.sellPrice,
          wholesalePrice: fresh.wholesalePrice,
          wholesaleMinQty: fresh.wholesaleMinQty,
          agentPrice: fresh.agentPrice
        } : {}),
        priceMode: nextMode
      },
      normalizedCartTier
    )
  })
}
