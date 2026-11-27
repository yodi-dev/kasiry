import { ref, computed } from 'vue'
import { getExpenseCategoryMeta } from '../utils/expenseConstants'

const DEFAULT_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1057500468203-6pa94u5k9b18hq6jjdkb5bg1sb4541lt.apps.googleusercontent.com'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

const BACKUP_FILENAME = 'kasiry-backup.json'
const LEGACY_BACKUP_FILENAME = 'kasiry-habiba-backup.json'
const getSheetFilename = (storeName) => `Kasiry - Buku Kas ${storeName?.trim() || 'Toko'}`

const loadJsonStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// Persistent reactive state
const getSavedToken = () => {
  const token = localStorage.getItem('kasiry_gdrive_token')
  const expiresAt = parseInt(localStorage.getItem('kasiry_gdrive_token_expires') || '0', 10)
  if (token && expiresAt > Date.now()) {
    return token
  }
  return null
}

const accessToken = ref(getSavedToken())
const userProfile = ref(loadJsonStorage('kasiry_gdrive_user', null))
const lastSyncTime = ref(localStorage.getItem('kasiry_gdrive_last_sync') || null)
const linkedSheetId = ref(localStorage.getItem('kasiry_linked_sheet_id') || null)
const customClientId = ref(localStorage.getItem('kasiry_custom_client_id') || '')
const pendingSheetQueue = ref(loadJsonStorage('kasiry_pending_sheet_queue', []))
const hasPendingDriveBackup = ref(localStorage.getItem('kasiry_pending_drive_sync') === 'true')

const isConnecting = ref(false)
const isSyncing = ref(false)
const statusMessage = ref('')
let driveAutoBackupTimer = null
let pendingDriveTxBatch = 0
const DRIVE_TX_BATCH_THRESHOLD = 10
const DRIVE_TX_THROTTLE_MS = 180000

