/**
 * Format angka nominal menjadi string ribuan bertitik (contoh: 1000 -> "1.000").
 * Mengembalikan string kosong jika nilai kosong/null/undefined/NaN.
 */
export function formatNominalInput(value) {
  if (value === '' || value === null || value === undefined) return ''
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''))
  if (!Number.isFinite(num)) return ''
  return Math.max(0, Math.trunc(num)).toLocaleString('id-ID')
}

/**
 * Parse string input nominal bertitik menjadi angka (atau '' jika kosong).
 */
export function parseNominalInput(rawValue, { emptyAsZero = false } = {}) {
  const digits = String(rawValue ?? '').replace(/\D/g, '')
  if (!digits) return emptyAsZero ? 0 : ''
  return Number(digits)
}
