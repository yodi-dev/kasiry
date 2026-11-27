export const EXPENSE_CATEGORIES = [
  {
    id: 'operasional',
    label: 'Operasional',
    hint: 'Plastik, galon, listrik, kemasan',
    affectsProfit: true
  },
  {
    id: 'transport',
    label: 'Makan & Transport',
    hint: 'Bensin, kurir, ongkir, makan jaga',
    affectsProfit: true
  },
  {
    id: 'prive',
    label: 'Tarik / Setor Owner',
    hint: 'Ambil kas laci (tidak kurangi untung)',
    affectsProfit: false
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    hint: 'Keperluan toko lainnya',
    affectsProfit: true
  }
]

export const EXPENSE_SOURCES = [
  {
    id: 'TUNAI_LACI',
    label: 'Tunai (Dari Laci)',
    shortLabel: 'Dari Laci'
  },
  {
    id: 'NON_TUNAI',
    label: 'Non-Tunai (QRIS / Rek)',
    shortLabel: 'Non-Tunai'
  }
]

export const getExpenseCategoryMeta = (categoryId) => {
  if (categoryId === 'kulakan') {
    return {
      id: 'kulakan',
      label: 'Kulakan Stok',
      hint: 'Belanja stok dagangan',
      affectsProfit: false
    }
  }
  return EXPENSE_CATEGORIES.find(c => c.id === categoryId) || EXPENSE_CATEGORIES[3]
}

export const getExpenseSourceMeta = (sourceId) => {
  return EXPENSE_SOURCES.find(s => s.id === sourceId) || EXPENSE_SOURCES[0]
}
