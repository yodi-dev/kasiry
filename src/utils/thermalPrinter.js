// Encoder ESC/POS Murni & Pemformat Struk Thermal 58mm / 80mm (Tanpa Dependensi Eksternal)

export const PRINTER_DEFAULT_SETTINGS = {
  paperWidth: '58mm', // '58mm' (32 kolom) | '80mm' (48 kolom)
  autoPrint: false,
  footerText: 'Terima kasih telah berbelanja!',
  printerName: ''
}

export function getColumnsForPaper(paperWidth = '58mm') {
  return paperWidth === '80mm' ? 48 : 32
}

/**
 * Bersihkan teks menjadi ASCII printable agar printer thermal CP437/PC437 tidak mencetak karakter acak.
 */
export function sanitizeEscPosText(input = '') {
  return String(input ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[^\x20-\x7E\n]/g, ' ')
}

export function formatWrapText(text = '', width = 32) {
  const clean = sanitizeEscPosText(text).replace(/\n+/g, ' ').trim()
  if (!clean) return []
  const maxCols = Math.max(16, Number(width) || 32)
  const lines = []
  let remaining = clean

  while (remaining.length > maxCols) {
    let splitIdx = remaining.lastIndexOf(' ', maxCols)
    if (splitIdx <= 0) splitIdx = maxCols
    lines.push(remaining.slice(0, splitIdx).trim())
    remaining = remaining.slice(splitIdx).trim()
  }
  if (remaining.length > 0) lines.push(remaining)
  return lines
}

export function formatTwoColumnLine(left = '', right = '', width = 32) {
  const maxCols = Math.max(16, Number(width) || 32)
  const cleanLeft = sanitizeEscPosText(left).trim()
  const cleanRight = sanitizeEscPosText(right).trim()

  if (!cleanRight) {
    return cleanLeft.slice(0, maxCols)
  }
  const minSpace = 1
  if (cleanLeft.length + cleanRight.length + minSpace <= maxCols) {
    const spaces = maxCols - cleanLeft.length - cleanRight.length
    return cleanLeft + ' '.repeat(spaces) + cleanRight
  }
  const availableLeft = Math.max(1, maxCols - cleanRight.length - minSpace)
  return cleanLeft.slice(0, availableLeft) + ' ' + cleanRight
}

function encodeAsciiBytes(text = '') {
  const clean = sanitizeEscPosText(text)
  const bytes = new Array(clean.length)
  for (let i = 0; i < clean.length; i += 1) {
    bytes[i] = clean.charCodeAt(i) & 0x7F
  }
  return bytes
}

const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

const CMD_INIT = [ESC, 0x40]
const CMD_ALIGN_LEFT = [ESC, 0x61, 0x00]
const CMD_ALIGN_CENTER = [ESC, 0x61, 0x01]
const CMD_BOLD_ON = [ESC, 0x45, 0x01]
const CMD_BOLD_OFF = [ESC, 0x45, 0x00]
const CMD_DOUBLE_HEIGHT_ON = [GS, 0x21, 0x01]
const CMD_NORMAL_SIZE = [GS, 0x21, 0x00]

const formatRp = (val) => `Rp ${Math.round(Number(val || 0)).toLocaleString('id-ID')}`

/**
 * Bangun byte array ESC/POS lengkap untuk struk transaksi Kasiry POS.
 */
