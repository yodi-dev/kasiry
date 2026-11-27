// Encoder ESC/POS Murni & Pemformat Struk Thermal 58mm / 80mm (Tanpa Dependensi Eksternal)

export const PRINTER_DEFAULT_SETTINGS = {
  paperWidth: '58mm', // '58mm' (32 kolom) | '80mm' (48 kolom)
  autoPrint: false,
  footerText: 'Terima kasih telah berbelanja!',
  printerName: ''
}

export const RECEIPT_BRAND_FOOTER = 'Kasiry by Awanbeo'

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

  if (receiptData.digitalMeta) {
    if (receiptData.digitalMeta.targetNumber) {
      pushLine(dash)
      for (const tLine of formatWrapText(`No. Tujuan: ${receiptData.digitalMeta.targetNumber}`, cols)) {
        pushLine(tLine)
      }
    }
    if (receiptData.digitalMeta.tokenCode) {
      pushLine('TOKEN / SN:')
      pushBytes(CMD_BOLD_ON)
      for (const tokLine of formatWrapText(receiptData.digitalMeta.tokenCode, cols)) {
        pushLine(tokLine)
      }
      pushBytes(CMD_BOLD_OFF)
    }
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
  } else if (receiptData.paymentMethod === 'TARIK TUNAI' || receiptData.serviceMeta?.type === 'TARIK_TUNAI') {
    const svcAmt = receiptData.serviceMeta?.amount ?? receiptData.cashGiven ?? receiptData.totalAmount
    pushLine(formatTwoColumnLine('Via QRIS/Tf', formatRp(receiptData.totalAmount), cols))
    pushLine(formatTwoColumnLine('Uang Tunai', formatRp(svcAmt), cols))
    pushLine(formatTwoColumnLine('Status', 'SELESAI (LACI)', cols))
  } else if (receiptData.paymentMethod === 'TRANSFER / TOP-UP' || receiptData.serviceMeta?.type === 'TRANSFER') {
    const svcAmt = receiptData.serviceMeta?.amount ?? receiptData.totalAmount
    pushLine(formatTwoColumnLine('Bayar Tunai', formatRp(receiptData.cashGiven ?? receiptData.totalAmount), cols))
    pushLine(formatTwoColumnLine('Kirim Saldo', formatRp(svcAmt), cols))
    pushLine(formatTwoColumnLine('Status', 'SELESAI (NON-TUNAI)', cols))
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
  pushLine(RECEIPT_BRAND_FOOTER)
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
  pushLine('TES CETAK KASIRY')
  pushBytes(CMD_BOLD_OFF)
  pushLine(storeName)
  pushLine(dash)
  pushBytes(CMD_ALIGN_LEFT)
  pushLine(formatTwoColumnLine('Kertas Aktif', `${paperWidth} (${cols} kol)`, cols))
  pushLine(formatTwoColumnLine('Waktu Tes', nowStr, cols))
  pushLine(dash)
  pushBytes(CMD_ALIGN_CENTER)
  pushLine('Printer Thermal Terhubung OK!')
  if (options.footerText) {
    for (const fLine of formatWrapText(options.footerText, cols)) {
      pushLine(fLine)
    }
  }
  pushLine(RECEIPT_BRAND_FOOTER)
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

function escapeHtml(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrapStandaloneThermalDocument({ title, widthMm, bodyHtml }) {
  const is80 = widthMm === '80mm'
  const pageWidth = is80 ? '80mm' : '58mm'
  const fontSize = is80 ? '12px' : '11px'

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page {
    size: ${pageWidth} auto;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: ${pageWidth};
    background: #ffffff;
    color: #000000;
    font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: ${fontSize};
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .paper {
    width: ${pageWidth};
    padding: 3mm 2.5mm 6mm;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .upper { text-transform: uppercase; }
  .store-title { font-size: ${is80 ? '15px' : '13px'}; font-weight: 800; letter-spacing: 0.4px; margin: 0; }
  .muted { font-size: ${is80 ? '11px' : '10px'}; margin: 1px 0; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin: 2px 0; }
  .divider { border: 0; border-top: 1px dashed #000000; margin: 6px 0; }
  .divider-double { border: 0; border-top: 2px solid #000000; margin: 6px 0; }
  .item { margin: 4px 0; }
  .item-name { font-weight: 600; word-break: break-word; }
  .total-row { font-size: ${is80 ? '14px' : '13px'}; font-weight: 800; margin: 4px 0; }
</style>
</head>
<body>
  <div class="paper">${bodyHtml}</div>
</body>
</html>`
}

/**
 * Bangun dokumen HTML terisolasi untuk cetak browser (iframe) bebas backdrop/modal Chrome/Edge.
 */
export function buildReceiptPrintHtml(receiptData, storeProfile = {}, options = {}) {
  if (!receiptData) return ''
  const widthMm = options.paperWidth === '80mm' ? '80mm' : '58mm'
  const storeName = (storeProfile?.name || 'Warung Kasiry').trim()
  const storePhone = (storeProfile?.phone || '').trim()
  const footerText = typeof options.footerText === 'string'
    ? options.footerText.trim()
    : PRINTER_DEFAULT_SETTINGS.footerText

  const items = Array.isArray(receiptData.items) ? receiptData.items : []
  const itemsHtml = items.map((item) => {
    const qty = Number(item.qty || 1)
    const unitPrice = Number(item.sellPrice || 0)
    const tierSuffix = item.priceTier && item.priceTier !== 'ecer'
      ? ` (${item.priceLabel || item.priceTier})`
      : ''
    return `<div class="item">
      <div class="item-name">${escapeHtml(item.name || 'Barang')}</div>
      <div class="row muted">
        <span>${qty} x ${escapeHtml(formatRp(unitPrice))}${escapeHtml(tierSuffix)}</span>
        <span class="bold right">${escapeHtml(formatRp(unitPrice * qty))}</span>
      </div>
    </div>`
  }).join('')

  let digitalMetaHtml = ''
  if (receiptData.digitalMeta && (receiptData.digitalMeta.targetNumber || receiptData.digitalMeta.tokenCode)) {
    digitalMetaHtml = `
      <hr class="divider" />
      ${receiptData.digitalMeta.targetNumber ? `<div class="row"><span>No. Tujuan / ID</span><span class="bold">${escapeHtml(receiptData.digitalMeta.targetNumber)}</span></div>` : ''}
      ${receiptData.digitalMeta.tokenCode ? `<div class="item" style="margin-top:4px;"><div class="muted">TOKEN / SN:</div><div class="bold" style="font-size:12px;letter-spacing:0.06em;word-break:break-all;">${escapeHtml(receiptData.digitalMeta.tokenCode)}</div></div>` : ''}
    `
  }

  let paymentDetailsHtml = ''
  if (receiptData.paymentMethod === 'TUNAI') {
    paymentDetailsHtml = `
      <div class="row"><span>Tunai</span><span>${escapeHtml(formatRp(receiptData.cashGiven))}</span></div>
      <div class="row bold"><span>Kembali</span><span>${escapeHtml(formatRp(receiptData.changeAmount))}</span></div>`
  } else if (receiptData.paymentMethod === 'QRIS') {
    paymentDetailsHtml = `
      <div class="row"><span>Status</span><span class="bold">LUNAS (QRIS)</span></div>`
  } else if (receiptData.paymentMethod === 'TARIK TUNAI' || receiptData.serviceMeta?.type === 'TARIK_TUNAI') {
    const svcAmt = receiptData.serviceMeta?.amount ?? receiptData.cashGiven ?? receiptData.totalAmount
    paymentDetailsHtml = `
      <div class="row"><span>Transfer Masuk</span><span>${escapeHtml(formatRp(receiptData.totalAmount))}</span></div>
      <div class="row bold"><span>Uang Tunai Diserahkan</span><span>${escapeHtml(formatRp(svcAmt))}</span></div>
      <div class="row"><span>Status</span><span class="bold">SELESAI (TARIK TUNAI)</span></div>`
  } else if (receiptData.paymentMethod === 'TRANSFER / TOP-UP' || receiptData.serviceMeta?.type === 'TRANSFER') {
    const svcAmt = receiptData.serviceMeta?.amount ?? receiptData.totalAmount
    paymentDetailsHtml = `
      <div class="row"><span>Bayar Tunai</span><span>${escapeHtml(formatRp(receiptData.cashGiven ?? receiptData.totalAmount))}</span></div>
      <div class="row bold"><span>Nominal Dikirim</span><span>${escapeHtml(formatRp(svcAmt))}</span></div>
      <div class="row"><span>Status</span><span class="bold">SELESAI (TRANSFER)</span></div>`
  } else {
    paymentDetailsHtml = `
      <div class="row"><span>Status</span><span class="bold">DICATAT DI BUKU UTANG</span></div>`
  }

  const custHtml = receiptData.customer?.name
    ? `<span>Plg: ${escapeHtml(receiptData.customer.name)}</span>`
    : ''

  const bodyHtml = `
    <div class="center">
      <p class="store-title upper">${escapeHtml(storeName)}</p>
      ${storePhone ? `<p class="muted">WA: ${escapeHtml(storePhone)}</p>` : ''}
    </div>
    <hr class="divider" />
    <div class="row muted">
      <span>No: ${escapeHtml(receiptData.invoiceNumber || '-')}</span>
      <span>${escapeHtml(receiptData.time || '')}</span>
    </div>
    <div class="row muted">
      <span>Metode: ${escapeHtml(receiptData.paymentMethod || 'TUNAI')}</span>
      ${custHtml}
    </div>
    <hr class="divider-double" />
    ${itemsHtml}
    ${digitalMetaHtml}
    <hr class="divider" />
    <div class="row total-row">
      <span>TOTAL</span>
      <span>${escapeHtml(formatRp(receiptData.totalAmount))}</span>
    </div>
    ${paymentDetailsHtml}
    <hr class="divider" />
    <div class="center muted">
      ${footerText ? `<div>${escapeHtml(footerText)}</div>` : ''}
      <div>${escapeHtml(RECEIPT_BRAND_FOOTER)}</div>
    </div>`

  return wrapStandaloneThermalDocument({
    title: `Struk ${receiptData.invoiceNumber || 'Kasiry'}`,
    widthMm,
    bodyHtml
  })
}

/**
 * Bangun dokumen HTML terisolasi untuk Tes Cetak Browser.
 */
export function buildTestPrintHtml(storeProfile = {}, options = {}) {
  const widthMm = options.paperWidth === '80mm' ? '80mm' : '58mm'
  const cols = getColumnsForPaper(widthMm)
  const storeName = (storeProfile?.name || 'Warung Kasiry').trim()
  const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const footerText = typeof options.footerText === 'string'
    ? options.footerText.trim()
    : PRINTER_DEFAULT_SETTINGS.footerText

  const bodyHtml = `
    <div class="center">
      <p class="store-title upper">TES CETAK KASIRY</p>
      <p class="muted bold upper">${escapeHtml(storeName)}</p>
    </div>
    <hr class="divider" />
    <div class="row muted"><span>Kertas Aktif</span><span class="bold">${widthMm} (${cols} kol)</span></div>
    <div class="row muted"><span>Waktu Tes</span><span>${escapeHtml(nowStr)}</span></div>
    <hr class="divider" />
    <div class="center">
      <p class="bold" style="margin:4px 0;">Layout Cetak Struk Siap!</p>
      ${footerText ? `<p class="muted">${escapeHtml(footerText)}</p>` : ''}
      <p class="muted">${escapeHtml(RECEIPT_BRAND_FOOTER)}</p>
    </div>`

  return wrapStandaloneThermalDocument({
    title: 'Tes Cetak Kasiry by Awanbeo',
    widthMm,
    bodyHtml
  })
}
