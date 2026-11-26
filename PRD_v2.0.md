# Product Requirements Document (PRD) & Blueprint Arsitektur: Kasiry (Habiba Store)

**Versi Dokumen:** 2.7 (Sinkronisasi Implementasi Produksi, Dual Responsive Bento, Skalabilitas Multi-Tahun & Automated Testing)  
**Status:** Production-Ready & Terverifikasi Build/Unit-Integration Test  
**Penulis:** Yodi & Antigravity (AI Assistant)  
**Identitas Toko Acuan:** Habiba Store (Pemilik: Habiba | WA: 081234567890)  
**Platform Target:** Progressive Web App (PWA) Mobile-First, Tablet & Desktop POS  
**Repository GitHub:** `https://github.com/yodi-dev/kasiry.git`  
**Workspace:** `d:\web\kasiryy`  

---

## Dokumen Kontrol & Riwayat Versi (Changelog Ringkas)

> Riwayat perubahan detail tiap rilis tercatat di [`CHANGELOG.md`](CHANGELOG.md).

| Versi | Tanggal | Ringkasan Milestone |
| :---: | :---: | :--- |
| **v2.7.1** | 26 November 2026 | **Tahap 3 (Sinkronisasi Dokumen & Checklist Rilis):** Pembaruan menyeluruh `README.md`, `PRD_v2.0.md`, `SITEMAP.md`, serta checklist final verifikasi Google OAuth & uji perangkat fisik. |
| **v2.7.0** | 26 November 2026 | **Tahap 2 (Automated Testing & Bersih-Bersih Kode):** Setup Vitest + `fake-indexeddb` (5 suite, 12 skenario test), perbaikan bug `DAY_MS` pada modul arsip, penghapusan sisa `licenseStatus`, 6 file prototipe mati, serta migrasi skema Dexie `v1 -> v2` (`transactionItems: null`). |
| **v2.6.0** | 26 November 2026 | **Tahap 1 (Pemecahan Bundle / Code Splitting):** Pemisahan chunk `vendor-vue`, `vendor-dexie`, `vendor-xlsx`, `vendor-zxing`, dynamic `import('xlsx')`, `defineAsyncComponent` untuk seluruh 9 modal sekunder + idle pre-warm jalur checkout, serta `{ immediate: true }` pada watcher open modal. |
| **v2.5.0** | 26 November 2026 | **Bento UI, Hybrid Scanner & Skalabilitas Multi-Tahun:** Layout Bento 2-kolom untuk Tablet/Desktop, kunci soft-keyboard HP hingga disentuh, hybrid `BarcodeDetector` + `@zxing/library` + kamera depan, tambah kategori inline di Lazy Inventory, jendela RAM 90 hari, `buildCustomerStatsMap` $O(N)$, batching Drive, & **Arsip Data Tahunan**. |
| **v2.4.2** | 25 November 2026 | **QA Browser & Stabilisasi:** Modal Manajemen Pelanggan, pelanggan default `"Umum"`, helper `toPlain()` pencegah `DataCloneError`, validasi kembalian cicilan bon pecahan besar. |
| **v2.4.0** | 23 November 2026 | **Cloud Sync Google $0:** GIS login 1-klik, snapshot Google Drive (`kasiry-backup.json`), Buku Kas Google Sheets, dan two-way sync dengan antrean offline. |
| **v2.3.0** | 23 November 2026 | **Tahap 1–3 Core:** Dexie.js IndexedDB (`KasiryDB`), scanner USB/BT + audio beep, struk 58mm & WA, Buku Utang Digital, Laporan Harian & ekspor Excel multi-sheet. |
| **v2.2.0** | 22 November 2026 | **Ergonomi Terbalik & Glassmorphism Modern:** *Inverted Ergonomic Flow*, identitas Habiba Store, dan palet Midnight Deep Navy `#0a193d` + Azure Sky `#0284c7`. |

---

## 1. Ringkasan Eksekutif & Identitas Brand

### 1.1 Filosofi Produk
**Kasiry** adalah aplikasi kasir (*Point of Sale*) Progressive Web App (PWA) *offline-first* yang dirancang khusus untuk **warung kelontong dan UMKM mikro Indonesia**.

