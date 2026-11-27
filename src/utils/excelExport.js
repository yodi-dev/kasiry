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
 * @param {Array} options.restocks Riwayat kulakan / belanja stok
 * @param {Array} options.shifts Riwayat buka & tutup shift
 */
export async function exportKasiryExcel({
  storeProfile = { name: 'Warung Kasiry', owner: 'Pemilik Toko', phone: '' },
  stats = {},
  transactions = [],
  customers = [],
  debtPayments = [],
  expenses = [],
  restocks = [],
  cashServices = [],
  shifts = []
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
  const cashServiceIn = stats.todayCashServiceIn ?? 0
  const cashServiceOut = stats.todayCashServiceOut ?? 0
  const cashServiceAdminProfit = stats.todayCashServiceAdminProfit ?? 0
  const netCashDrawer = stats.todayNetCashDrawer ?? (cashDrawerTotal - expensesCash + cashServiceIn - cashServiceOut)

  const summaryData = [
    ['LAPORAN KASIR & PENJUALAN'],
    ['Nama Warung', storeProfile.name || 'Warung Kasiry'],
    ['Pemilik', storeProfile.owner || 'Pemilik Toko'],
    ['Kontak WA', storeProfile.phone || '-'],
    ['Tanggal Laporan', todayStr],
    ['Waktu Ekspor', new Date().toLocaleTimeString('id-ID')],
    [],
    ['INDIKATOR KEUANGAN HARI INI', 'NOMINAL / JUMLAH'],
    ['Penjualan Tunai (Masuk Laci)', cashSales],
    ['Penjualan QRIS (Non-Tunai)', qrisSales],
    ['Pelunasan Utang - Tunai', debtPaidCash],
    ['Pelunasan Utang - QRIS', debtPaidQris],
    ['Transfer / Top-Up Masuk Laci (Pokok + Admin)', cashServiceIn],
    ['Tarik Tunai Keluar Dari Laci (Pokok)', cashServiceOut],
    ['Jasa Admin Tarik Tunai & Transfer', cashServiceAdminProfit],
    ['Total Uang Tunai di Laci (Penjualan + Bon)', cashDrawerTotal],
    ['Total Penerimaan QRIS (Non-Tunai)', qrisTotal],
    ['Total Uang Masuk Kas (Keseluruhan)', cashDrawerTotal + qrisTotal],
    ['Pengeluaran Dari Laci (Tunai)', expensesCash],
    ['Pengeluaran Non-Tunai', expensesNonCash],
    ['Biaya Operasional Hari Ini', stats.todayOperationalExpenses || 0],
    ['Tarik / Setor Owner Hari Ini', stats.todayPriveTotal || 0],
    ['Sisa Tunai Fisik di Laci (Bersih)', netCashDrawer],
    ...(stats.isShiftScoped
      ? [
          ['Modal Awal Laci (Shift Aktif)', stats.openingCash || 0],
          ['Total Seharusnya di Laci (Termasuk Modal)', stats.expectedCashDrawer ?? netCashDrawer]
        ]
      : []),
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

  // ==========================================
  // SHEET 6: RIWAYAT SHIFT (BUKA & TUTUP BUKU)
  // ==========================================
  const shiftHeader = [
    'No',
    'Kode Shift',
    'Kasir / Penjaga',
    'Status',
    'Waktu Buka',
    'Waktu Tutup',
    'Modal Awal (Rp)',
    'Tunai Masuk Laci (Rp)',
    'QRIS (Rp)',
    'Kas Keluar Laci (Rp)',
    'Seharusnya di Laci (Rp)',
    'Uang Fisik (Rp)',
    'Selisih (Rp)',
    'Catatan'
  ]
  const activeShifts = (shifts || []).filter(s => s && !s.deleted)
  const formatShiftDate = (ts) => (ts
    ? new Date(ts).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-')
  const shiftRows = activeShifts.map((s, idx) => {
    const sum = s.summary || {}
    return [
      idx + 1,
      s.shiftCode || '-',
      s.cashierName || '-',
      s.status === 'OPEN' ? 'Masih Buka' : 'Tutup Buku',
      formatShiftDate(s.openedAt),
      formatShiftDate(s.closedAt),
      s.openingCash || 0,
      sum.todayCashDrawer || 0,
      sum.todayQrisTotal || 0,
      sum.todayExpensesCash || 0,
      s.expectedCash ?? sum.expectedCash ?? '',
      s.actualCash ?? '',
      s.cashDifference ?? '',
      s.closingNote || '-'
    ]
  })
  const wsShift = XLSX.utils.aoa_to_sheet([shiftHeader, ...shiftRows])
  wsShift['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 }
  ]
  XLSX.utils.book_append_sheet(wb, wsShift, 'Riwayat Shift')

  // ==========================================
  // SHEET 7: RIWAYAT KULAKAN / BELANJA STOK
  // ==========================================
  const restockHeader = [
    'No',
    'No. Nota',
    'Tanggal & Jam',
    'Supplier / Agen',
    'Sumber Dana',
    'Kode Shift',
    'Total Modal (Rp)',
    'Total Qty',
    'Rincian Barang',
    'Catatan'
  ]
  const activeRestocks = (restocks || []).filter(r => r && !r.deleted)
  const restockRows = activeRestocks.map((r, idx) => {
    const srcLabel = r.source === 'NON_TUNAI'
      ? 'QRIS / Rek'
      : r.source === 'DANA_LUAR'
        ? 'Dana Luar'
        : 'Tunai Laci'
    const itemsDetail = Array.isArray(r.items)
      ? r.items.map(it => `${it.productName || 'Barang'} x${it.qty || 0} (@Rp ${Number(it.unitBuyPrice || 0).toLocaleString('id-ID')})`).join('; ')
      : '-'
    return [
      idx + 1,
      r.restockNumber || `#${r.id || ''}`,
      formatShiftDate(r.createdAt),
      r.supplierName || 'Kulakan Mandiri',
      srcLabel,
      r.shiftCode || '-',
      Number(r.totalCost || 0),
      Number(r.totalItems || 0),
      itemsDetail,
      r.note || '-'
    ]
  })
  const wsRestock = XLSX.utils.aoa_to_sheet([restockHeader, ...restockRows])
  wsRestock['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
    { wch: 15 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 44 },
    { wch: 28 }
  ]
  XLSX.utils.book_append_sheet(wb, wsRestock, 'Riwayat Kulakan')

  // ==========================================
  // SHEET 8: LAYANAN TARIK TUNAI & TRANSFER
  // ==========================================
  const cashServiceHeader = [
    'No',
    'No. Nota',
    'Tanggal & Jam',
    'Jenis Layanan',
    'Channel / Bank / E-Wallet',
    'Sumber Uang Fisik',
    'Pelanggan',
    'Nominal Pokok (Rp)',
    'Biaya Admin (Rp)',
    'Total Dibayar (Rp)',
    'Kode Shift',
    'Catatan'
  ]
  const activeServices = (cashServices || []).filter(s => s && !s.deleted)
  const cashServiceRows = activeServices.map((s, idx) => [
    idx + 1,
    s.serviceNumber || `#${s.id || ''}`,
    formatShiftDate(s.createdAt),
    s.type === 'TRANSFER' ? 'Transfer / Top-Up (Laci Masuk)' : 'Tarik Tunai (Laci Keluar)',
    s.channel || 'QRIS / Transfer',
    s.cashSource === 'KAS' ? 'Uang Kas' : 'Laci Kasir',
    s.customerName || 'Pelanggan Umum',
    Number(s.amount || 0),
    Number(s.adminFee || 0),
    Number(s.totalPaid ?? (Number(s.amount || 0) + Number(s.adminFee || 0))),
    s.shiftCode || '-',
    s.note || '-'
  ])
  const wsCashService = XLSX.utils.aoa_to_sheet([cashServiceHeader, ...cashServiceRows])
  wsCashService['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 28 }
  ]
  XLSX.utils.book_append_sheet(wb, wsCashService, 'Tarik Tunai & Transfer')

  // Eksekusi download file .xlsx
  const fileDate = new Date().toISOString().slice(0, 10)
  const safeName = (storeProfile.name || 'Kasiry').replace(/\s+/g, '_')
  const fileName = `Laporan_${safeName}_${fileDate}.xlsx`

  XLSX.writeFile(wb, fileName)
  return fileName
}
