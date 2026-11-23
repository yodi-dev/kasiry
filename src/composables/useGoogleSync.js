import { ref, computed } from 'vue'

const DEFAULT_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '10475823948-6l2qk1g1313g4c8afujo6md17t51th20.apps.googleusercontent.com'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

const BACKUP_FILENAME = 'kasiry-habiba-backup.json'
const SHEET_FILENAME = 'Kasiry - Buku Kas Habiba Store'

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
const userProfile = ref(
  JSON.parse(localStorage.getItem('kasiry_gdrive_user') || 'null')
)
const lastSyncTime = ref(
  localStorage.getItem('kasiry_gdrive_last_sync') || null
)
const linkedSheetId = ref(
  localStorage.getItem('kasiry_linked_sheet_id') || null
)
const customClientId = ref(
  localStorage.getItem('kasiry_custom_client_id') || ''
)

const isConnecting = ref(false)
const isSyncing = ref(false)
const statusMessage = ref('')

export function useGoogleSync() {
  const isConnected = computed(() => !!userProfile.value)
  const activeClientId = computed(() => customClientId.value.trim() || DEFAULT_CLIENT_ID)

  // Inisialisasi & Permintaan Token GIS (Google Identity Services)
  const requestToken = (promptType = '') => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        reject(
          new Error('Google Identity Services belum siap. Periksa koneksi internet Anda.')
        )
        return
      }

      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId.value,
          scope: SCOPES,
          callback: async (resp) => {
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
    localStorage.removeItem('kasiry_gdrive_token')
    localStorage.removeItem('kasiry_gdrive_token_expires')
    localStorage.removeItem('kasiry_gdrive_user')
    localStorage.removeItem('kasiry_linked_sheet_id')
    localStorage.removeItem('kasiry_gdrive_last_sync')
    statusMessage.value = 'Akun Google telah diputuskan.'
  }

  // Cari File Backup di Google Drive
  const findBackupFileId = async (interactive = false) => {
    const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`)
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
    if (data.files && data.files.length > 0) {
      return data.files[0].id
    }
    return null
  }

  // Simpan Snapshot ke Google Drive
  const uploadToDrive = async (payloadData, existingFileId = null, interactive = false) => {
    const content = JSON.stringify(payloadData, null, 2)

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
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        description: 'Kasiry POS Warung Cloud Backup'
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

  // Cari atau Buat Spreadsheet Buku Kas Warung
  const ensureSpreadsheet = async () => {
    if (linkedSheetId.value) {
      return linkedSheetId.value
    }

    try {
      // 1. Cek apakah sudah pernah ada
      const q = encodeURIComponent(
        `name='${SHEET_FILENAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
      )
      const res = await fetchWithAuth(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`
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
        properties: { title: SHEET_FILENAME },
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

      const createRes = await fetchWithAuth('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

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

  // Tambahkan Baris Transaksi Baru ke Google Sheets
  const appendTransactionToSheet = async (txData) => {
    if (!isConnected.value) return
    try {
      const sheetId = await ensureSpreadsheet()
      if (!sheetId) return

      const itemsText = (txData.items || [])
        .map(i => `${i.qty}x ${i.name}`)
        .join(', ')

      const row = [
        new Date(txData.createdAt || Date.now()).toLocaleString('id-ID'),
        txData.invoiceNumber || '-',
        txData.paymentMethod || 'TUNAI',
        txData.customerName || (txData.paymentMethod === 'TUNAI' ? 'Pelanggan Umum' : '-'),
        txData.totalAmount || 0,
        txData.cashGiven || txData.totalAmount || 0,
        txData.changeAmount || 0,
        itemsText
      ]

      await fetchWithAuth(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Rekap Transaksi Kasir!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] })
        }
      )
    } catch (err) {
      console.warn('Gagal mencatat transaksi ke Google Sheets:', err)
    }
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
        const nowIso = new Date().toISOString()
        lastSyncTime.value = nowIso
        localStorage.setItem('kasiry_gdrive_last_sync', nowIso)
        statusMessage.value = 'Cadangan awal berhasil disimpan ke Google Drive!'
        return { success: true, updated: false, fileId: newFileId }
      }

      // KASUS 2: File sudah ada di Google Drive -> Jalankan Two-Way Merge
      const remoteData = await downloadFromDrive(fileId, interactive)
      if (!remoteData || !remoteData.data) {
        throw new Error('Format file cloud tidak valid.')
      }

      const rData = remoteData.data
      const lData = localData.data || {}

      // 1. Merge Produk (Bandingkan updatedAt, dukung soft-delete)
      const productMap = new Map()
      // Masukkan local
      ;(lData.products || []).forEach(p => productMap.set(p.id, p))
      // Bandingkan dengan remote
      ;(rData.products || []).forEach(rp => {
        const lp = productMap.get(rp.id)
        if (!lp) {
          productMap.set(rp.id, rp)
        } else {
          // Pilih yang paling baru
          if ((rp.updatedAt || 0) > (lp.updatedAt || 0)) {
            productMap.set(rp.id, rp)
          }
        }
      })
      const mergedProducts = Array.from(productMap.values())

      // 2. Merge Pelanggan Buku Utang (Bandingkan updatedAt)
      const customerMap = new Map()
      ;(lData.customers || []).forEach(c => customerMap.set(c.id, c))
      ;(rData.customers || []).forEach(rc => {
        const lc = customerMap.get(rc.id)
        if (!lc) {
          customerMap.set(rc.id, rc)
        } else {
          if ((rc.updatedAt || 0) > (lc.updatedAt || 0)) {
            customerMap.set(rc.id, rc)
          }
        }
      })
      const mergedCustomers = Array.from(customerMap.values())

      // 3. Merge Transaksi (Event logs berdasarkan invoiceNumber / createdAt)
      const txMap = new Map()
      ;(lData.transactions || []).forEach(t => txMap.set(t.invoiceNumber || t.id, t))
      ;(rData.transactions || []).forEach(rt => {
        const key = rt.invoiceNumber || rt.id
        if (!txMap.has(key)) {
          txMap.set(key, rt)
        }
      })
      const mergedTransactions = Array.from(txMap.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

      // 4. Merge Pembayaran Utang
      const payMap = new Map()
      ;(lData.debtPayments || []).forEach(dp => payMap.set(dp.id || `${dp.customerId}_${dp.paymentDate}`, dp))
      ;(rData.debtPayments || []).forEach(rdp => {
        const key = rdp.id || `${rdp.customerId}_${rdp.paymentDate}`
        if (!payMap.has(key)) {
          payMap.set(key, rdp)
        }
      })
      const mergedDebtPayments = Array.from(payMap.values())

      // 5. Merge Pengaturan Toko
      const mergedSettings = rData.settings || lData.settings || []

      const mergedPayload = {
        app: 'Kasiry POS',
        version: '2.2',
        exportedAt: new Date().toISOString(),
        storeProfile: localData.storeProfile || remoteData.storeProfile,
        data: {
          products: mergedProducts,
          customers: mergedCustomers,
          transactions: mergedTransactions,
          debtPayments: mergedDebtPayments,
          settings: mergedSettings
        }
      }

      // Terapkan data gabungan ke IndexedDB lokal
      if (typeof applyMergedDataCallback === 'function') {
        await applyMergedDataCallback(mergedPayload)
      }

      // Upload kembali data gabungan paling mutakhir ke Google Drive
      await uploadToDrive(mergedPayload, fileId, interactive)

      const nowIso = new Date().toISOString()
      lastSyncTime.value = nowIso
      localStorage.setItem('kasiry_gdrive_last_sync', nowIso)
      statusMessage.value = 'Sinkronisasi multi-device berhasil!'

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

  return {
    accessToken,
    userProfile,
    lastSyncTime,
    linkedSheetId,
    customClientId,
    isConnecting,
    isSyncing,
    statusMessage,
    isConnected,
    activeClientId,
    connect,
    disconnect,
    syncWithCloud,
    appendTransactionToSheet,
    ensureSpreadsheet
  }
}