**Prinsip Inti:**
1. **Nol Hambatan Login (*Zero Login Wall*):** Buka aplikasi langsung masuk ke layar Kasa siap bertransaksi.
2. **100% Berfungsi Tanpa Internet (*Offline-First*):** Seluruh katalog, transaksi, dan piutang tersimpan di IndexedDB (`Dexie.js`) dan aset/chunk JS di-precache oleh Service Worker Workbox.
3. **Ergonomi Adaptif per Perangkat:** Mobile memakai ergonomi jangkauan jempol di bawah (*Thumb Zone*) tanpa footer pengganggu; Tablet & Desktop memakai stasiun kerja *Bento 2-Kolom* lengkap dengan filter kategori & pintasan keyboard.
4. **Cloud Backup Gratis ($0 Server Cost):** Menggunakan Google Sheets & Google Drive milik pemilik warung via Google Identity Services (GIS).
5. **Ringan Lintas Tahun:** Arsitektur memori berjendela (*90-day RAM window*) + alat arsip tahunan memastikan aplikasi tetap cepat meski riwayat transaksi menumpuk puluhan ribu baris.

---

## 2. Target Pengguna (User Persona)

- **Persona 1 — Ibu Habiba (Pemilik Warung):** Mengoperasikan kasir harian dari ponsel Android kelas menengah, butuh tampilan kontras tinggi yang mudah dibaca, Buku Utang digital berurutan rapi + pengingat WhatsApp sopan, dan laporan harian dalam 1 ketukan.
- **Persona 2 — Penjaga Toko Pengganti / Kasir Desktop:** Menggunakan barcode scanner USB/Bluetooth atau kamera HP (depan/belakang) untuk barang kemasan, serta tombol cepat terkurasi & kategori untuk barang curah (Gas LPG, Galon, Telur, Beras).

---

## 3. Arsitektur Antarmuka & Tata Letak Adaptif (`App.vue`)

Aplikasi beroperasi sebagai **Single-Screen POS Hub** dengan dua mode layout adaptif:

```mermaid
flowchart TD
    App["App.vue (Single-Screen POS Hub)"]
    App --> TopBar["TopBar: Nama Toko, Indikator Online/Offline & Cloud, Slide-Over Drawer"]
    App --> MobileMode["Mode Mobile < 768px (Inverted Thumb-Zone)"]
    App --> DesktopMode["Mode Tablet/Desktop >= 768px (Bento 2-Kolom)"]

    MobileMode --> M_Cart["Atas: CartSection (Struk Belanjaan)"]
    MobileMode --> M_Freq["Tengah: FrequentProductsSection (Terlaris / Semua)"]
    MobileMode --> M_Dock["Bawah Sticky: BarcodeInputBar (Touch-Locked) + StickyBottomBar"]

    DesktopMode --> D_Left["Kolom Kiri (5/12 - 4/12): CartSection + Tombol Pembayaran"]
    DesktopMode --> D_Right["Kolom Kanan (7/12 - 8/12): BarcodeInputBar Inline + Tab Kategori + Grid Adaptif"]
    DesktopMode --> D_Foot["Footer Desktop >= 1024px: Pintasan (/ & F2) + Privacy & Terms"]

    App -.->|"Lazy Async Chunks (defineAsyncComponent)"| Modals["9 Modal Fitur: Payment, Receipt, LazyInventory, ProductCRUD, CustomerCRUD, DebtBook, DailyReport, Settings, CameraScanner"]
```

---

## 4. Spesifikasi Fungsional Implementasi Aktual

### 4.1 Barcode Scanner Hardware (HID), Kamera Hybrid & Keyboard Lock
- **Desktop Non-Sentuh (`isDesktopAutoFocus`):** Mendukung *autofocus* penuh, tombol pintas `/` untuk cari & `F2` untuk langsung membuka Pembayaran, serta global key capture ke input pencarian.
- **Perangkat Sentuh / Mobile:** Input kasa menerapkan kunci soft-keyboard (`inputMode="none"` hingga input disentuh langsung) agar keyboard virtual Android/iOS tidak otomatis menyembul setelah ketuk barang cepat atau menutup sidebar/modal.
- **Scanner Kamera Hybrid (`CameraScannerModal.vue`):** Menggabungkan `BarcodeDetector` native dengan fallback `@zxing/library` (`MultiFormatReader` `TRY_HARDER`), switch kamera depan/belakang (flip horizontal + panduan jarak), zoom hardware/digital, lampu flash (*torch*), dan sinyal beep audio.

### 4.2 Lazy Inventory & Kategori Dinamis
- Pemindaian atau pencarian barcode yang belum terdaftar membuka `LazyInventoryModal.vue` dengan barcode terisi otomatis.
- Kasir dapat memilih kategori atau membuat **kategori baru secara inline** tanpa keluar modal, mengisi harga jual & estimasi modal (default 80%), lalu barang langsung masuk katalog IndexedDB sekaligus keranjang belanja.

