import * as XLSX from 'xlsx'

/**
 * Ekspor data warung ke file Microsoft Excel (.xlsx) rapi dengan multi-sheet
 * Berjalan 100% offline langsung di browser HP maupun PC.
 * 
 * @param {Object} options
 * @param {Object} options.storeProfile Profil warung (nama, pemilik, no wa)
 * @param {Object} options.stats Ringkasan statistik hari ini
 * @param {Array} options.transactions Daftar transaksi
 * @param {Array} options.customers Daftar pelanggan buku utang
 * @param {Array} options.debtPayments Riwayat pelunasan utang
 */
export function exportKasiryExcel({
  storeProfile = { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
  stats = {},
  transactions = [],
  customers = [],
  debtPayments = []
}) {
  const wb = XLSX.utils.book_new()
  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  // ==========================================
  // SHEET 1: RINGKASAN KAS
  // ==========================================
  const summaryData = [
    ['LAPORAN KASIR & PENJUALAN'],
    ['Nama Warung', storeProfile.name || 'Habiba Store'],
    ['Pemilik', storeProfile.owner || 'Habiba'],
    ['Kontak WA', storeProfile.phone || '-'],
    ['Tanggal Laporan', todayStr],
    ['Waktu Ekspor', new Date().toLocaleTimeString('id-ID')],
    [],
    ['INDIKATOR KEUANGAN HARI INI', 'NOMINAL / JUMLAH'],
    ['Penjualan Tunai', stats.todaySales || 0],
    ['Pelunasan Utang Diterima', stats.todayDebtPaid || 0],
    ['Total Uang Masuk Kas', (stats.todaySales || 0) + (stats.todayDebtPaid || 0)],
    ['Estimasi Untung Bersih', stats.todayProfit || 0],
    ['Bon / Utang Baru Tercatat', stats.todayNewDebt || 0],
    ['Total Transaksi / Struk', `${stats.transactionCount || 0} Kali`],
    ['Total Piutang Belum Lunas (Semua Tetangga)', customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)]
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Kas')

  // ==========================================
  // SHEET 2: DAFTAR TRANSAKSI
  // ==========================================
  const txHeader = [
    'No',
    'Waktu',
    'No. Nota / Invoice',
    'Metode Bayar',
    'Nama Pelanggan',
    'Total Belanja (Rp)',
    'Uang Diberikan (Rp)',
    'Kembalian (Rp)',
    'Jumlah Item',
    'Rincian Barang'
  ]
  const txRows = transactions.map((t, idx) => {
    const itemsSummary = (t.items || [])
      .map(i => `${i.qty}x ${i.name}`)
      .join(', ')

    const txDate = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'

    return [
      idx + 1,
      txDate,
      t.invoiceNumber || '-',
      t.paymentMethod || 'TUNAI',
      t.customerName || (t.paymentMethod === 'TUNAI' ? 'Pelanggan Umum' : '-'),
      t.totalAmount || 0,
      t.cashGiven || t.totalAmount || 0,
      t.changeAmount || 0,
      (t.items || []).reduce((acc, i) => acc + (i.qty || 1), 0),
      itemsSummary
    ]
  })
  const wsTx = XLSX.utils.aoa_to_sheet([txHeader, ...txRows])
  wsTx['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 45 }
  ]
  XLSX.utils.book_append_sheet(wb, wsTx, 'Daftar Transaksi')

  // ==========================================
  // SHEET 3: RINCIAN BARANG TERJUAL
  // ==========================================
  const productAgg = {}
  transactions.forEach(t => {
    (t.items || []).forEach(item => {
      if (!productAgg[item.name]) {
        productAgg[item.name] = {
          name: item.name,
          qty: 0,
          sellPrice: item.sellPrice || 0,
          buyPrice: item.buyPrice || Math.round((item.sellPrice || 0) * 0.8),
          totalSales: 0,
          totalProfit: 0
        }
      }
      productAgg[item.name].qty += item.qty
      productAgg[item.name].totalSales += item.sellPrice * item.qty
      const profitPerUnit = item.sellPrice - (item.buyPrice || Math.round(item.sellPrice * 0.8))
      productAgg[item.name].totalProfit += profitPerUnit * item.qty
    })
  })

  const prodHeader = [
    'No',
    'Nama Barang',
    'Jumlah Terjual (Pcs)',
    'Harga Jual Satuan (Rp)',
    'Estimasi Modal Satuan (Rp)',
    'Total Omzet (Rp)',
    'Estimasi Keuntungan (Rp)'
  ]
  const prodRows = Object.values(productAgg)
    .sort((a, b) => b.qty - a.qty)
    .map((p, idx) => [
      idx + 1,
      p.name,
      p.qty,
      p.sellPrice,
      p.buyPrice,
      p.totalSales,
      p.totalProfit
    ])
  const wsProd = XLSX.utils.aoa_to_sheet([prodHeader, ...prodRows])
  wsProd['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 22 },
    { wch: 22 },
    { wch: 25 },
    { wch: 20 },
    { wch: 24 }
  ]
  XLSX.utils.book_append_sheet(wb, wsProd, 'Barang Terjual')

  // ==========================================
  // SHEET 4: BUKU UTANG TETANGGA
  // ==========================================
  const debtHeader = [
    'No',
    'Nama Pelanggan',
    'Nomor WhatsApp / HP',
    'Sisa Bon / Utang (Rp)',
    'Terakhir Belanja / Transaksi',
    'Status'
  ]
  const debtRows = customers.map((c, idx) => [
    idx + 1,
    c.name,
    c.phone || '-',
    c.totalDebt || 0,
    c.lastDate || 'Hari ini',
    (c.totalDebt || 0) > 0 ? 'Belum Lunas' : 'Lunas'
  ])
  const wsDebt = XLSX.utils.aoa_to_sheet([debtHeader, ...debtRows])
  wsDebt['!cols'] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 }
  ]
  XLSX.utils.book_append_sheet(wb, wsDebt, 'Buku Utang Tetangga')

  // Eksekusi download file .xlsx
  const fileDate = new Date().toISOString().slice(0, 10)
  const safeName = (storeProfile.name || 'Kasiry').replace(/\s+/g, '_')
  const fileName = `Laporan_${safeName}_${fileDate}.xlsx`

  XLSX.writeFile(wb, fileName)
  return fileName
}
