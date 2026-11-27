import { describe, it, expect } from 'vitest'
import {
  resolveCartItemPricing,
  buildPricedCartItem,
  normalizePriceTier,
  sanitizeOptionalPrice,
  sanitizeMinQty
} from '../src/utils/pricing'

describe('Multi-Price Pricing Engine (Ecer / Grosir / Agen / Auto-Qty / Manual)', () => {
  const sampleItem = {
    id: 10,
    name: 'Indomie Goreng Kardus/Pcs',
    sellPrice: 3500,
    baseSellPrice: 3500,
    wholesalePrice: 3200,
    wholesaleMinQty: 5,
    agentPrice: 3000,
    qty: 1,
    priceMode: 'auto',
    customPrice: null
  }

  it('resolves ecer, auto-qty threshold, grosir, agen, and manual overrides accurately', () => {
    // 1. Default ecer dibawah Min. Qty -> Ecer
    expect(resolveCartItemPricing(sampleItem, 'ecer')).toMatchObject({
      sellPrice: 3500,
      appliedTier: 'ecer',
      tierLabel: 'Ecer',
      isAutoQty: false
    })

    // 2. Mencapai Min. Qty (>= 5) pada mode ecer -> Grosir (Auto)
    expect(resolveCartItemPricing({ ...sampleItem, qty: 5 }, 'ecer')).toMatchObject({
      sellPrice: 3200,
      appliedTier: 'grosir',
      tierLabel: 'Grosir (Auto)',
      isAutoQty: true
    })

    // 3. Mode keranjang Grosir -> harga grosir walau qty 1
    expect(resolveCartItemPricing(sampleItem, 'grosir')).toMatchObject({
      sellPrice: 3200,
      appliedTier: 'grosir',
      tierLabel: 'Grosir',
      isAutoQty: false
    })

    // 4. Mode keranjang Agen -> harga agen
    expect(resolveCartItemPricing(sampleItem, 'agen')).toMatchObject({
      sellPrice: 3000,
      appliedTier: 'agen',
      tierLabel: 'Agen'
    })

    // 5. Override tier per item mengalahkan mode keranjang
    expect(resolveCartItemPricing({ ...sampleItem, priceMode: 'ecer', qty: 10 }, 'agen')).toMatchObject({
      sellPrice: 3500,
      appliedTier: 'ecer',
      tierLabel: 'Ecer'
    })

    // 6. Manual nego / harga khusus mengalahkan semuanya
    expect(resolveCartItemPricing({ ...sampleItem, priceMode: 'manual', customPrice: 2800, qty: 10 }, 'agen')).toMatchObject({
      sellPrice: 2800,
      appliedTier: 'manual',
      tierLabel: 'Khusus'
    })
  })

  it('gracefully falls back Agen -> Grosir -> Ecer when higher tiers are unset', () => {
    const ecerOnly = { id: 1, name: 'Es Batu', sellPrice: 2000, wholesalePrice: 0, agentPrice: 0, qty: 3 }
    expect(resolveCartItemPricing(ecerOnly, 'agen')).toMatchObject({
      sellPrice: 2000,
      appliedTier: 'ecer',
      isFallback: true
    })

    const noAgent = { id: 2, name: 'Gula', sellPrice: 17000, wholesalePrice: 16000, agentPrice: 0, qty: 1 }
    expect(resolveCartItemPricing(noAgent, 'agen')).toMatchObject({
      sellPrice: 16000,
      appliedTier: 'grosir',
      isFallback: true
    })

    const built = buildPricedCartItem({ ...noAgent, qty: 2 }, 'agen')
    expect(built.sellPrice).toBe(16000)
    expect(built.appliedTier).toBe('grosir')
    expect(built.isFallbackPrice).toBe(true)
  })

  it('normalizes tiers and sanitizes optional prices and min qty safely', () => {
    expect(normalizePriceTier('agen')).toBe('agen')
    expect(normalizePriceTier('grosir')).toBe('grosir')
    expect(normalizePriceTier('vip')).toBe('ecer')
    expect(sanitizeOptionalPrice('14.500')).toBe(14500)
    expect(sanitizeOptionalPrice('')).toBe(0)
    expect(sanitizeMinQty(1)).toBe(0)
    expect(sanitizeMinQty(5)).toBe(5)
  })
})