### 4.3 Pembayaran Tunai, Utang/Bon & Manajemen Pelanggan
- **Tunai:** Pelanggan default **"Umum"** (dapat diganti via dropdown pencarian yang otomatis diurutkan berdasarkan frekuensi belanja $O(N)$ lewat `buildCustomerStatsMap`), nominal uang pas, saran pembulatan, dan pecahan rupiah standar.
- **Utang / Bon:** Akun `"Umum"` otomatis diblokir baik di UI (`PaymentModal.vue`) maupun di lapisan database (`useKasiryDB.js`) agar utang selalu terikat ke pelanggan nyata. Pencarian nama atau daftar pelanggan baru berlangsung instan tanpa formulir panjang.
- **Manajemen Pelanggan (`CustomerManagementModal.vue`) & Buku Utang (`DebtBookModal.vue`):** Dilengkapi riwayat belanja penuh per pelanggan lewat query indeks on-demand (`getCustomerTransactions`), cicilan utang dengan pembatasan nominal lunas vs uang kembalian (`Math.min(amount, currentDebt)`), serta tombol pengingat WhatsApp sopan.

### 4.4 Laporan Harian, Excel Dinamis & Arsip Data Tahunan
- **Laporan Harian (`DailyReportModal.vue`):** Menampilkan Uang Masuk Kas, Penjualan Tunai, Pelunasan Bon, Perkiraan Untung Bersih, Bon Baru, Top 5 Barang Terlaris, tab Riwayat Transaksi Hari Ini, kirim rekap WhatsApp, serta ekspor **Excel 4 sheet** (`Ringkasan Kas`, `Daftar Transaksi`, `Barang Terjual`, `Buku Utang Pelanggan`) via dynamic `import('xlsx')` yang menarik semua transaksi lintas tahun (`getAllTransactionsForExport()`).
- **Skalabilitas & Arsip Data Tahunan (`SettingsModal.vue`):**
  - Memori runtime (`useKasiryDB.js`) memakai `shallowRef([])`, hanya memuat **90 hari terakhir** ke UI Kasa harian (`ACTIVE_HISTORY_DAYS = 90`), serta melakukan pembaruan state parsial setelah checkout & CRUD.
  - Fitur **Kesehatan & Arsip Data Tahunan** menyediakan pilihan retensi `> 3 Bulan`, `> 6 Bulan`, dan `> 1 Tahun` yang otomatis mengunduh file `Arsip_<NamaToko>_sd_<Tanggal>.json` (+ mengunggah salinan arsip ke Google Drive bila terhubung & online), menyimpan `archiveState.cutoffAt`, lalu membersihkan baris lama di IndexedDB tanpa mengubah produk maupun `totalDebt` pelanggan.

### 4.5 Cloud Sync `$0` (Google Drive, Google Sheets & Kepatuhan OAuth)
- Koneksi Google 1-klik via Google Identity Services (`useGoogleSync.js`), mendukung offline queue untuk Google Sheets (`flushPendingSheetQueue`), merge two-way LWW berbasis `updatedAt`, penghormatan `archiveState` antar-perangkat (sementara impor JSON manual tetap dapat memulihkan file arsip lama via `honorArchiveCutoff: false`), dan *adaptive Drive batching* (10 transaksi / 3 menit saat transaksi $\ge 200$).
- Mendukung penayangan di Cloudflare Pages dengan `/privacy.html`, `/terms.html`, `_headers` COOP (`same-origin-allow-popups`), serta bypass SW fallback di `vite.config.js`.

---

## 5. Model Data Lokal (Dexie.js `KasiryDB` v2)

```javascript
// src/db/index.js — KasiryDatabase
db.version(1).stores({
  products: '++id, barcode, name, category, isMacro, updatedAt, deleted',
  transactions: '++id, invoiceNumber, createdAt, paymentMethod, customerId, updatedAt',
  transactionItems: '++id, transactionId, productId, updatedAt',
  customers: '++id, name, phone, totalDebt, updatedAt, deleted',
  debtPayments: '++id, customerId, paymentDate, updatedAt',
  settings: 'key, updatedAt'
})

// Migrasi bersih ke v2: item belanja disimpan inline pada transactions.items
db.version(2).stores({
  transactionItems: null
})
```
*Catatan `settings` keys:* `storeProfile`, `categories`, `archiveState` (`{ cutoffAt }`). Format backup JSON eksternal mempertahankan `version: '2.4'`.

---

## 6. Standar Kualitas, Arsitektur Build & Automated Testing

