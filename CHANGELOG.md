# Changelog Kasiry POS

Seluruh perubahan penting, peningkatan fitur, perbaikan bug, dan rilis versi **Kasiry (Habiba Store POS)** dicatat pada dokumen ini mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.0.0/) dan [Semantic Versioning](https://semver.org/).

> **Catatan Kompatibilitas Data:** Format JSON backup lokal/Google Drive tetap mempertahankan schema `version: '2.4'` agar file cadangan lama dan arsip tahunan tetap kompatibel lintas versi.

---

## [2.8.0] - 2026-11-26 (Roadmap #1: Metode Bayar QRIS & Pemisahan Arus Kas Laci)

### Added
- Tab metode pembayaran **`QRIS`** pada `src/components/PaymentModal.vue` (`Tunai` sebagai default | `QRIS` | `Utang / Bon`) yang otomatis menggunakan uang pas tanpa kembalian tunai serta tetap mendukung pemilihan pelanggan loyalitas (default `"Umum"`).
- Opsi metode pembayaran **`Tunai` vs `QRIS`** pada pelunasan cicilan/utang di `src/components/DebtBookModal.vue` beserta penyimpanan `paymentMethod` di tabel `debtPayments` (`src/composables/useKasiryDB.js`).
- Nomor nota khusus transaksi QRIS dengan prefix **`QRS-...`** di `src/App.vue` (via helper terpusat `finalizeDirectSale`).
- Helper murni `computeDailyStats` di `src/utils/dailyStats.js` + suite test `tests/dailyStats.test.js` dan penambahan skenario QRIS pada `tests/useKasiryDB.test.js`, `tests/excelExport.test.js`, serta `tests/useGoogleSync.test.js`.

### Changed
- `ReceiptModal.vue` (tampilan thermal 58mm dan kirim WhatsApp) kini membedakan 3 status metode bayar: `TUNAI`, `QRIS` (`LUNAS (NON-TUNAI)`), dan `UTANG / BON`.
- `DailyReportModal.vue` (kartu **Total Kas Masuk**, teks laporan WA 1-klik, dan badge biru `QRIS` pada Riwayat Transaksi) serta `src/utils/excelExport.js` kini memisahkan **Uang Tunai Masuk Laci** dan **Penerimaan QRIS (Non-Tunai)** secara presisi sebagai fondasi fitur Pengeluaran & Shift.
- `src/composables/useGoogleSync.js` kini melabeli pelunasan bon via QRIS sebagai `PELUNASAN BON (QRIS)` di Google Sheets serta memperbaiki default pelanggan `'Umum'` pada transaksi QRIS.

---

## [2.7.1] - 2026-11-26 (Tahap 3: Sinkronisasi Dokumentasi & Checklist Rilis)

### Changed
- Memperbarui `README.md` dengan dokumentasi lengkap arsitektur fitur mutakhir, struktur proyek aktual, perintah pengujian `npm test` / `npm run test:watch`, serta konfigurasi deploy & OAuth.
- Memperbarui `PRD_v2.0.md` (menjadi v2.7) mencakup layout Bento Workstation Desktop/Tablet, Hybrid ZXing Camera & mobile soft-keyboard lock, Lazy Inventory kategori inline, jendela memori 90 hari + arsip tahunan, migrasi Dexie v2, benchmark ukuran bundle, automated test Vitest, serta checklist final rilis produksi & verifikasi Google OAuth.
- Memperbarui `SITEMAP.md` mencerminkan arsitektur dual-mode responsif (Mobile Thumb-Zone vs Bento Workstation Desktop), daftar 14 komponen aktif (`CustomerManagementModal` + 9 modal async), terminologi baku `"Pelanggan"`, dan alur Arsip Tahunan.
- Menyelaraskan versi rilis paket & badge UI ke `v2.7.1`.

---

## [2.7.0] - 2026-11-26 (Tahap 2: Automated Tests & Bersih-Bersih Kode Warisan)

### Added
- Konfigurasi automated unit/integration testing memakai **Vitest** (`vitest.config.js`, `tests/setup.js`) + **fake-indexeddb** dengan script `npm test` dan `npm run test:watch`.
- 5 suite pengujian (12 skenario test) di folder `tests/`:
  - `tests/customerStats.test.js` — agregasi $O(N)$ `buildCustomerStatsMap`, edge case nama/ID, dan benchmark 50.000 transaksi.
  - `tests/useKasiryDB.test.js` — inisialisasi katalog/pelanggan awal, transaksi tunai & bon, pembulatan pelunasan cicilan utang, jendela memori 90 hari + query pelanggan lintas tahun, proteksi kategori aktif, serta arsip tahunan & isolasi `honorArchiveCutoff`.
  - `tests/useGoogleSync.test.js` — antrean offline Google Sheets & flush batch saat online, throttling upload Drive (10 transaksi / 3 menit saat transaksi >= 200), dan merge LWW + filter cutoff arsip.
  - `tests/dbMigration.test.js` — verifikasi migrasi skema Dexie `v1 -> v2` beserta penghapusan tabel legacy `transactionItems` tanpa kehilangan data produk.
  - `tests/excelExport.test.js` — verifikasi dynamic import `xlsx` serta struktur 4 sheet workbook laporan Excel.

### Fixed
- Memperbaiki bug `ReferenceError: DAY_MS is not defined` (menggantinya ke `MS_PER_DAY`) pada `getArchivableSummary` dan `archiveOldTransactions` di `src/composables/useKasiryDB.js` yang terdeteksi langsung oleh test suite.
- Menambahkan guard angka non-finit/negatif pada `recordDebtPayment`, reset `archiveCutoffAt` ketika `archiveState` tidak ada pada `refreshSettings`, serta perlindungan level database agar akun sistem `"Umum"` tidak tercatat dalam `UTANG / BON`.

### Removed / Changed
- Upgrade skema Dexie (`src/db/index.js`) ke `version(2)` untuk menghapus tabel usang `transactionItems` secara aman.
- Menghapus sisa state & handler lisensi mati (`licenseStatus`, `handleActivateLicense`) dari `src/composables/useKasiryDB.js`, `src/db/seedData.js`, dan `src/App.vue` (sekaligus menghilangkan 1 penulisan IndexedDB tambahan tiap checkout).
- Menghapus 6 file prototipe awal yang sudah tidak terpakai: `DarkNavyCartSheet.vue`, `HeroCardsCarousel.vue`, `MacroProductMatrix.vue`, `ProductCatalogSection.vue`, `QuickActionActivities.vue`, dan `src/data/mockData.js`.

---

## [2.6.0] - 2026-11-26 (Tahap 1: Pemecahan Bundle / Code Splitting)

### Added
- Konfigurasi Rolldown `codeSplitting.groups` di `vite.config.js` untuk memisahkan chunk `vendor-vue`, `vendor-dexie`, `vendor-xlsx`, dan `vendor-zxing` serta mempertahankan precache Workbox PWA agar semua chunk tetap 100% berjalan offline.
- Lazy loading via `defineAsyncComponent` (`lazyModal`) di `src/App.vue` beserta fallback `AsyncModalLoading`, `AsyncModalError` (auto-retry 2x), mounting kondisional `activatedModals`, dan silent idle pre-warming (`prewarmCheckoutChunks`) untuk jalur checkout inti (`PaymentModal`, `LazyInventoryModal`, `ReceiptModal`).
- Indikator status muat (`isExporting` / *"Menyiapkan Excel..."*) pada tombol Unduh Excel di `src/components/DailyReportModal.vue`.
- Injeksi versi aplikasi terpusat (`__APP_VERSION__` dari `package.json`) serta badge versi di header `src/components/SettingsModal.vue`.
- Pencatatan rilis resmi pada `CHANGELOG.md`.

### Changed
- `src/utils/excelExport.js` kini memuat modul `xlsx` (SheetJS) secara dinamis (`await import('xlsx')`) hanya saat pengguna mengunduh laporan Excel.
- Menambahkan `{ immediate: true }` pada watcher `props.isOpen` di `CameraScannerModal.vue`, `CustomerManagementModal.vue`, `DebtBookModal.vue`, `LazyInventoryModal.vue`, `PaymentModal.vue`, `ProductManagementModal.vue`, dan `SettingsModal.vue` agar inisialisasi modal saat klik pertama tetap berjalan normal meski di-mount secara lazy.
- Ukuran entry JS aplikasi pada build produksi turun drastis dari `1,105.46 kB` (`325.65 kB` gzip) menjadi kisaran `~94 kB` (`~29 kB` gzip) dengan total boot JS awal ~`270 kB` (`~91 kB` gzip) dan menghilangkan peringatan chunk `> 500 kB`.

---

## [2.5.0] - 2026-11-26 (Bento UI, Hybrid Scanner & Skalabilitas Multi-Tahun)

### Added
- Layout **Bento POS Workstation** 2-kolom untuk Tablet & Desktop dengan kategori pill filter, inline search, pintasan `/` & `F2`, serta bebas footer pada layar HP (`1feda21`, `9364256`).
- Helper `buildCustomerStatsMap` (`src/utils/customerStats.js`) $O(N)$ untuk menghitung loyalitas pelanggan tanpa nested `.filter()` di dalam `.sort()`.
- Fitur **Kesehatan & Arsip Data Tahunan** di `SettingsModal.vue`, `useKasiryDB.js`, dan `useGoogleSync.js` (`getArchivableSummary`, `archiveOldTransactions`, `uploadArchiveToDrive`, `pushCleanCloudSnapshot`) dengan retensi `> 3 Bulan`, `> 6 Bulan`, dan `> 1 Tahun` tanpa menghapus saldo utang pelanggan maupun katalog barang.
- Pembuatan kategori baru langsung di `LazyInventoryModal.vue` dan sinkronisasi kategori dinamis (`02bf378`).
- Pengujian PWA & kepatuhan OAuth/SEO Cloudflare Pages (`/privacy.html`, `/terms.html`, `og-image.png`, `sitemap.xml`, `robots.txt`, `_headers` COOP, `google50a425d7a5de8ecd.html`, serta `navigateFallbackDenylist`).

### Changed
- Jendela memori transaksi aktif di Kasa dibatasi ke 90 hari terakhir (`ACTIVE_HISTORY_DAYS = 90`) dengan `shallowRef([])`, pembaruan state parsial CRUD/checkout, query on-demand per pelanggan (`getCustomerTransactions`), serta ekspor Excel penuh (`getAllTransactionsForExport`).
- Batching sinkronisasi Google Drive penuh untuk transaksi bervolume besar (`>= 200` transaksi -> tiap 10 transaksi / 3 menit) sambil menjaga baris Google Sheets tetap realtime.
- Kunci soft-keyboard virtual di HP pada `BarcodeInputBar.vue` (`inputMode="none"` hingga disentuh) dan peningkatan decode kamera depan + `@zxing/library` di `CameraScannerModal.vue` (`7ef14e0`).

### Fixed
- Mengganti tag HTML `<search>` dengan `<div>` agar tidak bentrok dengan ikon `Search` dari `@lucide/vue` (`cc02e35`).
- Penanganan popup Google Identity Services (GIS) & CORS/COOP, antrean offline Google Sheets, serta preview konfirmasi restore JSON (`2e4d2b4`, `1f72c7a`).

---

## [2.4.2] - 2026-11-25 (QA Live-Browser & Stabilisasi Alur Kasir)

### Added
- Modal dedicated **Manajemen Data Pelanggan** (`CustomerManagementModal.vue`), quick add pelanggan dari pembayaran tunai, pelanggan default `"Umum"` yang diblokir dari bon/utang, dan pengurutan pelanggan berdasarkan frekuensi belanja.

### Fixed
- Menghilangkan `DataCloneError` Dexie dengan unwrapper `toPlain()` saat menyimpan array/objek reaktif Vue (`c40fe24`).
- Validasi kembalian pada pelunasan cicilan utang pecahan besar, reset pilihan pelanggan bon yang basi, pembatasan `.limit(100)` pada query harian, serta fokus resilient pada Kasa desktop (`6d1ec52`).

---

## [2.4.0] - 2026-11-23 (Tahap 4: Cloud Sync Google $0)

### Added
- Autentikasi Google Identity Services (GIS) 1-klik, snapshot cadangan Google Drive (`kasiry-backup.json`), pembuatan otomatis Buku Kas Google Sheets, dan mesin two-way merge sinkronisasi multi-perangkat (`acde6c8`).

---

## [2.3.0] - 2026-11-23 (Tahap 1–3: Database Lokal, Scanner, Utang & Laporan)

### Added
- Database IndexedDB lokal via Dexie.js (`KasiryDB`) lengkap dengan `navigator.storage.persist()`, 38 seed produk, 5 seed pelanggan awal, serta ekspor/impor backup JSON offline (`1f77c85`).
- Listener hardware scanner USB/Bluetooth global, feedback audio Web Audio API, pratinjau struk thermal 58mm, dan kirim nota WhatsApp (`26c38f9`).
- Buku Utang Digital, pengingat WA pelanggan, Laporan Harian Kasir, dan ekspor Excel multi-sheet via SheetJS (`b0b72f6`).

---

## [2.2.0] - 2026-11-22 (Ergonomi Terbalik & Identitas Habiba Store)

### Added
- Prototipe Kasiry POS (Vue 3 + Vite + Tailwind CSS v4 + Workbox PWA) dengan tata letak *Inverted Ergonomic Flow* (*Glance Zone* di atas, *Quick Tap* di tengah, *Floating Sticky Bottom Console* di jangkauan jempol) dan gaya *Modern Ethereal Glassmorphism*.
