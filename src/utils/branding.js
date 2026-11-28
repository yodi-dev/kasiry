export const APP_BRAND_NAME = 'Kasiry by Awanbeo'
export const APP_BRAND_TAGLINE = 'Kasir Warung, Konter & Keuangan UMKM'
export const DEFAULT_DOCUMENT_TITLE = `${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE}`
export const DEFAULT_STORE_INITIALS = 'KS'

/**
 * Format judul tab browser dinamis berdasarkan nama toko pengguna.
 */
export function formatDocumentTitle(storeName = '') {
  const cleanName = String(storeName || '').trim()
  if (!cleanName || cleanName.toLowerCase() === 'warung kasiry') {
    return DEFAULT_DOCUMENT_TITLE
  }
  return `${cleanName} — ${APP_BRAND_NAME}`
}

/**
 * Ambil 2 huruf inisial avatar toko dengan fallback aman ke 'KS' (Kasiry).
 */
export function getStoreInitials(storeName = '') {
  const cleanName = String(storeName || '').trim()
  return cleanName ? cleanName.substring(0, 2).toUpperCase() : DEFAULT_STORE_INITIALS
}
