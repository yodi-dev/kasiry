/**
 * Deteksi apakah input pencarian adalah kode barcode (angka >= 4 digit atau kode alfanumerik tanpa spasi yang mengandung angka).
 */
export function isLikelyBarcode(raw = '') {
  const clean = String(raw || '').trim()
  return /^\d{4,}$/.test(clean) || (!/\s/.test(clean) && /\d/.test(clean) && /^[A-Za-z0-9_-]{6,}$/.test(clean))
}