export function useGoogleSync() {
  const isConnected = computed(() => !!userProfile.value)
  const activeClientId = computed(() => customClientId.value.trim() || DEFAULT_CLIENT_ID)
  const pendingQueueCount = computed(() => pendingSheetQueue.value.length)

  const setCustomClientId = (clientId) => {
    const clean = (clientId || '').trim()
    customClientId.value = clean
    if (clean) {
      localStorage.setItem('kasiry_custom_client_id', clean)
    } else {
      localStorage.removeItem('kasiry_custom_client_id')
    }
  }

  const persistPendingQueue = (nextQueue) => {
    pendingSheetQueue.value = nextQueue
    localStorage.setItem('kasiry_pending_sheet_queue', JSON.stringify(nextQueue))
  }

  const markDrivePending = (flag) => {
    hasPendingDriveBackup.value = flag
    if (flag) {
      localStorage.setItem('kasiry_pending_drive_sync', 'true')
    } else {
      localStorage.removeItem('kasiry_pending_drive_sync')
    }
  }

  // Inisialisasi & Permintaan Token GIS (Google Identity Services)
  const requestToken = (promptType = '') => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        reject(
          new Error('Google Identity Services belum siap. Periksa koneksi internet Anda.')
        )
        return
      }

      if (!activeClientId.value) {
        reject(new Error('Google OAuth Client ID belum dikonfigurasi.'))
        return
      }

      try {
        let settled = false
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId.value,
          scope: SCOPES,
          error_callback: (err) => {
            if (settled) return
            settled = true
            let msg = 'Login Google dibatalkan atau gagal membuka jendela.'
            if (err?.type === 'popup_failed_to_open') {
              msg = 'Pop-up login Google diblokir oleh peramban. Silakan izinkan pop-up lalu coba lagi.'
            } else if (err?.type === 'popup_closed') {
              msg = 'Jendela login Google ditutup sebelum selesai.'
            }
            reject(new Error(msg))
          },
          callback: async (resp) => {
            if (settled) return
            settled = true
            if (resp.error) {
              let errorDetail = resp.error
              if (resp.error === 'access_denied') {
                errorDetail = 'Izin akses akun Google dibatalkan.'
              } else if (resp.error === 'redirect_uri_mismatch' || resp.error === 'origin_mismatch') {
                errorDetail = `Domain ${window.location.origin} belum didaftarkan di Authorized JavaScript Origins Google Cloud Console.`
              }
              reject(new Error(errorDetail))
              return
            }

            accessToken.value = resp.access_token
            const exp = Date.now() + (resp.expires_in || 3500) * 1000
            localStorage.setItem('kasiry_gdrive_token', resp.access_token)
            localStorage.setItem('kasiry_gdrive_token_expires', String(exp))

            // Ambil Info Profil Pengguna
            try {
              const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${resp.access_token}` }
              })
              if (infoRes.ok) {
                const profile = await infoRes.json()
                userProfile.value = {
                  name: profile.name,
                  email: profile.email,
                  picture: profile.picture
                }
                localStorage.setItem('kasiry_gdrive_user', JSON.stringify(userProfile.value))
              }
            } catch (err) {
              console.warn('Gagal memuat profil Google:', err)
            }

            resolve(resp.access_token)
          }
        })

        tokenClient.requestAccessToken({ prompt: promptType })
      } catch (err) {
        reject(err)
      }
    })
  }

  // Memastikan Token Masih Valid
  const ensureToken = async (interactive = false) => {
    const expiresAt = parseInt(localStorage.getItem('kasiry_gdrive_token_expires') || '0', 10)
    if (accessToken.value && expiresAt > Date.now()) {
      return accessToken.value
    }
    try {
      return await requestToken('')
    } catch (err) {
      if (interactive) {
        return await requestToken('select_account')
      }
      throw err
    }
  }

  // Fetch API dengan Header Auth Google
  const fetchWithAuth = async (url, options = {}, isRetry = false, interactive = false) => {
    let token = await ensureToken(interactive).catch(() => null)
    if (!token) {
      token = await requestToken(interactive ? 'select_account' : '')
    }

    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(url, { ...options, headers })

    if (res.status === 401 && !isRetry) {
      accessToken.value = null
      localStorage.removeItem('kasiry_gdrive_token')
      localStorage.removeItem('kasiry_gdrive_token_expires')
      return fetchWithAuth(url, options, true, interactive)
    }

    return res
  }

  // Hubungkan Akun Google
  const connect = async () => {
    isConnecting.value = true
    statusMessage.value = 'Menghubungkan ke Akun Google...'
    try {
      await requestToken('select_account')
      statusMessage.value = 'Akun Google berhasil terhubung!'
      return { success: true }
    } catch (err) {
      const errMsg = err.message || 'Gagal menghubungkan Akun Google.'
      statusMessage.value = errMsg
      return { success: false, error: errMsg }
    } finally {
      isConnecting.value = false
    }
  }

  // Putuskan Akun Google
  const disconnect = () => {
    if (accessToken.value && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(accessToken.value, () => {})
      } catch (e) {}
    }
    accessToken.value = null
    userProfile.value = null
    linkedSheetId.value = null
    lastSyncTime.value = null
    persistPendingQueue([])
    markDrivePending(false)
    localStorage.removeItem('kasiry_gdrive_token')
    localStorage.removeItem('kasiry_gdrive_token_expires')
    localStorage.removeItem('kasiry_gdrive_user')
    localStorage.removeItem('kasiry_linked_sheet_id')
    localStorage.removeItem('kasiry_gdrive_last_sync')
    statusMessage.value = 'Akun Google telah diputuskan.'
  }

  // Cari File Backup di Google Drive (cek kasiry-backup.json lalu fallback nama lama)
  const findBackupFileId = async (interactive = false) => {
    const queryFile = async (fileName) => {
      const q = encodeURIComponent(`name='${fileName}' and trashed=false`)
      const res = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`,
        {},
        false,
        interactive
      )
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || 'Gagal memeriksa file backup di Google Drive.')
      }
      const data = await res.json()
      return data.files && data.files.length > 0 ? data.files[0].id : null
    }

    const primaryId = await queryFile(BACKUP_FILENAME)
    if (primaryId) return primaryId
    return await queryFile(LEGACY_BACKUP_FILENAME)
  }

  // Simpan Snapshot ke Google Drive (JSON ringkas tanpa spasi agar hemat kuota & cepat di HP)
  const uploadToDrive = async (payloadData, existingFileId = null, interactive = false, customFilename = BACKUP_FILENAME) => {
    const content = JSON.stringify(payloadData)

    if (existingFileId) {
      const updateRes = await fetchWithAuth(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: content
        },
        false,
        interactive
      )
      if (!updateRes.ok) {
        throw new Error('Gagal memperbarui file cadangan di Google Drive.')
      }
      return existingFileId
    } else {
      const metadata = {
        name: customFilename,
        mimeType: 'application/json',
        description: customFilename === BACKUP_FILENAME ? 'Kasiry POS Warung Cloud Backup' : 'Kasiry POS Archive Backup'
      }

      const boundary = '-------kasiry_boundary_' + Date.now()
      const multipartBody =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        content +
        `\r\n--${boundary}--`

      const createRes = await fetchWithAuth(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        },
        false,
        interactive
      )
      if (!createRes.ok) {
        throw new Error('Gagal membuat file cadangan baru di Google Drive.')
      }
      const data = await createRes.json()
      return data.id
    }
  }

  // Ambil Snapshot dari Google Drive
  const downloadFromDrive = async (fileId, interactive = false) => {
    const res = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {},
      false,
      interactive
    )
    if (!res.ok) {
      throw new Error('Gagal mengunduh file cadangan dari Google Drive.')
    }
    return await res.json()
  }

  // Cari atau Buat Spreadsheet Buku Kas Warung (dinamis sesuai nama toko)
  const ensureSpreadsheet = async (storeName = 'Toko', interactive = false) => {
    if (linkedSheetId.value) {
      return linkedSheetId.value
    }

    const sheetTitle = getSheetFilename(storeName)

    try {
      // 1. Cek apakah sudah pernah ada
      const q = encodeURIComponent(
        `name='${sheetTitle.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
      )
      const res = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`,
        {},
        false,
        interactive
      )
      if (res.ok) {
        const data = await res.json()
        if (data.files && data.files.length > 0) {
          linkedSheetId.value = data.files[0].id
          localStorage.setItem('kasiry_linked_sheet_id', data.files[0].id)
          return data.files[0].id
        }
      }

      // 2. Buat via Sheets API
      const body = {
        properties: { title: sheetTitle },
        sheets: [
          {
            properties: {
              title: 'Rekap Transaksi Kasir',
              gridProperties: { rowCount: 1000, columnCount: 10 }
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: 'Waktu Transaksi' } },
                      { userEnteredValue: { stringValue: 'No. Nota' } },
                      { userEnteredValue: { stringValue: 'Metode Bayar' } },
                      { userEnteredValue: { stringValue: 'Nama Pelanggan' } },
                      { userEnteredValue: { stringValue: 'Total Belanja (Rp)' } },
                      { userEnteredValue: { stringValue: 'Uang Diterima (Rp)' } },
                      { userEnteredValue: { stringValue: 'Kembalian (Rp)' } },
                      { userEnteredValue: { stringValue: 'Rincian Barang' } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      const createRes = await fetchWithAuth(
        'https://sheets.googleapis.com/v4/spreadsheets',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        },
        false,
        interactive
      )

      if (createRes.ok) {
        const createData = await createRes.json()
        linkedSheetId.value = createData.spreadsheetId
        localStorage.setItem('kasiry_linked_sheet_id', createData.spreadsheetId)
        return createData.spreadsheetId
      }
    } catch (e) {
      console.warn('Gagal menyiapkan spreadsheet buku kas:', e)
    }
    return null
  }

  // Format baris standar untuk pencatatan Google Sheets (Tunai, Bon Baru, & Pelunasan Bon)
  const formatSheetRow = (txData) => {
    const itemsText = txData.itemsText || (txData.items || [])
      .map(i => `${i.qty}x ${i.name}`)
      .join(', ')

    return [
      new Date(txData.createdAt || Date.now()).toLocaleString('id-ID'),
      txData.invoiceNumber || '-',
      txData.paymentMethod || 'TUNAI',
      txData.customerName || (txData.paymentMethod === 'UTANG / BON' ? '-' : 'Umum'),
      txData.totalAmount || 0,
      txData.cashGiven ?? txData.totalAmount ?? 0,
      txData.changeAmount || 0,
      itemsText || '-'
    ]
  }

  const enqueueSheetRow = (row) => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      row,
      createdAt: Date.now()
    }
    persistPendingQueue([...pendingSheetQueue.value, entry])
  }

  const appendRowsBatch = async (rows, storeName = 'Toko', interactive = false) => {
    const sheetId = await ensureSpreadsheet(storeName, interactive)
    if (!sheetId) {
      throw new Error('Spreadsheet Buku Kas belum tersedia.')
    }

    const res = await fetchWithAuth(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Rekap Transaksi Kasir!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
      },
      false,
      interactive
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error?.message || 'Gagal menulis data ke Google Sheets.')
    }
    return true
  }

  // Kirim seluruh antrean baris Google Sheets yang tertunda saat offline
  const flushPendingSheetQueue = async (storeName = 'Toko', interactive = false) => {
    if (!isConnected.value || !navigator.onLine || pendingSheetQueue.value.length === 0) {
      return { flushed: 0, remaining: pendingSheetQueue.value.length }
    }

    const snapshot = [...pendingSheetQueue.value]
    try {
      await appendRowsBatch(snapshot.map(item => item.row), storeName, interactive)
      const sentIds = new Set(snapshot.map(item => item.id))
      const remaining = pendingSheetQueue.value.filter(item => !sentIds.has(item.id))
      persistPendingQueue(remaining)
      return { flushed: snapshot.length, remaining: remaining.length }
    } catch (err) {
      console.warn('Antrean Google Sheets belum bisa dikirim:', err)
      return { flushed: 0, remaining: pendingSheetQueue.value.length, error: err.message }
    }
  }

  // Tambahkan Baris Transaksi Baru ke Google Sheets (dengan fallback antrean offline)
  const appendTransactionToSheet = async (txData, storeName = 'Toko') => {
    if (!isConnected.value) return { queued: false, skipped: true }

    const row = formatSheetRow(txData)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueSheetRow(row)
      return { queued: true, offline: true }
    }

    try {
      if (pendingSheetQueue.value.length > 0) {
        await flushPendingSheetQueue(storeName)
      }
      await appendRowsBatch([row], storeName)
      return { sent: true, queued: false }
    } catch (err) {
      console.warn('Gagal kirim ke Google Sheets, disimpan ke antrean offline:', err)
      enqueueSheetRow(row)
      return { queued: true, error: err.message }
    }
  }

  // Catat Pelunasan / Cicilan Bon ke Google Sheets melalui pipeline antrean yang sama
  const appendDebtPaymentToSheet = async ({ customerName, amount, remainingDebt = 0, paymentMethod = 'TUNAI', paymentDate = Date.now() }, storeName = 'Toko') => {
    const isQris = paymentMethod === 'QRIS'
    return appendTransactionToSheet({
      invoiceNumber: `LUNAS-${String(paymentDate).slice(-6)}`,
      createdAt: paymentDate,
      paymentMethod: isQris ? 'PELUNASAN BON (QRIS)' : 'PELUNASAN BON',
      customerName: customerName || 'Pelanggan',
      totalAmount: amount,
      cashGiven: amount,
      changeAmount: 0,
      itemsText: `Pembayaran utang ${isQris ? 'via QRIS ' : ''}(Sisa bon: Rp ${Math.max(0, remainingDebt).toLocaleString('id-ID')})`
    }, storeName)
  }

  // Catat Pengeluaran / Kas Keluar Harian ke Google Sheets melalui pipeline antrean yang sama
  const appendExpenseToSheet = async ({ expenseNumber, createdAt = Date.now(), category = 'operasional', source = 'TUNAI_LACI', amount = 0, note = '' } = {}, storeName = 'Toko') => {
    const meta = getExpenseCategoryMeta(category)
    const isNonCash = source === 'NON_TUNAI'
    const numericAmount = Math.abs(Number(amount || 0))
    return appendTransactionToSheet({
      invoiceNumber: expenseNumber || `KLR-${String(createdAt).slice(-6)}`,
      createdAt,
      paymentMethod: isNonCash ? 'KAS KELUAR (NON-TUNAI)' : 'KAS KELUAR (TUNAI)',
      customerName: meta.label,
      totalAmount: -numericAmount,
      cashGiven: 0,
      changeAmount: 0,
      itemsText: note ? `${meta.label}: ${note}` : meta.label
    }, storeName)
  }

  // Catat Nota Kulakan / Belanja Stok ke Google Sheets melalui pipeline antrean yang sama
  const appendRestockToSheet = async ({ restockNumber, createdAt = Date.now(), supplierName = '', source = 'TUNAI_LACI', totalCost = 0, items = [], note = '' } = {}, storeName = 'Toko') => {
    const sourceLabel = source === 'NON_TUNAI'
      ? 'KULAKAN (NON-TUNAI)'
      : source === 'DANA_LUAR'
        ? 'KULAKAN (DANA LUAR)'
        : 'KULAKAN (TUNAI)'
    const itemsSummary = Array.isArray(items) && items.length > 0
      ? items.map(it => `${it.productName || 'Barang'} x${it.qty || 0} (@Rp ${Number(it.unitBuyPrice || 0).toLocaleString('id-ID')})`).join(', ')
      : 'Kulakan stok'
    const fullText = note ? `${itemsSummary} • ${note}` : itemsSummary

    return appendTransactionToSheet({
      invoiceNumber: restockNumber || `KLK-${String(createdAt).slice(-6)}`,
      createdAt,
      paymentMethod: sourceLabel,
      customerName: supplierName || 'Supplier / Kulakan',
      totalAmount: -Math.abs(Number(totalCost || 0)),
      cashGiven: 0,
      changeAmount: 0,
      itemsText: fullText
    }, storeName)
  }

  // Catat Aktivitas Buka / Tutup Shift ke Google Sheets melalui pipeline antrean yang sama
  const appendShiftEventToSheet = async ({ action = 'BUKA SHIFT', shift = {} } = {}, storeName = 'Toko') => {
    const isClosing = action === 'TUTUP SHIFT'
    const ts = isClosing ? (shift.closedAt || Date.now()) : (shift.openedAt || Date.now())
    const openingCash = Number(shift.openingCash || 0)
    const actualCash = Number(shift.actualCash || 0)
    const expectedCash = Number(shift.expectedCash ?? openingCash)
    const diff = Number(shift.cashDifference ?? (actualCash - expectedCash))
    const detail = isClosing
      ? `Modal Rp ${openingCash.toLocaleString('id-ID')} • Seharusnya Rp ${expectedCash.toLocaleString('id-ID')} • Fisik Rp ${actualCash.toLocaleString('id-ID')} • Selisih Rp ${diff.toLocaleString('id-ID')}${shift.closingNote ? ` • ${shift.closingNote}` : ''}`
      : `Buka toko dengan modal awal Rp ${openingCash.toLocaleString('id-ID')}`

    return appendTransactionToSheet({
      invoiceNumber: shift.shiftCode || `SHF-${String(ts).slice(-6)}`,
      createdAt: ts,
      paymentMethod: action,
      customerName: shift.cashierName || 'Kasir',
      totalAmount: isClosing ? actualCash : openingCash,
      cashGiven: isClosing ? expectedCash : openingCash,
      changeAmount: isClosing ? diff : 0,
      itemsText: detail
    }, storeName)
  }

  // ==============================================================
  // ENGINE TWO-WAY SYNC MULTI-DEVICE (Berdasarkan Timestamp updatedAt)
  // ==============================================================
  const syncWithCloud = async (localData, applyMergedDataCallback, interactive = false) => {
    if (!isConnected.value) {
      return { success: false, error: 'Akun Google belum terhubung.' }
    }

    isSyncing.value = true
    statusMessage.value = 'Menyinkronkan data dengan Google Drive...'

    try {
      const fileId = await findBackupFileId(interactive)

      // KASUS 1: File belum ada di Google Drive (Upload pertama kali)
      if (!fileId) {
        const newFileId = await uploadToDrive(localData, null, interactive)
        await flushPendingSheetQueue(localData.storeProfile?.name, interactive)
        markDrivePending(false)
        const nowIso = new Date().toISOString()
        lastSyncTime.value = nowIso
        localStorage.setItem('kasiry_gdrive_last_sync', nowIso)
        statusMessage.value = 'Cadangan awal berhasil disimpan ke Google Drive!'
        return { success: true, updated: false, fileId: newFileId }
      }

      // KASUS 2: File sudah ada di Google Drive -> Jalankan Merge Aman
      const remoteData = await downloadFromDrive(fileId, interactive)
      if (!remoteData || !remoteData.data) {
        throw new Error('Format file cloud tidak valid.')
      }

      const rData = remoteData.data
      const lData = localData.data || {}

      // 1. Merge Produk (Bandingkan updatedAt, dukung soft-delete)
      const productMap = new Map()
      ;(lData.products || []).forEach(p => productMap.set(p.id, p))
      ;(rData.products || []).forEach(rp => {
        const lp = productMap.get(rp.id)
        if (!lp || (rp.updatedAt || 0) > (lp.updatedAt || 0)) {
          productMap.set(rp.id, rp)
        }
      })
      const mergedProducts = Array.from(productMap.values())

      // 2. Merge Pelanggan (cocokkan ID atau nama "Umum" agar tidak duplikat)
      const customerMap = new Map()
      const customerNameToId = new Map()
      ;(lData.customers || []).forEach(c => {
        customerMap.set(c.id, c)
        if (c.name) customerNameToId.set(c.name.trim().toLowerCase(), c.id)
      })
      ;(rData.customers || []).forEach(rc => {
        const nameKey = rc.name?.trim().toLowerCase()
        const matchedId = customerMap.has(rc.id) ? rc.id : (nameKey ? customerNameToId.get(nameKey) : null)
        if (matchedId == null) {
          customerMap.set(rc.id, rc)
          if (nameKey) customerNameToId.set(nameKey, rc.id)
        } else {
          const lc = customerMap.get(matchedId)
          if ((rc.updatedAt || 0) > (lc.updatedAt || 0)) {
            customerMap.set(matchedId, { ...rc, id: matchedId })
          }
        }
      })
      const mergedCustomers = Array.from(customerMap.values())

      // 3. Merge Pengaturan Toko per key berdasarkan updatedAt lebih dulu (agar cutoff arsip terbaca)
      const settingsMap = new Map()
      ;(lData.settings || []).forEach(s => settingsMap.set(s.key, s))
      ;(rData.settings || []).forEach(rs => {
        const ls = settingsMap.get(rs.key)
        if (!ls || (rs.updatedAt || 0) > (ls.updatedAt || 0)) {
          settingsMap.set(rs.key, rs)
        }
      })
      const mergedSettings = Array.from(settingsMap.values())
      const archiveCutoff = Number(settingsMap.get('archiveState')?.value?.cutoffAt || 0)

      const toTimestamp = (val) => {
        if (typeof val === 'number') return val
        const parsed = Date.parse(val)
        return Number.isFinite(parsed) ? parsed : 0
      }

      // 4. Merge Transaksi (berdasarkan invoiceNumber agar tidak tertimpa bentrok ID, hormati cutoff arsip)
      const txMap = new Map()
      ;(lData.transactions || []).forEach(t => {
        if (archiveCutoff > 0 && toTimestamp(t.createdAt) < archiveCutoff) return
        txMap.set(t.invoiceNumber || t.id, t)
      })
      ;(rData.transactions || []).forEach(rt => {
        if (archiveCutoff > 0 && toTimestamp(rt.createdAt) < archiveCutoff) return
        const key = rt.invoiceNumber || rt.id
        if (!txMap.has(key)) {
          txMap.set(key, rt)
        }
      })
      const mergedTransactions = Array.from(txMap.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

      // 5. Merge Pembayaran Utang (berdasarkan kunci unik komposit, hormati cutoff arsip)
      const payMap = new Map()
      ;(lData.debtPayments || []).forEach(dp => {
        if (archiveCutoff > 0 && toTimestamp(dp.paymentDate) < archiveCutoff) return
        payMap.set(`${dp.customerId}_${dp.paymentDate}_${dp.amount}`, dp)
      })
      ;(rData.debtPayments || []).forEach(rdp => {
        if (archiveCutoff > 0 && toTimestamp(rdp.paymentDate) < archiveCutoff) return
        const key = `${rdp.customerId}_${rdp.paymentDate}_${rdp.amount}`
        if (!payMap.has(key)) {
          payMap.set(key, rdp)
        }
      })
      const mergedDebtPayments = Array.from(payMap.values())

      // 6. Merge Pengeluaran / Kas Keluar (berdasarkan expenseNumber atau id, LWW per updatedAt & hormati cutoff arsip)
      const expMap = new Map()
      ;(lData.expenses || []).forEach(exp => {
        if (archiveCutoff > 0 && toTimestamp(exp.createdAt) < archiveCutoff) return
        const key = exp.expenseNumber || exp.id
        expMap.set(key, exp)
      })
      ;(rData.expenses || []).forEach(re => {
        if (archiveCutoff > 0 && toTimestamp(re.createdAt) < archiveCutoff) return
        const key = re.expenseNumber || re.id
        const le = expMap.get(key)
        if (!le || (re.updatedAt || 0) > (le.updatedAt || 0)) {
          expMap.set(key, re)
        }
      })
      const mergedExpenses = Array.from(expMap.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

      // 7. Merge Shift Buka/Tutup Buku (berdasarkan shiftCode atau id, LWW per updatedAt; jaga shift OPEN tetap aktif)
      const shiftMap = new Map()
      ;(lData.shifts || []).forEach(sh => {
        if (archiveCutoff > 0 && sh.status !== 'OPEN' && toTimestamp(sh.openedAt) < archiveCutoff) return
        const key = sh.shiftCode || sh.id
        shiftMap.set(key, sh)
      })
      ;(rData.shifts || []).forEach(rs => {
        if (archiveCutoff > 0 && rs.status !== 'OPEN' && toTimestamp(rs.openedAt) < archiveCutoff) return
        const key = rs.shiftCode || rs.id
        const ls = shiftMap.get(key)
        if (!ls || (rs.updatedAt || 0) > (ls.updatedAt || 0)) {
          shiftMap.set(key, rs)
        }
      })
      const mergedShifts = Array.from(shiftMap.values())
        .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))

      // 8. Merge Nota Kulakan (berdasarkan restockNumber atau id, LWW per updatedAt & hormati cutoff arsip)
      const restockMap = new Map()
      ;(lData.restocks || []).forEach(rec => {
        if (archiveCutoff > 0 && toTimestamp(rec.createdAt) < archiveCutoff) return
        const key = rec.restockNumber || rec.id
        restockMap.set(key, rec)
      })
      ;(rData.restocks || []).forEach(rr => {
        if (archiveCutoff > 0 && toTimestamp(rr.createdAt) < archiveCutoff) return
        const key = rr.restockNumber || rr.id
        const lr = restockMap.get(key)
        if (!lr || (rr.updatedAt || 0) > (lr.updatedAt || 0)) {
          restockMap.set(key, rr)
        }
      })
      const mergedRestocks = Array.from(restockMap.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

      const mergedPayload = {
        app: 'Kasiry POS',
        version: '2.4',
        exportedAt: new Date().toISOString(),
        storeProfile: settingsMap.get('storeProfile')?.value || localData.storeProfile || remoteData.storeProfile,
        data: {
          products: mergedProducts,
          customers: mergedCustomers,
          transactions: mergedTransactions,
          debtPayments: mergedDebtPayments,
          expenses: mergedExpenses,
          restocks: mergedRestocks,
          shifts: mergedShifts,
          settings: mergedSettings
        }
      }

      // Terapkan data gabungan ke IndexedDB lokal
      if (typeof applyMergedDataCallback === 'function') {
        await applyMergedDataCallback(mergedPayload)
      }

      // Upload kembali data gabungan paling mutakhir ke Google Drive & flush antrean Sheets
      await uploadToDrive(mergedPayload, fileId, interactive)
      await flushPendingSheetQueue(mergedPayload.storeProfile?.name, interactive)
      markDrivePending(false)
      pendingDriveTxBatch = 0

      const nowIso = new Date().toISOString()
      lastSyncTime.value = nowIso
      localStorage.setItem('kasiry_gdrive_last_sync', nowIso)
      statusMessage.value = 'Sinkronisasi cadangan cloud berhasil!'

      return { success: true, updated: true, mergedCount: mergedTransactions.length }
    } catch (err) {
      console.error('Gagal sinkronisasi dengan Google:', err)
      const errMsg = err.message || 'Gagal sinkronisasi data.'
      statusMessage.value = errMsg
      return { success: false, error: errMsg }
    } finally {
      isSyncing.value = false
    }
  }

  // Unggah file arsip tahunan terpisah ke Google Drive agar tidak menimpa backup aktif
  const uploadArchiveToDrive = async (archivePayload, archiveFilename, interactive = false) => {
    if (!isConnected.value) return null
    try {
      return await uploadToDrive(archivePayload, null, interactive, archiveFilename)
    } catch (err) {
      console.warn('[Archive Drive] Gagal mengunggah salinan arsip ke Drive:', err)
      return null
    }
  }

  // Dorong snapshot bersih ke Drive setelah proses arsip tahunan (tanpa menghidupkan data lama)
  const pushCleanCloudSnapshot = async (localData, interactive = false) => {
    if (!isConnected.value) return { success: false, skipped: true }
    return await syncWithCloud(localData, null, interactive)
  }

  // Jadwalkan auto-backup Google Drive secara senyap setelah perubahan data lokal
  // Ketika data transaksi sudah besar (>= 200), snapshot Drive dibatch setiap 10 transaksi atau 3 menit
  // karena setiap transaksi kasir sudah dicatat realtime per baris ke Google Sheets.
  const scheduleDriveAutoBackup = (getLocalPayloadFn, applyMergedFn, getStoreNameFn, options = {}) => {
    if (!isConnected.value) return
    markDrivePending(true)

    const { isTransactional = false, txCount = 0 } = options
    let delayMs = 2500

    if (isTransactional && txCount >= 200) {
      pendingDriveTxBatch += 1
      delayMs = pendingDriveTxBatch >= DRIVE_TX_BATCH_THRESHOLD ? 2500 : DRIVE_TX_THROTTLE_MS
    }

    if (driveAutoBackupTimer) {
      clearTimeout(driveAutoBackupTimer)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }

    driveAutoBackupTimer = setTimeout(async () => {
      if (!isConnected.value || isSyncing.value || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return
      }
      try {
        const storeName = typeof getStoreNameFn === 'function' ? getStoreNameFn() : 'Toko'
        await flushPendingSheetQueue(storeName)
        const payload = await getLocalPayloadFn()
        await syncWithCloud(payload, applyMergedFn, false)
      } catch (err) {
        console.warn('[AutoBackup Drive] Ditunda hingga koneksi/token siap:', err)
      }
    }, delayMs)
  }

  return {
    accessToken,
    userProfile,
    lastSyncTime,
    linkedSheetId,
    customClientId,
    pendingQueueCount,
    hasPendingDriveBackup,
    isConnecting,
    isSyncing,
    statusMessage,
    isConnected,
    activeClientId,
    connect,
    disconnect,
    setCustomClientId,
    syncWithCloud,
    uploadArchiveToDrive,
    pushCleanCloudSnapshot,
    scheduleDriveAutoBackup,
    flushPendingSheetQueue,
    appendTransactionToSheet,
    appendDebtPaymentToSheet,
    appendExpenseToSheet,
    appendRestockToSheet,
    appendShiftEventToSheet,
    ensureSpreadsheet
  }
}
