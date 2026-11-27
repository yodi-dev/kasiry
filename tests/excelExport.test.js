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

  it('lazily imports xlsx and creates valid 6-sheet workbook including QRIS, expenses, shifts, and debts', async () => {
    const fileName = await exportKasiryExcel({
      storeProfile: { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
      stats: {
        isShiftScoped: true,
        openingCash: 100000,
        expectedCashDrawer: 125000,
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
        },
        {
          invoiceNumber: 'KSR-PART',
          createdAt: Date.now(),
          paymentMethod: 'TUNAI (SEBAGIAN BON)',
          customerName: 'Bu Tejo',
          totalAmount: 50000,
          paidAmount: 30000,
          debtAmount: 20000,
          cashGiven: 30000,
          changeAmount: 0,
          items: [{ id: 4, name: 'Beras 5kg', sellPrice: 50000, buyPrice: 44000, qty: 1 }]
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
      ],
      shifts: [
        {
          id: 9,
          shiftCode: 'SHF-901',
          cashierName: 'Habiba',
          status: 'CLOSED',
          openedAt: Date.now() - 3600000,
          closedAt: Date.now(),
          openingCash: 100000,
          expectedCash: 125000,
          actualCash: 125000,
          cashDifference: 0,
          summary: {
            todayCashDrawer: 32000,
            todayQrisTotal: 30000,
            todayExpensesCash: 7000
          },
          deleted: false
        }
      ],
      restocks: [
        {
          id: 21,
          restockNumber: 'KLK-201',
          createdAt: Date.now(),
          supplierName: 'Agen Sembako Jaya',
          source: 'TUNAI_LACI',
          shiftCode: 'SHF-901',
          totalCost: 130000,
          totalItems: 10,
          items: [{ productId: 2, productName: 'Minyakita 1L', qty: 10, unitBuyPrice: 13000 }],
          note: 'Nota pagi',
          deleted: false
        }
      ],
      cashServices: [
        {
          id: 31,
          serviceNumber: 'TT-301',
          createdAt: Date.now(),
          type: 'TARIK_TUNAI',
          channel: 'QRIS',
          cashSource: 'LACI',
          customerName: 'Bu Sari',
          amount: 50000,
          adminFee: 5000,
          totalPaid: 55000,
          shiftCode: 'SHF-901',
          note: 'QRIS lancar',
          deleted: false
        }
      ],
      digitalProducts: [
        {
          id: 41,
          digitalNumber: 'PLN-401',
          createdAt: Date.now(),
          category: 'TOKEN_LISTRIK',
          productName: 'Token PLN 50.000',
          provider: 'PLN',
          targetNumber: '541200889911',
          tokenCode: '1234 5678 9012 3456 7890',
          costPrice: 50500,
          sellPrice: 52500,
          profit: 2000,
          paymentMethod: 'TUNAI',
          customerName: 'Bu Sari',
          shiftCode: 'SHF-901',
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
      'Pengeluaran Kas',
      'Riwayat Shift',
      'Riwayat Kulakan',
      'Tarik Tunai & Transfer',
      'Pulsa & Token Listrik'
    ])

    const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets['Ringkasan Kas'], { header: 1 })
    const summaryMap = Object.fromEntries(summaryRows.filter(r => r.length >= 2))
    expect(summaryMap['Total Uang Tunai di Laci (Penjualan + Bon)']).toBe(32000)
    expect(summaryMap['Total Penerimaan QRIS (Non-Tunai)']).toBe(30000)
    expect(summaryMap['Total Uang Masuk Kas (Keseluruhan)']).toBe(62000)
    expect(summaryMap['Pengeluaran Dari Laci (Tunai)']).toBe(7000)
    expect(summaryMap['Sisa Tunai Fisik di Laci (Bersih)']).toBe(25000)
    expect(summaryMap['Modal Awal Laci (Shift Aktif)']).toBe(100000)
    expect(summaryMap['Total Seharusnya di Laci (Termasuk Modal)']).toBe(125000)

    const txRows = XLSX.utils.sheet_to_json(workbook.Sheets['Daftar Transaksi'])
    expect(txRows).toHaveLength(4)
    expect(txRows.map(r => r['No. Nota / Invoice'])).toEqual(['KSR-1001', 'QRS-1002', 'BON-1000', 'KSR-PART'])
    expect(txRows[1]['Metode Bayar']).toBe('QRIS')
    expect(txRows[1]['Nama Pelanggan']).toBe('Pelanggan Umum')
    expect(txRows[3]['Metode Bayar']).toBe('TUNAI (SEBAGIAN BON)')
    expect(txRows[3]['Uang Diberikan (Rp)']).toBe(30000)
    expect(txRows[3]['Rincian Barang']).toContain('Sisa Masuk Bon: Rp 20.000')

    const debtRows = XLSX.utils.sheet_to_json(workbook.Sheets['Buku Utang Pelanggan'])
    expect(debtRows).toHaveLength(1)
    expect(debtRows[0]['Nama Pelanggan']).toBe('Bu Tejo')
    expect(debtRows[0]['Sisa Bon / Utang (Rp)']).toBe(15000)

    const expRows = XLSX.utils.sheet_to_json(workbook.Sheets['Pengeluaran Kas'])
    expect(expRows).toHaveLength(1)
    expect(expRows[0]['No. Catatan']).toBe('KLR-101')
    expect(expRows[0]['Nominal (Rp)']).toBe(7000)
    expect(expRows[0]['Keterangan']).toBe('Beli kresek')

    const shiftRows = XLSX.utils.sheet_to_json(workbook.Sheets['Riwayat Shift'])
    expect(shiftRows).toHaveLength(1)
    expect(shiftRows[0]['Kode Shift']).toBe('SHF-901')
    expect(shiftRows[0]['Modal Awal (Rp)']).toBe(100000)
    expect(shiftRows[0]['Uang Fisik (Rp)']).toBe(125000)
    expect(shiftRows[0]['Selisih (Rp)']).toBe(0)

    const restockRows = XLSX.utils.sheet_to_json(workbook.Sheets['Riwayat Kulakan'])
    expect(restockRows).toHaveLength(1)
    expect(restockRows[0]['No. Nota']).toBe('KLK-201')
    expect(restockRows[0]['Supplier / Agen']).toBe('Agen Sembako Jaya')
    expect(restockRows[0]['Total Modal (Rp)']).toBe(130000)
    expect(restockRows[0]['Rincian Barang']).toContain('Minyakita 1L x10')

    const cashServiceRows = XLSX.utils.sheet_to_json(workbook.Sheets['Tarik Tunai & Transfer'])
    expect(cashServiceRows).toHaveLength(1)
    expect(cashServiceRows[0]['No. Nota']).toBe('TT-301')
    expect(cashServiceRows[0]['Nominal Pokok (Rp)']).toBe(50000)
    expect(cashServiceRows[0]['Biaya Admin (Rp)']).toBe(5000)
    expect(cashServiceRows[0]['Total Dibayar (Rp)']).toBe(55000)

    const digitalRows = XLSX.utils.sheet_to_json(workbook.Sheets['Pulsa & Token Listrik'])
    expect(digitalRows).toHaveLength(1)
    expect(digitalRows[0]['No. Nota']).toBe('PLN-401')
    expect(digitalRows[0]['No. HP / ID PLN']).toBe('541200889911')
    expect(digitalRows[0]['No. Token / SN']).toBe('1234 5678 9012 3456 7890')
    expect(digitalRows[0]['Laba (Rp)']).toBe(2000)
  })
})
