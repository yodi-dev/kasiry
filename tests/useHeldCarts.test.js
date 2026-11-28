import { describe, it, expect, beforeEach } from 'vitest'
import { useHeldCarts } from '../src/composables/useHeldCarts'

describe('useHeldCarts', () => {
  beforeEach(() => {
    localStorage.clear()
    const { clearHeldCarts } = useHeldCarts()
    clearHeldCarts()
  })

  it('parks a cart, persists to localStorage, and resumes/removes it', () => {
    const { heldCarts, heldCount, holdCart, resumeHeldCart, removeHeldCart, reloadHeldCarts } = useHeldCarts()

    expect(heldCount.value).toBe(0)

    // Empty cart should not be held
    expect(holdCart({ items: [] })).toBeNull()

    const saved = holdCart({
      items: [{ id: 1, name: 'Beras 5kg', sellPrice: 65000, qty: 2 }],
      priceTier: 'grosir',
      customer: { id: 10, name: 'Ibu Siti', priceTier: 'grosir' }
    })

    expect(saved).not.toBeNull()
    expect(saved.label).toBe('Ibu Siti')
    expect(saved.totalAmount).toBe(130000)
    expect(saved.totalCount).toBe(2)
    expect(heldCount.value).toBe(1)

    // Reload from localStorage
    reloadHeldCarts()
    expect(heldCarts.value.length).toBe(1)
    expect(heldCarts.value[0].priceTier).toBe('grosir')

    // Resume removes it from heldCarts and returns it
    const resumed = resumeHeldCart(saved.id)
    expect(resumed.items[0].name).toBe('Beras 5kg')
    expect(heldCount.value).toBe(0)

    // Park again and remove
    const saved2 = holdCart({
      items: [{ id: 2, name: 'Minyak 1L', sellPrice: 18000, qty: 1 }],
      priceTier: 'ecer'
    })
    expect(saved2.label).toBe('Antrean #1')
    expect(heldCount.value).toBe(1)
    removeHeldCart(saved2.id)
    expect(heldCount.value).toBe(0)
  })
})
