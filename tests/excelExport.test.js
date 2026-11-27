import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import { exportKasiryExcel } from '../src/utils/excelExport'

describe('exportKasiryExcel (Dynamic SheetJS Multi-Sheet Export)', () => {
  let prevCwd
  let tempDir

  beforeEach(() => {
    prevCwd = process.cwd()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasiry-xlsx-'))
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(prevCwd)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('lazily imports xlsx and creates valid 5-sheet workbook including QRIS, expenses, and debts', async () => {
    const fileName = await exportKasiryExcel({
      storeProfile: { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
      stats: {
        todaySales: 52000,
        todayCashSales: 22000,
        todayQrisSales: 30000,
        todayDebtPaid: 10000,
        todayDebtPaidCash: 10000,
        todayDebtPaidQris: 0,
        todayCashDrawer: 32000,
        todayQrisTotal: 30000,
        todayExpensesCash: 7000,
        todayExpensesNonCash: 0,
        todayOperationalExpenses: 7000,
        todayPriveTotal: 0,
        todayNetCashDrawer: 25000,
        todayProfit: 2000,
        todayNewDebt: 15000,
        transactionCount: 3
      },
      transactions: [
        {
          invoiceNumber: 'KSR-1001',
          createdAt: Date.now(),
          paymentMethod: 'TUNAI',
          customerName: 'Umum',
          totalAmount: 22000,
          cashGiven: 50000,
          changeAmount: 28000,
          items: [{ id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, buyPrice: 19000, qty: 1 }]
        },
        {
          invoiceNumber: 'QRS-1002',
          createdAt: Date.now(),
          paymentMethod: 'QRIS',
          customerName: '',
          totalAmount: 30000,
          cashGiven: 30000,
          changeAmount: 0,
          items: [{ id: 3, name: 'Telur 1kg', sellPrice: 30000, buyPrice: 26000, qty: 1 }]
        },
        {
          invoiceNumber: 'BON-1000',
          createdAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
          paymentMethod: 'UTANG / BON',
          customerName: 'Bu Tejo',
          totalAmount: 15000,
          items: [{ id: 2, name: 'Minyakita 1L', sellPrice: 15000, buyPrice: 13000, qty: 1 }]
        }
      ],
      customers: [
        { id: 1, name: 'Umum', phone: '', totalDebt: 0 },
        { id: 2, name: 'Bu Tejo', phone: '081234567891', totalDebt: 15000, lastDate: 'Hari ini' }
      ],
      debtPayments: [],
      expenses: [
        {
          id: 1,
          expenseNumber: 'KLR-101',
          createdAt: Date.now(),
          category: 'operasional',
          source: 'TUNAI_LACI',
          amount: 7000,
          note: 'Beli kresek',
          deleted: false
        }
      ]
    })

    expect(fileName).toMatch(/^Laporan_Habiba_Store_\d{4}-\d{2}-\d{2}\.xlsx$/)
    const outPath = path.join(tempDir, fileName)
    expect(fs.existsSync(outPath)).toBe(true)

    const workbook = XLSX.readFile(outPath)
    expect(workbook.SheetNames).toEqual([
      'Ringkasan Kas',
      'Daftar Transaksi',
      'Barang Terjual',
      'Buku Utang Pelanggan',
      'Pengeluaran Kas'
    ])

    const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets['Ringkasan Kas'], { header: 1 })
    const summaryMap = Object.fromEntries(summaryRows.filter(r => r.length >= 2))
    expect(summaryMap['Total Uang Tunai di Laci']).toBe(32000)
    expect(summaryMap['Total Penerimaan QRIS (Non-Tunai)']).toBe(30000)
    expect(summaryMap['Total Uang Masuk Kas (Keseluruhan)']).toBe(62000)
    expect(summaryMap['Pengeluaran Dari Laci (Tunai)']).toBe(7000)
    expect(summaryMap['Sisa Tunai Fisik di Laci (Bersih)']).toBe(25000)

    const txRows = XLSX.utils.sheet_to_json(workbook.Sheets['Daftar Transaksi'])
    expect(txRows).toHaveLength(3)
    expect(txRows.map(r => r['No. Nota / Invoice'])).toEqual(['KSR-1001', 'QRS-1002', 'BON-1000'])
    expect(txRows[1]['Metode Bayar']).toBe('QRIS')
    expect(txRows[1]['Nama Pelanggan']).toBe('Pelanggan Umum')

    const debtRows = XLSX.utils.sheet_to_json(workbook.Sheets['Buku Utang Pelanggan'])
    expect(debtRows).toHaveLength(1)
    expect(debtRows[0]['Nama Pelanggan']).toBe('Bu Tejo')
    expect(debtRows[0]['Sisa Bon / Utang (Rp)']).toBe(15000)

    const expRows = XLSX.utils.sheet_to_json(workbook.Sheets['Pengeluaran Kas'])
    expect(expRows).toHaveLength(1)
    expect(expRows[0]['No. Catatan']).toBe('KLR-101')
    expect(expRows[0]['Nominal (Rp)']).toBe(7000)
    expect(expRows[0]['Keterangan']).toBe('Beli kresek')
  })
})
