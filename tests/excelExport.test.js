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

  it('lazily imports xlsx and creates valid 4-sheet workbook including historical transactions and debts', async () => {
    const fileName = await exportKasiryExcel({
      storeProfile: { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
      stats: {
        todaySales: 22000,
        todayDebtPaid: 10000,
        todayProfit: 5000,
        todayNewDebt: 15000,
        transactionCount: 2
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
      debtPayments: []
    })

    expect(fileName).toMatch(/^Laporan_Habiba_Store_\d{4}-\d{2}-\d{2}\.xlsx$/)
    const outPath = path.join(tempDir, fileName)
    expect(fs.existsSync(outPath)).toBe(true)

    const workbook = XLSX.readFile(outPath)
    expect(workbook.SheetNames).toEqual([
      'Ringkasan Kas',
      'Daftar Transaksi',
      'Barang Terjual',
      'Buku Utang Pelanggan'
    ])

    const txRows = XLSX.utils.sheet_to_json(workbook.Sheets['Daftar Transaksi'])
    expect(txRows).toHaveLength(2)
    expect(txRows.map(r => r['No. Nota / Invoice'])).toEqual(['KSR-1001', 'BON-1000'])

    const debtRows = XLSX.utils.sheet_to_json(workbook.Sheets['Buku Utang Pelanggan'])
    expect(debtRows).toHaveLength(1)
    expect(debtRows[0]['Nama Pelanggan']).toBe('Bu Tejo')
    expect(debtRows[0]['Sisa Bon / Utang (Rp)']).toBe(15000)
  })
})
