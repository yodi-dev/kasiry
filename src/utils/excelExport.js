import { getExpenseCategoryMeta, getExpenseSourceMeta } from './expenseConstants'

/**
 * Ekspor data warung ke file Microsoft Excel (.xlsx) rapi dengan multi-sheet
 * Memuat modul SheetJS secara dinamis agar tidak membebani waktu muat awal kasa,
 * namun tetap berjalan 100% offline berkat precache Service Worker.
 * 
 * @param {Object} options
 * @param {Object} options.storeProfile Profil warung (nama, pemilik, no wa)
 * @param {Object} options.stats Ringkasan statistik hari ini
 * @param {Array} options.transactions Daftar transaksi
 * @param {Array} options.customers Daftar pelanggan buku utang
 * @param {Array} options.debtPayments Riwayat pelunasan utang
 * @param {Array} options.expenses Riwayat kas keluar / pengeluaran
 */
export async function exportKasiryExcel({
  storeProfile = { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
  stats = {},
  transactions = [],
  customers = [],
  debtPayments = [],
  expenses = []
}) {
  const XLSX = await import('xlsx')
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
  const cashSales = stats.todayCashSales ?? stats.todaySales ?? 0
  const qrisSales = stats.todayQrisSales ?? 0
  const debtPaidCash = stats.todayDebtPaidCash ?? stats.todayDebtPaid ?? 0
  const debtPaidQris = stats.todayDebtPaidQris ?? 0
  const cashDrawerTotal = stats.todayCashDrawer ?? (cashSales + debtPaidCash)
  const qrisTotal = stats.todayQrisTotal ?? (qrisSales + debtPaidQris)
  const expensesCash = stats.todayExpensesCash ?? 0
  const expensesNonCash = stats.todayExpensesNonCash ?? 0
  const netCashDrawer = stats.todayNetCashDrawer ?? (cashDrawerTotal - expensesCash)

  const summaryData = [
    ['LAPORAN KASIR & PENJUALAN'],
    ['Nama Warung', storeProfile.name || 'Habiba Store'],
    ['Pemilik', storeProfile.owner || 'Habiba'],
    ['Kontak WA', storeProfile.phone || '-'],
    ['Tanggal Laporan', todayStr],
    ['Waktu Ekspor', new Date().toLocaleTimeString('id-ID')],
    [],
    ['INDIKATOR KEUANGAN HARI INI', 'NOMINAL / JUMLAH'],
    ['Penjualan Tunai (Masuk Laci)', cashSales],
    ['Penjualan QRIS (Non-Tunai)', qrisSales],
    ['Pelunasan Utang - Tunai', debtPaidCash],
    ['Pelunasan Utang - QRIS', debtPaidQris],
    ['Total Uang Tunai di Laci', cashDrawerTotal],
    ['Total Penerimaan QRIS (Non-Tunai)', qrisTotal],
    ['Total Uang Masuk Kas (Keseluruhan)', cashDrawerTotal + qrisTotal],
    ['Pengeluaran Dari Laci (Tunai)', expensesCash],
    ['Pengeluaran Non-Tunai', expensesNonCash],
    ['Biaya Operasional Hari Ini', stats.todayOperationalExpenses || 0],
    ['Tarik / Setor Owner Hari Ini', stats.todayPriveTotal || 0],
    ['Sisa Tunai Fisik di Laci (Bersih)', netCashDrawer],
    ['Estimasi Untung Bersih', stats.todayProfit || 0],
    ['Bon / Utang Baru Tercatat', stats.todayNewDebt || 0],
    ['Total Transaksi / Struk', `${stats.transactionCount || 0} Kali`],
    ['Total Piutang Belum Lunas (Semua Pelanggan)', customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)]
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

    const txDate = t.createdAt
      ? new Date(t.createdAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '-'

    return [
      idx + 1,
      txDate,
      t.invoiceNumber || '-',
      t.paymentMethod || 'TUNAI',
      t.customerName || (t.paymentMethod === 'UTANG / BON' ? '-' : 'Pelanggan Umum'),
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
    { wch: 18 },
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
  // SHEET 4: BUKU UTANG PELANGGAN
  // ==========================================
  const debtHeader = [
    'No',
    'Nama Pelanggan',
    'Nomor WhatsApp / HP',
    'Sisa Bon / Utang (Rp)',
    'Terakhir Belanja / Transaksi',
    'Status'
  ]
  const debtRows = customers
    .filter(c => c.name?.toLowerCase() !== 'umum' || (c.totalDebt || 0) > 0)
    .map((c, idx) => [
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
  XLSX.utils.book_append_sheet(wb, wsDebt, 'Buku Utang Pelanggan')

  // ==========================================
  // SHEET 5: PENGELUARAN KAS
  // ==========================================
  const expenseHeader = [
    'No',
    'Waktu',
    'No. Catatan',
    'Kategori',
    'Sumber Uang',
    'Status Biaya',
    'Nominal (Rp)',
    'Keterangan'
  ]
  const activeExpenses = (expenses || []).filter(e => e && !e.deleted)
  const expenseRows = activeExpenses.map((e, idx) => {
    const meta = getExpenseCategoryMeta(e.category)
    const src = getExpenseSourceMeta(e.source)
    const expDate = e.createdAt
      ? new Date(e.createdAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '-'
    return [
      idx + 1,
      expDate,
      e.expenseNumber || '-',
      meta.label,
      src.label,
      meta.affectsProfit ? 'Biaya Operasional' : 'Non-Biaya (Tarik Owner/Stok)',
      e.amount || 0,
      e.note || '-'
    ]
  })
  const wsExpense = XLSX.utils.aoa_to_sheet([expenseHeader, ...expenseRows])
  wsExpense['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 15 },
    { wch: 20 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 36 }
  ]
  XLSX.utils.book_append_sheet(wb, wsExpense, 'Pengeluaran Kas')

  // Eksekusi download file .xlsx
  const fileDate = new Date().toISOString().slice(0, 10)
  const safeName = (storeProfile.name || 'Kasiry').replace(/\s+/g, '_')
  const fileName = `Laporan_${safeName}_${fileDate}.xlsx`

  XLSX.writeFile(wb, fileName)
  return fileName
}
