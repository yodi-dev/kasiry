import { ref, computed } from 'vue'

const STORAGE_KEY = 'kasiry_held_carts_v1'

const cloneData = (val) => {
  if (val === null || val === undefined) return val
  return JSON.parse(JSON.stringify(val))
}

const loadFromStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveToStorage = (list) => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('[Kasiry] Gagal menyimpan antrean keranjang:', err)
  }
}

const heldCarts = ref(loadFromStorage())

export function useHeldCarts() {
  const heldCount = computed(() => heldCarts.value.length)

  const reloadHeldCarts = () => {
    heldCarts.value = loadFromStorage()
  }

  const holdCart = ({ items = [], priceTier = 'ecer', customer = null, label = '' } = {}) => {
    if (!Array.isArray(items) || items.length === 0) return null

    const cleanItems = cloneData(items)
    const totalAmount = cleanItems.reduce(
      (sum, item) => sum + (Number(item.sellPrice || 0) * Number(item.qty || 0)),
      0
    )
    const totalCount = cleanItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)

    const trimmedLabel = String(label || '').trim()
    const fallbackLabel =
      customer?.name && customer.name.toLowerCase() !== 'umum'
        ? customer.name
        : `Antrean #${heldCarts.value.length + 1}`

    const entry = {
      id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: trimmedLabel || fallbackLabel,
      items: cleanItems,
      priceTier: priceTier || 'ecer',
      customer: customer ? cloneData(customer) : null,
      totalAmount,
      totalCount,
      createdAt: new Date().toISOString()
    }

    heldCarts.value = [entry, ...heldCarts.value]
    saveToStorage(heldCarts.value)
    return entry
  }

  const resumeHeldCart = (id) => {
    const idx = heldCarts.value.findIndex((c) => c.id === id)
    if (idx === -1) return null
    const target = cloneData(heldCarts.value[idx])
    heldCarts.value = heldCarts.value.filter((c) => c.id !== id)
    saveToStorage(heldCarts.value)
    return target
  }

  const removeHeldCart = (id) => {
    heldCarts.value = heldCarts.value.filter((c) => c.id !== id)
    saveToStorage(heldCarts.value)
  }

  const clearHeldCarts = () => {
    heldCarts.value = []
    saveToStorage(heldCarts.value)
  }

  return {
    heldCarts,
    heldCount,
    holdCart,
    resumeHeldCart,
    removeHeldCart,
    clearHeldCarts,
    reloadHeldCarts
  }
}
