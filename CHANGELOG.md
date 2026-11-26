# Changelog Kasiry POS

Seluruh perubahan penting, peningkatan fitur, perbaikan bug, dan rilis versi **Kasiry (Habiba Store POS)** dicatat pada dokumen ini mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.0.0/) dan [Semantic Versioning](https://semver.org/).

> **Catatan Kompatibilitas Data:** Format JSON backup lokal/Google Drive tetap mempertahankan schema `version: '2.4'` agar file cadangan lama dan arsip tahunan tetap kompatibel lintas versi.

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
