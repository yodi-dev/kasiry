import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const setOnlineStatus = (online) => {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true
  })
}

describe('useGoogleSync (Adaptive Drive Batching, Offline Queue & Two-Way Merge)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    localStorage.clear()
    setOnlineStatus(true)
  })

  afterEach(() => {
    setOnlineStatus(true)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('queues Google Sheet rows while offline and flushes them in batch when back online', async () => {
    localStorage.setItem('kasiry_gdrive_user', JSON.stringify({ name: 'Habiba', email: 'habiba@test.id' }))
    localStorage.setItem('kasiry_gdrive_token', 'valid-token')
    localStorage.setItem('kasiry_gdrive_token_expires', String(Date.now() + 3600000))
    localStorage.setItem('kasiry_linked_sheet_id', 'sheet-123')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updates: { updatedRows: 1 } })
    })
    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    // 1. Offline: antrean tersimpan lokal tanpa memanggil API
    setOnlineStatus(false)
    await sync.appendTransactionToSheet({
      invoiceNumber: 'KSR-OFF-1',
      totalAmount: 22000,
      paymentMethod: 'TUNAI',
      customerName: 'Umum',
      items: [{ name: 'Gas LPG 3 Kg', qty: 1 }]
    }, 'Habiba Store')
    expect(sync.pendingQueueCount.value).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()

    // 2. Online kembali -> flush antrean sukses dan antrean kosong
    setOnlineStatus(true)
    const flushed = await sync.flushPendingSheetQueue('Habiba Store', false)
    expect(flushed).toEqual({ flushed: 1, remaining: 0 })
    expect(sync.pendingQueueCount.value).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 3. Pelunasan bon via QRIS mengirimkan penanda metode QRIS yang jelas ke Sheets
    await sync.appendDebtPaymentToSheet({
      customerName: 'Bu Tejo',
      amount: 25000,
      remainingDebt: 0,
      paymentMethod: 'QRIS',
      paymentDate: 1700000000000
    }, 'Habiba Store')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const lastBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(lastBody.values[0][2]).toBe('PELUNASAN BON (QRIS)')
    expect(lastBody.values[0][7]).toContain('via QRIS')

    // 4. Catatan kas keluar dikirimkan ke Sheets sebagai arus kas keluar negatif
    await sync.appendExpenseToSheet({
      expenseNumber: 'KLR-555',
      createdAt: 1700000500000,
      category: 'operasional',
      source: 'TUNAI_LACI',
      amount: 19000,
      note: 'Isi ulang galon'
    }, 'Habiba Store')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const expBody = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(expBody.values[0][1]).toBe('KLR-555')
    expect(expBody.values[0][2]).toBe('KAS KELUAR (TUNAI)')
    expect(expBody.values[0][4]).toBe(-19000)
    expect(expBody.values[0][5]).toBe(0)
    expect(expBody.values[0][7]).toContain('Isi ulang galon')

    // 5. Buka / Tutup Shift tercatat ke Google Sheets
    await sync.appendShiftEventToSheet({
      action: 'TUTUP SHIFT',
      shift: {
        shiftCode: 'SHF-999',
        cashierName: 'Habiba',
        openedAt: 1700000000000,
        closedAt: 1700009000000,
        openingCash: 200000,
        expectedCash: 250000,
        actualCash: 248000,
        cashDifference: -2000,
        closingNote: 'Selisih receh'
      }
    }, 'Habiba Store')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const shiftBody = JSON.parse(fetchMock.mock.calls[3][1].body)
    expect(shiftBody.values[0][1]).toBe('SHF-999')
    expect(shiftBody.values[0][2]).toBe('TUTUP SHIFT')
    expect(shiftBody.values[0][4]).toBe(248000)
    expect(shiftBody.values[0][6]).toBe(-2000)

    // 6. Nota Kulakan tercatat ke Google Sheets
    await sync.appendRestockToSheet({
      restockNumber: 'KLK-777',
      createdAt: 1700009500000,
      supplierName: 'Agen Sembako Jaya',
      source: 'TUNAI_LACI',
      totalCost: 140000,
      items: [{ productName: 'Gula 1kg', qty: 10, unitBuyPrice: 14000 }],
      note: 'Kulakan rutin'
    }, 'Habiba Store')
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const restockBody = JSON.parse(fetchMock.mock.calls[4][1].body)
    expect(restockBody.values[0][1]).toBe('KLK-777')
    expect(restockBody.values[0][2]).toBe('KULAKAN (TUNAI)')
    expect(restockBody.values[0][4]).toBe(-140000)
    expect(restockBody.values[0][7]).toContain('Gula 1kg x10')
  })

  it('batches Drive snapshots to 3 minutes / 10 transactions once txCount >= 200', async () => {
    localStorage.setItem('kasiry_gdrive_user', JSON.stringify({ name: 'Habiba' }))
    localStorage.setItem('kasiry_gdrive_token', 'valid-token')
    localStorage.setItem('kasiry_gdrive_token_expires', String(Date.now() + 3600000))

    // Mock 0 files on Drive search (primary + legacy filename checks) -> Case 1 upload POST
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'drive-file-1' }) })
    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    const getPayload = async () => ({ app: 'Kasiry POS', version: '2.4', data: { products: [], customers: [], transactions: [], debtPayments: [], settings: [] } })

    // Transaksi #1 dengan txCount >= 200 -> ditunda ke 180.000ms (tidak sync di 3000ms)
    sync.scheduleDriveAutoBackup(getPayload, null, () => 'Habiba Store', { isTransactional: true, txCount: 250 })
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()

    // Transaksi ke-2..9 masih menahan throttle
    for (let i = 2; i <= 9; i++) {
      sync.scheduleDriveAutoBackup(getPayload, null, () => 'Habiba Store', { isTransactional: true, txCount: 250 })
    }
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()

    // Transaksi ke-10 (mencapai DRIVE_TX_BATCH_THRESHOLD) langsung upload dalam 2.5 detik
    sync.scheduleDriveAutoBackup(getPayload, null, () => 'Habiba Store', { isTransactional: true, txCount: 250 })
    await vi.advanceTimersByTimeAsync(2600)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('merges LWW products/customers and strips remote transactions older than archiveState cutoff', async () => {
    localStorage.setItem('kasiry_gdrive_user', JSON.stringify({ name: 'Habiba' }))
    localStorage.setItem('kasiry_gdrive_token', 'valid-token')
    localStorage.setItem('kasiry_gdrive_token_expires', String(Date.now() + 3600000))

    const cutoffAt = 2000000
    const remoteBackup = {
      app: 'Kasiry POS',
      version: '2.4',
      storeProfile: { name: 'Habiba Store' },
      data: {
        products: [
          { id: 1, name: 'Gula Pasir 1kg Lama', sellPrice: 15000, updatedAt: 1000, deleted: false },
          { id: 2, name: 'Teh Pucuk Baru', sellPrice: 4000, updatedAt: 5000, deleted: false }
        ],
        customers: [
          { id: 99, name: 'Umum', totalDebt: 0, updatedAt: 5000, deleted: false }
        ],
        transactions: [
          { id: 10, invoiceNumber: 'OLD-ARCHIVED', createdAt: 1500000, totalAmount: 10000 },
          { id: 11, invoiceNumber: 'NEW-REMOTE', createdAt: 2500000, totalAmount: 18000 }
        ],
        debtPayments: [
          { customerId: 5, paymentDate: 1500000, amount: 5000 },
          { customerId: 5, paymentDate: 2600000, amount: 8000 }
        ],
        expenses: [
          { id: 70, expenseNumber: 'KLR-OLD', createdAt: 1500000, amount: 5000, updatedAt: 1500000 },
          { id: 71, expenseNumber: 'KLR-DEL', createdAt: 2600000, amount: 10000, deleted: true, updatedAt: 9000 }
        ],
        restocks: [
          { id: 88, restockNumber: 'KLK-OLD', createdAt: 1500000, totalCost: 20000, updatedAt: 1500000 },
          { id: 89, restockNumber: 'KLK-SYNC', createdAt: 2650000, totalCost: 85000, supplierName: 'Agen Baru', updatedAt: 9500 }
        ],
        cashServices: [
          { id: 90, serviceNumber: 'TT-OLD', createdAt: 1500000, type: 'TARIK_TUNAI', amount: 50000, adminFee: 5000, updatedAt: 1500000 },
          { id: 91, serviceNumber: 'TF-SYNC', createdAt: 2680000, type: 'TRANSFER', amount: 100000, adminFee: 5000, channel: 'BRI', updatedAt: 9600 }
        ],
        digitalProducts: [
          { id: 92, digitalNumber: 'PLS-OLD', createdAt: 1500000, sellPrice: 12000, updatedAt: 1500000 },
          { id: 93, digitalNumber: 'PLN-SYNC', createdAt: 2690000, category: 'TOKEN_LISTRIK', tokenCode: '1111 2222 3333 4444 5555', sellPrice: 52500, updatedAt: 9700 }
        ],
        fundMovements: [
          { id: 94, movementNumber: 'TBG-OLD', createdAt: 1500000, type: 'TAMBAH_TABUNGAN', fromAccount: 'LACI', toAccount: 'TABUNGAN', amount: 20000, updatedAt: 1500000 },
          { id: 95, movementNumber: 'TBG-SYNC', createdAt: 2695000, type: 'TAMBAH_TABUNGAN', fromAccount: 'KAS', toAccount: 'TABUNGAN', amount: 100000, updatedAt: 9800 }
        ],
        shifts: [
          { id: 80, shiftCode: 'SHF-OLD-CLOSED', status: 'CLOSED', openedAt: 1500000, updatedAt: 1500000 },
          { id: 81, shiftCode: 'SHF-SYNC', status: 'CLOSED', openedAt: 2500000, actualCash: 300000, updatedAt: 9000 }
        ],
        settings: [
          { key: 'archiveState', value: { cutoffAt: 1000000 }, updatedAt: 1000 }
        ]
      }
    }

    const fetchMock = vi.fn()
      // 1. findBackupFileId
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [{ id: 'drive-1', name: 'kasiry-backup.json' }] }) })
      // 2. downloadFromDrive
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => remoteBackup })
      // 3. uploadToDrive (multipart PATCH)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'drive-1' }) })
    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    let appliedPayload = null
    const localData = {
      storeProfile: { name: 'Habiba Store' },
      data: {
        products: [
          { id: 1, name: 'Gula Pasir 1kg Terbaru', sellPrice: 17500, updatedAt: 6000, deleted: false }
        ],
        customers: [
          { id: 1, name: 'Umum', totalDebt: 0, updatedAt: 1000, deleted: false }
        ],
        transactions: [
          { id: 12, invoiceNumber: 'NEW-LOCAL', createdAt: 2700000, totalAmount: 22000 }
        ],
        debtPayments: [],
        expenses: [
          { id: 71, expenseNumber: 'KLR-DEL', createdAt: 2600000, amount: 10000, deleted: false, updatedAt: 5000 }
        ],
        restocks: [
          { id: 89, restockNumber: 'KLK-SYNC', createdAt: 2650000, totalCost: 80000, supplierName: 'Agen Lama', updatedAt: 4000 }
        ],
        cashServices: [
          { id: 91, serviceNumber: 'TF-SYNC', createdAt: 2680000, type: 'TRANSFER', amount: 100000, adminFee: 3000, channel: 'DANA', updatedAt: 4500 }
        ],
        digitalProducts: [
          { id: 93, digitalNumber: 'PLN-SYNC', createdAt: 2690000, category: 'TOKEN_LISTRIK', tokenCode: '', sellPrice: 52500, updatedAt: 4600 }
        ],
        fundMovements: [
          { id: 95, movementNumber: 'TBG-SYNC', createdAt: 2695000, type: 'TAMBAH_TABUNGAN', fromAccount: 'KAS', toAccount: 'TABUNGAN', amount: 50000, updatedAt: 4700 }
        ],
        shifts: [
          { id: 81, shiftCode: 'SHF-SYNC', status: 'OPEN', openedAt: 2500000, updatedAt: 5000 }
        ],
        settings: [
          { key: 'archiveState', value: { cutoffAt }, updatedAt: 9000 }
        ]
      }
    }

    const res = await sync.syncWithCloud(localData, async (merged) => {
      appliedPayload = merged
    }, false)

    expect(res.success).toBe(true)
    expect(appliedPayload).not.toBeNull()
    // LWW menang per timestamp updatedAt
    const prod1 = appliedPayload.data.products.find(p => p.id === 1)
    expect(prod1.name).toBe('Gula Pasir 1kg Terbaru')
    expect(appliedPayload.data.products.find(p => p.id === 2)).toBeTruthy()
    // Tidak menduplikasi "Umum"
    expect(appliedPayload.data.customers).toHaveLength(1)
    expect(appliedPayload.data.customers[0].id).toBe(1)
    // Transaksi, cicilan, kulakan, & pengeluaran terarsip (< cutoffAt) tersaring keluar; soft-delete LWW menang
    expect(appliedPayload.data.transactions.map(t => t.invoiceNumber)).toEqual(['NEW-LOCAL', 'NEW-REMOTE'])
    expect(appliedPayload.data.debtPayments).toHaveLength(1)
    expect(appliedPayload.data.debtPayments[0].amount).toBe(8000)
    expect(appliedPayload.data.expenses).toHaveLength(1)
    expect(appliedPayload.data.expenses[0].expenseNumber).toBe('KLR-DEL')
    expect(appliedPayload.data.expenses[0].deleted).toBe(true)
    expect(appliedPayload.data.restocks).toHaveLength(1)
    expect(appliedPayload.data.restocks[0].restockNumber).toBe('KLK-SYNC')
    expect(appliedPayload.data.restocks[0].supplierName).toBe('Agen Baru')
    expect(appliedPayload.data.cashServices).toHaveLength(1)
    expect(appliedPayload.data.cashServices[0].serviceNumber).toBe('TF-SYNC')
    expect(appliedPayload.data.cashServices[0].channel).toBe('BRI')
    expect(appliedPayload.data.digitalProducts).toHaveLength(1)
    expect(appliedPayload.data.digitalProducts[0].digitalNumber).toBe('PLN-SYNC')
    expect(appliedPayload.data.digitalProducts[0].tokenCode).toBe('1111 2222 3333 4444 5555')
    expect(appliedPayload.data.fundMovements).toHaveLength(1)
    expect(appliedPayload.data.fundMovements[0].movementNumber).toBe('TBG-SYNC')
    expect(appliedPayload.data.fundMovements[0].amount).toBe(100000)
    expect(appliedPayload.data.shifts).toHaveLength(1)
    expect(appliedPayload.data.shifts[0].shiftCode).toBe('SHF-SYNC')
    expect(appliedPayload.data.shifts[0].status).toBe('CLOSED')
  })

  it('requests strictly non-sensitive scopes (no spreadsheets scope) and auto-recovers stale 403/404 linkedSheetId', async () => {
    let capturedScope = ''
    globalThis.window = {
      location: { origin: 'https://kasiry.awanbeo.my.id' },
      google: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((opts) => {
              capturedScope = opts.scope
              return {
                requestAccessToken: () => opts.callback({ access_token: 'fresh-tok', expires_in: 3600 })
              }
            })
          }
        }
      }
    }

    localStorage.setItem('kasiry_linked_sheet_id', 'stale-sheet-id')

    const fetchMock = vi.fn()
      // 1. connect() -> userinfo
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ name: 'Kasir', email: 'kasir@test.id' }) })
      // 2. appendRowsBatch pada stale-sheet-id -> 403 Forbidden
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Caller does not have permission' } }) })
      // 3. ensureSpreadsheet cari file -> kosong
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
      // 4. ensureSpreadsheet buat sheet baru via Sheets API (sah di scope drive.file)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ spreadsheetId: 'new-drivefile-sheet' }) })
      // 5. appendRowsBatch retry ke sheet baru -> 200 OK (+ default response untuk call berikutnya)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ updates: { updatedRows: 1 } }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ updates: { updatedRows: 1 } }) })

    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    const connRes = await sync.connect()
    expect(connRes.success).toBe(true)
    expect(capturedScope).toContain('https://www.googleapis.com/auth/drive.file')
    expect(capturedScope).not.toContain('https://www.googleapis.com/auth/spreadsheets')

    const writeRes = await sync.appendTransactionToSheet({
      invoiceNumber: 'KSR-DRIVEFILE',
      totalAmount: 15000,
      paymentMethod: 'TUNAI',
      items: [{ name: 'Gula', qty: 1 }]
    }, 'Warung Kasiry')

    expect(writeRes).toEqual({ sent: true, queued: false })
    expect(localStorage.getItem('kasiry_linked_sheet_id')).toBe('new-drivefile-sheet')
    expect(fetchMock).toHaveBeenCalledTimes(5)

    // Uji log pembatalan & CashService dengan cashSource KAS
    await sync.appendCashServiceToSheet({
      serviceNumber: 'TT-KAS-1',
      type: 'TARIK_TUNAI',
      cashSource: 'KAS',
      amount: 100000,
      adminFee: 5000,
      channel: 'QRIS'
    }, 'Warung Kasiry')
    const csBody = JSON.parse(fetchMock.mock.calls[5][1].body)
    expect(csBody.values[0][7]).toContain('Uang Kas')

    await sync.appendCancellationToSheet({
      refNumber: 'KSR-001',
      actionLabel: 'BATAL TRANSAKSI',
      detail: 'Void test',
      amount: -25000
    }, 'Warung Kasiry')
    const cancelBody = JSON.parse(fetchMock.mock.calls[6][1].body)
    expect(cancelBody.values[0][1]).toBe('BATAL-KSR-001')
    expect(cancelBody.values[0][2]).toBe('BATAL TRANSAKSI')

    // Pastikan pembuatan spreadsheet baru menyertakan frozen header & lebar kolom rapi
    const createSheetCall = fetchMock.mock.calls.find(c => String(c[0]) === 'https://sheets.googleapis.com/v4/spreadsheets' && c[1]?.method === 'POST')
    const createSheetPayload = JSON.parse(createSheetCall[1].body)
    expect(createSheetPayload.sheets[0].properties.gridProperties.frozenRowCount).toBe(1)
    expect(createSheetPayload.sheets[0].bandedRanges).toHaveLength(1)

    delete globalThis.window
  })

  it('reuses a single Kasiry - Buku Kas spreadsheet across store renames and renames it in Drive instead of duplicating', async () => {
    localStorage.setItem('kasiry_gdrive_user', JSON.stringify({ name: 'Kasir' }))
    localStorage.setItem('kasiry_gdrive_token', 'valid-token')
    localStorage.setItem('kasiry_gdrive_token_expires', String(Date.now() + 3600000))

    const fetchMock = vi.fn()
      // 1. Cari 'Kasiry - Buku Kas' -> ketemu file lama milik nama toko sebelumnya
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ id: 'single-sheet-id', name: 'Kasiry - Buku Kas Toko Lama' }]
        })
      })
      // 2. PATCH rename file di Drive ke nama toko baru
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'single-sheet-id', name: 'Kasiry - Buku Kas Toko Baru' })
      })

    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    const sheetId = await sync.ensureSpreadsheet('Toko Baru', false)
    expect(sheetId).toBe('single-sheet-id')
    expect(localStorage.getItem('kasiry_linked_sheet_id')).toBe('single-sheet-id')
    expect(localStorage.getItem('kasiry_linked_sheet_title')).toBe('Kasiry - Buku Kas Toko Baru')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('/drive/v3/files/single-sheet-id')
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
  })

  it('skips download when Drive modifiedTime is unchanged and auto-pulls when remote modifiedTime is newer', async () => {
    localStorage.setItem('kasiry_gdrive_user', JSON.stringify({ name: 'Kasir' }))
    localStorage.setItem('kasiry_gdrive_token', 'valid-token')
    localStorage.setItem('kasiry_gdrive_token_expires', String(Date.now() + 3600000))
    localStorage.setItem('kasiry_gdrive_remote_mtime', '2026-11-28T10:00:00.000Z')

    const fetchMock = vi.fn()
      // 1. Cek pertama: modifiedTime sama -> tidak perlu download atau sync
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ id: 'backup-1', name: 'kasiry-backup.json', modifiedTime: '2026-11-28T10:00:00.000Z' }]
        })
      })
      // 2. Cek kedua setelah >20 detik: modifiedTime lebih baru -> auto-pull syncWithCloud
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ id: 'backup-1', name: 'kasiry-backup.json', modifiedTime: '2026-11-28T10:05:00.000Z' }]
        })
      })
      // syncWithCloud -> findBackupFileId
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ id: 'backup-1', name: 'kasiry-backup.json', modifiedTime: '2026-11-28T10:05:00.000Z' }]
        })
      })
      // syncWithCloud -> downloadFromDrive
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          version: '2.4',
          data: {
            products: [{ id: 1, name: 'Barang Update HP', sellPrice: 12000, updatedAt: 99999 }],
            customers: [],
            transactions: []
          }
        })
      })
      // syncWithCloud -> uploadToDrive PATCH
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'backup-1' })
      })

    globalThis.fetch = fetchMock

    const { useGoogleSync } = await import('../src/composables/useGoogleSync')
    const sync = useGoogleSync()

    const applyMock = vi.fn().mockResolvedValue(undefined)
    const getLocalMock = vi.fn().mockResolvedValue({
      version: '2.4',
      storeProfile: { name: 'Warung Kasiry' },
      data: { products: [], customers: [], transactions: [] }
    })

    const firstCheck = await sync.checkAndPullCloudUpdates(getLocalMock, applyMock, { minIntervalMs: 0 })
    expect(firstCheck).toEqual({ checked: true, updated: false, upToDate: true })
    expect(applyMock).not.toHaveBeenCalled()

    const secondCheck = await sync.checkAndPullCloudUpdates(getLocalMock, applyMock, { minIntervalMs: 0 })
    expect(secondCheck).toEqual({ checked: true, updated: true })
    expect(applyMock).toHaveBeenCalledTimes(1)
  })
})