1. **Code Splitting & Bundle Budget:**
   - Konfigurasi Rolldown `codeSplitting.groups` di `vite.config.js` memisahkan `vendor-vue`, `vendor-dexie`, `vendor-xlsx`, dan `vendor-zxing`.
   - Entry bundle `index` terjaga di kisaran **`~94 kB` (`~29 kB` gzip)** (< target 60 KB gzip per chunk utama), bebas chunk warning `> 500 kB`, dengan 9 modal sekunder terpisah sebagai async chunks (`prewarmCheckoutChunks` menghangatkan `PaymentModal`, `LazyInventoryModal`, dan `ReceiptModal` saat browser luang).
2. **Offline PWA Precaching:** Workbox men-generate `precache 45 entries` di `dist/sw.js` sehingga seluruh chunk pecahan & aset statis tetap berjalan offline 100%.
3. **Automated Tests:** Dijalankan melalui `npm test` (`Vitest` + `fake-indexeddb`) mencakup unit & integration test di folder `tests/` (`customerStats`, `useKasiryDB`, `useGoogleSync`, `dbMigration` `v1 -> v2`, dan `excelExport`).
4. **Penyimpanan Persisten & Render Katalog:** `navigator.storage.persist()` aktif saat inisialisasi DB, dan kartu katalog di bawah lipatan layar (`idx >= 16`) memakai `.offscreen-card-defer` (`content-visibility: auto; contain-intrinsic-size: auto none auto 92px;`).

---

## 7. Checklist Rilis Produksi & Uji Perangkat Fisik

Status terbaru sebelum rilis penuh ke pemilik warung:
- [x] Build produksi bersih (`npm run build`), 0 error & 0 warning ukuran chunk.
- [x] Automated tests Vitest lulus (`npm test`: 5 suite, 12 skenario).
- [x] Verifikasi domain Google Search Console aktif (`public/google50a425d7a5de8ecd.html`).
- [x] Halaman `/privacy.html`, `/terms.html`, ikon OAuth (`kasiry-oauth-120x120.png`), serta COOP header tersedia di `public/`.
- [ ] **Uji Perangkat Fisik Manual (Final Field Check):**
  - Test hardware barcode scanner USB OTG / Bluetooth di HP Android & PC.
  - Test kamera belakang & depan langsung di HP terhadap barcode kemasan nyata (`CameraScannerModal`).
  - Test cetak struk asli ke printer thermal 58mm via `window.print()` (`ReceiptModal`) & alur kirim nota/tagihan WhatsApp.
  - Test mode restore **Timpa Total (Reset)**, **Arsip Tahunan + Drive**, dan reload offline PWA (`npm run preview` / `https://kasiry.pages.dev`).
  - Pastikan status **Google OAuth Consent Screen** di Google Cloud Console berstatus *Published / Verified* agar akun Google toko baru tidak terkena batasan *Testing mode*.

---

## 8. Roadmap Pengembangan Selanjutnya (Backlog v2.8+)

Daftar fitur berikut dicatat untuk dibahas detail (*design & spec alignment*) dan dikerjakan satu per satu pada iterasi berikutnya:

| No | Item Fitur | Status | Ringkasan Cakupan Awal untuk Dibahas |
| :-: | :--- | :---: | :--- |
| 1 | **Sistem Buka & Tutup Shift** | `[ ] Backlog` | Modal/saldo kas awal laci, pencatatan nama kasir/shift aktif, ringkasan uang fisik laci vs sistem saat tutup shift, selisih kas, & rekap laporan per shift. |
| 2 | **Transaksi Keluar / Pengeluaran Harian** | `[ ] Backlog` | Pencatatan kas keluar warung per hari (listrik, plastik, bensin, iuran, dll.), memengaruhi saldo laci shift/kas harian, & muncul di Laporan Harian + ekspor Excel/Sheets. |
| 3 | **Multi Harga (Ecer / Grosir / Agen)** | `[ ] Backlog` | Definisi tier harga atau aturan grosir bertingkat (berdasarkan qty atau level pelanggan/manual switch saat transaksi) serta skema IndexedDB & backup kompatibel. |
| 4 | **Metode Bayar QRIS** | `[ ] Backlog` | Opsi tab/metode pembayaran `QRIS` di `PaymentModal.vue` (QRIS statis toko / gambar QR unggahan pemilik warung), pencatatan di struk & laporan kas non-tunai (agar terpisah dari kas fisik laci). |
| 5 | **Fitur Kulakan / Belanja Stok** | `[ ] Backlog` | Pencatatan stok masuk barang, harga kulak/modal terbaru, pembaruan stok produk (opsional pelacakan stok aktif), serta keterhubungannya dengan pengeluaran kas warung atau shift. |
| 6 | **Pembersihan & Seed Data Awal Baru** | `[ ] Backlog` | Audit dan peremajaan `src/db/seedData.js` (produk awal warung & contoh pelanggan buku utang) atau opsi awal warung bersih vs data contoh. |