export function buildReceiptEscPosBytes(receiptData, storeProfile = {}, options = {}) {
  if (!receiptData) return new Uint8Array(0)
  const cols = getColumnsForPaper(options.paperWidth)
  const dash = '-'.repeat(cols)
  const eqDash = '='.repeat(cols)
  const footerText = typeof options.footerText === 'string'
    ? options.footerText.trim()
    : PRINTER_DEFAULT_SETTINGS.footerText

  const storeName = (storeProfile?.name || 'Warung Kasiry').trim().toUpperCase()
  const storePhone = (storeProfile?.phone || '').trim()

  const buf = []
  const pushBytes = (arr) => buf.push(...arr)
  const pushLine = (text = '') => {
    pushBytes(encodeAsciiBytes(text))
    buf.push(LF)
  }

  // 1. Header Kop Warung
  pushBytes(CMD_INIT)
  pushBytes(CMD_ALIGN_CENTER)
  pushBytes(CMD_BOLD_ON)
  pushBytes(CMD_DOUBLE_HEIGHT_ON)
  for (const l of formatWrapText(storeName, cols)) {
    pushLine(l)
  }
  pushBytes(CMD_NORMAL_SIZE)
  pushBytes(CMD_BOLD_OFF)
  if (storePhone) {
    pushLine(`WA: ${storePhone}`)
  }
  pushLine(dash)

  // 2. Meta Transaksi
  pushBytes(CMD_ALIGN_LEFT)
  pushLine(formatTwoColumnLine(`No: ${receiptData.invoiceNumber || '-'}`, receiptData.time || '', cols))
  const custLabel = receiptData.customer?.name ? `Plg: ${receiptData.customer.name}` : ''
  pushLine(formatTwoColumnLine(`Bayar: ${receiptData.paymentMethod || 'TUNAI'}`, custLabel, cols))
  pushLine(eqDash)

  // 3. Rincian Item
  const items = Array.isArray(receiptData.items) ? receiptData.items : []
  for (const item of items) {
    for (const nameLine of formatWrapText(item.name || 'Barang', cols)) {
      pushLine(nameLine)
    }
    const tierSuffix = item.priceTier && item.priceTier !== 'ecer'
      ? ` (${item.priceLabel || item.priceTier})`
      : ''
    const qtyLeft = ` ${item.qty || 1} x ${formatRp(item.sellPrice)}${tierSuffix}`
    const subRight = formatRp((Number(item.sellPrice || 0)) * (Number(item.qty || 1)))
    pushLine(formatTwoColumnLine(qtyLeft, subRight, cols))
  }
  pushLine(dash)

  // 4. Total, Tunai/QRIS & Kembalian
  pushBytes(CMD_BOLD_ON)
  pushLine(formatTwoColumnLine('TOTAL', formatRp(receiptData.totalAmount), cols))
  pushBytes(CMD_BOLD_OFF)

  if (receiptData.paymentMethod === 'TUNAI') {
    pushLine(formatTwoColumnLine('Tunai', formatRp(receiptData.cashGiven), cols))
    pushLine(formatTwoColumnLine('Kembali', formatRp(receiptData.changeAmount), cols))
  } else if (receiptData.paymentMethod === 'QRIS') {
    pushLine(formatTwoColumnLine('Status', 'LUNAS (QRIS)', cols))
  } else {
    pushLine(formatTwoColumnLine('Status', 'DICATAT DI BUKU UTANG', cols))
  }

  // 5. Footer Kustom
  pushLine(dash)
  pushBytes(CMD_ALIGN_CENTER)
  if (footerText) {
    for (const fLine of formatWrapText(footerText, cols)) {
      pushLine(fLine)
    }
  }
  pushLine('Kasiry POS')
  buf.push(LF, LF, LF)

  return new Uint8Array(buf)
}

/**
 * Bangun byte ESC/POS untuk Tes Cetak Printer Bluetooth di Pengaturan.
 */
export function buildTestPrintEscPosBytes(storeProfile = {}, options = {}) {
  const paperWidth = options.paperWidth === '80mm' ? '80mm' : '58mm'
  const cols = getColumnsForPaper(paperWidth)
  const dash = '-'.repeat(cols)
  const storeName = (storeProfile?.name || 'Warung Kasiry').trim().toUpperCase()
  const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const buf = []
  const pushBytes = (arr) => buf.push(...arr)
  const pushLine = (text = '') => {
    pushBytes(encodeAsciiBytes(text))
    buf.push(LF)
  }

  pushBytes(CMD_INIT)
  pushBytes(CMD_ALIGN_CENTER)
  pushBytes(CMD_BOLD_ON)
  pushLine('TES CETAK KASIRY POS')
  pushBytes(CMD_BOLD_OFF)
  pushLine(storeName)
  pushLine(dash)
  pushBytes(CMD_ALIGN_LEFT)
  pushLine(formatTwoColumnLine('Kertas Aktif', `${paperWidth} (${cols} kol)`, cols))
  pushLine(formatTwoColumnLine('Waktu Tes', nowStr, cols))
  pushLine(dash)
  pushBytes(CMD_ALIGN_CENTER)
  pushLine('Printer Bluetooth Terhubung OK!')
  if (options.footerText) {
    for (const fLine of formatWrapText(options.footerText, cols)) {
      pushLine(fLine)
    }
  }
  buf.push(LF, LF, LF)

  return new Uint8Array(buf)
}

/**
 * Pecah payload ESC/POS menjadi paket kecil agar kompatibel dengan batas MTU karakteristik BLE printer.
 */
export function splitIntoBleChunks(bytes, chunkSize = 80) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return []
  const size = Math.max(20, Math.round(Number(chunkSize) || 80))
  const chunks = []
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size))
  }
  return chunks
}
