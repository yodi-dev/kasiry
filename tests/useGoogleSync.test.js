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
    // Transaksi, cicilan, & pengeluaran terarsip (< cutoffAt) tersaring keluar; soft-delete LWW menang
    expect(appliedPayload.data.transactions.map(t => t.invoiceNumber)).toEqual(['NEW-LOCAL', 'NEW-REMOTE'])
    expect(appliedPayload.data.debtPayments).toHaveLength(1)
    expect(appliedPayload.data.debtPayments[0].amount).toBe(8000)
    expect(appliedPayload.data.expenses).toHaveLength(1)
    expect(appliedPayload.data.expenses[0].expenseNumber).toBe('KLR-DEL')
    expect(appliedPayload.data.expenses[0].deleted).toBe(true)
  })
})
