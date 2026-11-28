/**
 * Parse format copy-paste Token PLN dari Fastpay / loket PPOB:
 * Contoh: "5702-3195-8454-5494-4868/SRI RIDHOAH/R1/000002200VA/125,9kWh"
 */
export function parseFastpayPlnToken(rawText = '') {
  const raw = String(rawText || '').trim()
  if (!raw || !raw.includes('/')) return null

  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const digitsOnly = parts[0].replace(/[^0-9]/g, '')
  if (digitsOnly.length !== 20) return null

  const tokenCode = digitsOnly.match(/.{1,4}/g).join('-')
  const customerName = parts[1] || ''
  const tariff = parts[2] || ''
  const rawPower = parts[3] || ''
  const power = rawPower.replace(/^0+(?=\d)/, '')
  const kwh = parts[4] || ''

  const detailParts = []
  if (customerName) detailParts.push(customerName)
  if (tariff || power) detailParts.push([tariff, power].filter(Boolean).join('/'))
  if (kwh) detailParts.push(kwh)

  return {
    tokenCode,
    customerName,
    tariff,
    power,
    kwh,
    summaryNote: detailParts.join(' • ')
  }
}
