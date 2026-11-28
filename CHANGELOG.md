# Changelog Kasiry POS

Seluruh perubahan penting, peningkatan fitur, perbaikan bug, dan rilis versi **Kasiry POS** dicatat pada dokumen ini mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.0.0/) dan [Semantic Versioning](https://semver.org/).

> **Catatan Kompatibilitas Data:** Format JSON backup lokal/Google Drive tetap mempertahankan schema `version: '2.4'` agar file cadangan lama dan arsip tahunan tetap kompatibel lintas versi.

---

## [2.20.7] - 2026-11-28 (Shortcut Keyboard Enter & Esc di Modal Pembayaran)

### Added
- **Dukungan `Enter` & `Esc` pada `PaymentModal.vue`:**
  - Setelah menekan `F2` dari kasa, kasir dapat langsung menekan **`Enter`** untuk menyelesaikan pembayaran uang pas / QRIS / Utang (otomatis fokus ke tombol konfirmasi dan tetap aman saat sub-form Tambah Pelanggan atau dropdown pencarian pelanggan sedang aktif).
  - Menekan **`Esc`** secara bertahap menutup form *Tambah Pelanggan Baru* / dropdown pelanggan terlebih dahulu sebelum menutup modal Pembayaran, dilengkapi petunjuk tombol `Esc` & `Enter` di desktop.

---

## [2.20.6] - 2026-11-28 (Navigasi Keyboard Panah Atas/Bawah di Pencarian Barang Kasa)

### Added
- **Navigasi Keyboard `ArrowDown` / `ArrowUp` / `Enter` di `BarcodeInputBar.vue`:**
  - Daftar hasil pencarian barang kini mendukung navigasi tombol panah **`↓`** / **`↑`** (termasuk wrap-around & auto-scroll `scrollIntoView({ block: 'nearest' })`), highlight visual baris aktif yang sinkron dengan hover mouse, atribut aksesibilitas ARIA (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-activedescendant`), serta tombol **`Enter`** untuk langsung memasukkan barang yang sedang disorot ke keranjang.

---

## [2.20.5] - 2026-11-28 (1 Spreadsheet Tunggal & Format Header Rapi di Google Sheets)

### Changed
- **1 Spreadsheet Tunggal Lintas Nama Toko & Perangkat (`src/composables/useGoogleSync.js`):**
  - `ensureSpreadsheet()` kini mencari spreadsheet yang diawali `Kasiry - Buku Kas` (terbaru) terlebih dahulu dan langsung me-rename judul file di Google Drive bila nama toko berubah, sehingga tidak membuat file spreadsheet ganda setiap ganti nama toko atau pindah perangkat.
- **Format Header & Tata Letak Google Sheets Baru:**
  - Spreadsheet baru kini memakai **header beku (`frozenRowCount: 1`)**, latar **Midnight Deep Navy (`#0a193d`)** berteks putih tebal, label kolom yang lebih akurat (`Metode / Jenis`, `Pelanggan / Keterangan`, `Nominal (Rp)`, `Dibayar / Masuk (Rp)`, `Kembalian / Selisih (Rp)`, `Rincian Transaksi`), lebar kolom proporsional, serta zebra striping biru lembut (`bandedRanges`).

---

## [2.20.4] - 2026-11-28 (Auto-Reconnect Hot-Plug Printer USB & Serial)

### Added
- **Hot-Plug Auto-Reconnect WebUSB & Web Serial (`src/composables/useThermalPrinter.js`):**
  - Menambahkan event listener `connect` pada `navigator.usb` dan `navigator.serial` (disertai pencocokan identitas perangkat `vendorId`/`productId`/`serialNumber` dan retry enumerasi singkat 350ms) agar printer yang sebelumnya sudah pernah dihubungkan otomatis tersambung kembali saat kabel USB dilepas lalu dicolok ulang tanpa klik manual.
  - Menambahkan `autoReconnectPrinter()` otomatis sebelum cetak ESC/POS di `dispatchPrint()` apabila printer terlepas sementara sebelum tombol cetak ditekan, sekaligus tetap menghormati tombol **Putuskan** manual (`disconnectPrinter()` menghapus preferensi auto-connect).

---

## [2.20.3] - 2026-11-28 (Perapihan Header Identitas Toko, Status Dot & Shift TopBar)

### Changed
- **Penyederhanaan Lockup Identitas `TopBar.vue` (Opsi A):**
  - Menghilangkan pengulangan label `KASIRY` dan pil teks `Cloud Aktif / Online / Offline` dari baris atas TopBar agar header utama hanya menampilkan 2 baris bersih: **Nama Toko** (`<h1>`) dan **Tanggal + Chip Shift**.
  - Status koneksi & sinkronisasi Google Cloud tetap ditunjukkan melalui **dot indikator di pojok Avatar** lengkap dengan tooltip hover, serta ditampilkan dalam bentuk pil teks pada header **Mobile Drawer**.

---

## [2.20.2] - 2026-11-28 (Penyelarasan Branding, Dynamic Browser Title, Footer & OG Meta)

### Changed
- **Dynamic Browser Tab `<title>` & Helper Branding (`src/utils/branding.js`, `src/App.vue`):**
  - Menambahkan watcher dinamis di `App.vue` agar judul tab peramban otomatis menampilkan `<Nama Toko> — Kasiry by Awanbeo` saat pemilik mengatur nama toko kustom, serta default `Kasiry by Awanbeo — Kasir Warung, Konter & Keuangan UMKM`.
- **Footer Terpadu & Penghapusan Sisa Inisial `'HS'` (`src/App.vue`, `src/components/TopBar.vue`):**
  - Mengganti inisial avatar fallback `'HS'` (sisa brand lama) menjadi `'KS'` lewat helper `getStoreInitials`.
  - Membuka tampilan footer di viewport Tablet (`md+` / `hidden md:flex`) agar tautan **Kebijakan Privasi**, **Ketentuan Layanan**, brand **Kasiry by Awanbeo**, dan badge versi `v2.20.2` dapat diakses di Mobile Drawer, Tablet, maupun Desktop secara seragam.
- **OG Meta, Gambar Preview (`public/og-image.png`), PWA Manifest & Halaman Legal:**
  - Memperbarui desain & isi visual `public/og-image.png` (`1200x630`) untuk mencantumkan `Kasiry by Awanbeo`, `kasiry.awanbeo.my.id`, layanan konter (Pulsa/Token PLN & Tarik Tunai/Transfer), dan Manajemen Keuangan 5 Kantong.
  - Menyelaraskan `<title>`, `meta description`, tag `og:*`, `twitter:*` (plus `twitter:image:alt`), JSON-LD `WebApplication` (`offers` & `featureList`) di `index.html`, PWA manifest di `vite.config.js`, serta meta OG + tanggal pembaruan di `public/privacy.html`, `public/terms.html`, dan `public/sitemap.xml`.

---

## [2.20.1] - 2026-11-28 (Konsolidasi Dropdown Keuangan TopBar)

### Changed
- **Reorganisasi Navigasi TopBar (`src/components/TopBar.vue`):**
  - Menyatukan **Manajemen Keuangan & Tabungan**, **Buku Utang**, dan **Kas Keluar** ke dalam satu dropdown **`Keuangan ▾`** (dengan lencana gabungan jumlah bon & kas keluar hari ini).
  - Merampingkan dropdown **`Layanan ▾`** khusus untuk layanan konter (**Pulsa & Token PLN** dan **Tarik Tunai & Transfer**) sehingga TopBar Desktop/Tablet lebih lega (**`Stok & Data ▾`** | **`Layanan ▾`** | **`Keuangan ▾`** | **`Laporan`** | **`⚙️`**).
  - Menyelaraskan pengelompokan Mobile Drawer menjadi **`Shift & Layanan Konter`** dan **`Keuangan & Laporan`** (memindahkan `Kas Keluar` ke grup keuangan).

---

## [2.20.0] - 2026-11-27 (Audit & Penyempurnaan Menyeluruh: Kantong Pihak Ketiga, Akuntansi >90 Hari & Sinkronisasi Antar Modal)

### Added
- **Kantong ke-5 `Saldo Pihak Ketiga` (`FinanceModal.vue`, `DigitalProductModal.vue`, `financeEngine.js`, `excelExport.js`):**
  - Menambahkan kantong khusus **`Saldo Pihak Ketiga`** (`PIHAK_KETIGA`, kompatibel mundur dengan `SALDO_AGEN`) sebagai sumber modal transaksi Pulsa, Paket Data, & Token Listrik PLN, lengkap dengan shortcut **`+ Isi Saldo`** (`MUTASI` ke `PIHAK_KETIGA`) dan opsi pilihan sumber modal per transaksi (**Saldo Pihak Ketiga**, **Rekening/QRIS**, **Uang Kas**, atau **Dana Luar**).
- **Perhitungan Saldo Kumulatif Lintas >90 Hari + Arsip Snapshot (`useKasiryDB.js`, `financeEngine.js`):**
  - Saldo **`Uang Kas`**, **`Rekening & QRIS`**, **`Tabungan`**, dan **`Saldo Pihak Ketiga`** kini dihitung lintas seluruh riwayat aktif IndexedDB (`cumulativePocketBalances`) agar tidak menyusut setelah melewati jendela RAM 90 hari.
  - `archiveOldTransactions()` kini menyimpan snapshot **`financeBaseline`** di `db.settings` sebelum memangkas catatan lama.
- **Integrasi `Uang Kas Toko` di Kas Keluar & Kulakan + Setoran Tutup Shift (`ExpenseModal.vue`, `RestockModal.vue`, `ShiftModal.vue`):**
  - Penambahan sumber dana **`Uang Kas Toko`** (`KAS`) di Kas Keluar & Kulakan, serta opsi **Sekalian setor sisa uang laci ke Uang Kas Toko** (mengatur modal laci besok otomatis ke `lastOpeningCash`) saat Tutup Buku Shift.
- **Cetak Ulang Struk, Void Transaksi 2-Tap, & Bon Pulsa di Buku Utang (`DailyReportModal.vue`, `DebtBookModal.vue`, `CustomerManagementModal.vue`, `useGoogleSync.js`):**
  - Daftar *Riwayat Transaksi* di `DailyReportModal.vue` kini mendukung **`Cetak Struk`** dan **`Batalkan` -> `Ya, Void`** (`deleteTransaction` dengan rollback atomik stok & piutang pelanggan).
  - Rincian bon & riwayat pelanggan di `DebtBookModal` & `CustomerManagementModal` kini ikut menampilkan bon Pulsa / Token PLN (`digitalProducts`).
  - Penambahan audit trail `appendCancellationToSheet` ke Google Sheets saat pembatalan/hapus/edit Token PLN, plus tag `Laci Kasir` vs `Uang Kas` pada Tarik Tunai/Transfer.

### Changed & Fixed
- **Penyelesaian Tumpang Tindih:** Menyeragamkan tampilan **Sisa Tunai Laci** (memasukkan `openingCash` & mutasi laci) di `ExpenseModal.vue` & `RestockModal.vue`, mengubah label kategori `prive` menjadi **`Ambil Kas Laci`**, memperbaiki kondisi tampilan `Sisa Laci` di `DailyReportModal` & pesan WA saat ada mutasi dana laci, serta menampilkan info saldo `Rekening & QRIS` saat Transfer/Top-Up di `CashServiceModal.vue`.

---

## [2.19.0] - 2026-11-27 (Backlog Fase 2 #4: Modul Manajemen Keuangan, 4 Kantong Dana & Tabungan)

### Added
- **Modul Manajemen Keuangan & Tabungan Terpadu (`src/components/FinanceModal.vue`, `src/utils/financeEngine.js`, `src/db/index.js` schema `v8`):**
  - Menambahkan tabel IndexedDB **`fundMovements`** (`++id, movementNumber, createdAt, type, fromAccount, toAccount, shiftId, updatedAt, deleted`) dengan migrasi otomatis `v1 -> v8` tanpa menghapus data lama.
  - Mesin perhitungan 4 kantong keuangan (`computeFinanceBalances` & `computePeriodFinanceSummary`): **Uang Laci Kasir (`LACI`)**, **Uang Kas Toko (`KAS`)**, **Rekening & QRIS (`REKENING`)**, dan **Tabungan Toko (`TABUNGAN`)**, beserta **Total Kas Likuid**, **Total Piutang Pelanggan**, dan **Total Kekayaan Bersih**.
  - Modal 3 tab terpisah (**`Ringkasan Saldo`**, **`Tabungan & Mutasi`**, **`Riwayat`**) dengan pemilih rentang waktu **`Shift Ini / Hari Ini`**, **`7 Hari`**, & **`30 Hari`**, form **`+ Tambah Tabungan`**, **Pindah Kantong**, **Setor Modal**, & **Ambil Dana**, penjagaan anti-minus saldo sumber (kecuali sumber `LUAR`), serta hapus aman 2-tap.
  - **Pemisahan Laporan Harian vs Manajemen Keuangan:** Ringkasan keuangan & kekayaan berada terpisah pada tombol **`Keuangan`** di `TopBar.vue` (serta `Manajemen Keuangan & Tabungan` di Mobile Drawer) tanpa mencemari UI `DailyReportModal.vue` & `ShiftModal.vue` — sembari tetap merekonsiliasi perpindahan fisik uang masuk/keluar `LACI` (`todayFundToLaci`, `todayFundFromLaci`) ke hitung laci shift di `dailyStats.js`.
- **Pilihan Sumber Tunai `Laci Kasir` vs `Uang Kas` di Tarik Tunai & Transfer (`CashServiceModal.vue`, `useKasiryDB.js`, `App.vue`):**
  - Kasir kini dapat memilih apakah uang fisik Tarik Tunai/Transfer diambil atau disimpan ke **`Laci Kasir`** atau **`Uang Kas Toko`** lengkap dengan guard saldo masing-masing kantong.
- **Excel 10-Sheet & Google Cloud Sync (`excelExport.js`, `useGoogleSync.js`, `useKasiryDB.js`):**
  - Menambahkan ringkasan posisi saldo 4 kantong di Sheet 1 (`Ringkasan Kas`) serta Sheet ke-10 **`Mutasi Kas & Tabungan`**.
  - Menambahkan `appendFundMovementToSheet`, two-way LWW merge #11 (`fundMovements`) di `syncWithCloud`, JSON Backup/Restore (`merge` & `replace`), Arsip Tahunan, & Reset Toko.

---

## [2.18.0] - 2026-11-27 (Backlog Fase 2 #3: Pembayaran Kurang / Sebagian Otomatis Masuk Buku Utang)

### Added
- **Bayar Kurang / Sebagian Masuk Buku Utang (`PaymentModal.vue`, `useKasiryDB.js`, `dailyStats.js`, `App.vue`):**
  - Pada mode pembayaran **Tunai** dan **QRIS** (toggle **`Bayar Sebagian?`**), kasir kini dapat memproses pembayaran yang nominalnya lebih kecil dari `totalAmount` (`0 < paidAmount < totalAmount`).
  - **Proteksi Akun `"Umum"`:** Baik di UI `PaymentModal.vue` maupun di `recordTransaction()`, transaksi kurang bayar otomatis memblokir `"Umum"` dan mewajibkan pemilihan/pendaftaran pelanggan terlebih dahulu.
  - Menyimpan `paidAmount` & `debtAmount` dengan label **`TUNAI (SEBAGIAN BON)`** atau **`QRIS (SEBAGIAN BON)`**, mengakumulasikan sisa kekurangan ke `customers.totalDebt` secara atomik, serta memisahkan pencatatan uang masuk kas (hanya sebesar yang dibayar) dengan Bon Baru (sebesar kekurangannya) di `computeDailyStats` & Shift Closing.
- **Struk, Buku Utang, Laporan, Excel & Google Sync (`thermalPrinter.js`, `ReceiptModal.vue`, `DebtBookModal.vue`, `DailyReportModal.vue`, `CustomerManagementModal.vue`, `excelExport.js`, `useGoogleSync.js`):**
  - Struk thermal ESC/POS (`58mm`/`80mm`), browser Iframe, preview `ReceiptModal.vue`, & pesan WhatsApp menampilkan rincian **Dibayar**, **Masuk Buku Utang**, dan status **`BAYAR SEBAGIAN (BON)`**.
  - `DebtBookModal.vue` menampilkan transaksi sebagian bon di daftar *Rincian Bon Belanja Terakhir*, sementara Sheet `Daftar Transaksi` Excel dan Google Sheets mencatat nominal bayar bersih beserta keterangan `[Sisa Masuk Bon]`.

---

## [2.17.0] - 2026-11-27 (Backlog Fase 2 #2: Penjualan Pulsa, Paket Data, Token Listrik PLN & Reorganisasi Menu TopBar)

### Added
- **Modal Penjualan Pulsa, Paket Data & Token Listrik (`src/components/DigitalProductModal.vue`, `src/db/index.js` schema `v7`):**
  - Menambahkan tabel IndexedDB **`digitalProducts`** (`++id, digitalNumber, createdAt, category, paymentMethod, customerId, shiftId, updatedAt, deleted`) dengan migrasi otomatis `v1 -> v7`.
  - Mendukung kategori **Pulsa**, **Paket Data**, **Token PLN**, & **Lainnya / PPOB**, pilihan operator cepat (`Telkomsel`, `Indosat`, `XL`, `Axis`, `Tri`, `Smartfren`, `by.U`, `PLN`), preset nominal yang otomatis **mengingat harga modal agen & harga jual** (`kasiry_digital_presets_v1` di `localStorage`), input **No. HP / ID PLN** serta **Nomor Token Stroom (20 Digit) / SN** (bisa diisi langsung maupun diedit ulang di tab Riwayat), plus rollback piutang atomik saat hapus 2-tap.
  - Mendukung pembayaran pembeli **Tunai** (masuk Laci), **QRIS** (masuk Non-Tunai), dan **Utang / Bon** (masuk Buku Utang pelanggan & blokir akun `"Umum"`), sedangkan harga modal dicatat dengan `costSource: 'SALDO_AGEN'` tanpa memotong fisik Laci Tunai.
- **Cetak Nota & Kirim WhatsApp Token PLN (`thermalPrinter.js`, `ReceiptModal.vue`):**
  - Menampilkan **No. Tujuan / ID PLN** dan kotak sorotan **Token / SN** pada preview struk, printer ESC/POS (`58mm`/`80mm`), cetak `iframe` browser, dan pesan WhatsApp (auto-isi nomor WA pembeli bila nomor HP valid).
- **Excel 9-Sheet, Laporan, Shift & Cloud Sync (`dailyStats.js`, `excelExport.js`, `useGoogleSync.js`):**
  - Rekap omzet & laba Pulsa/Token ke `computeDailyStats`, `ShiftModal.vue`, `DailyReportModal.vue`, teks WA, Google Sheets (`appendDigitalProductToSheet`), Google Drive LWW merge, JSON Backup/Arsip, dan sheet ke-9 **`Pulsa & Token Listrik`** di Excel.

### Changed
- **Reorganisasi Navigasi TopBar & Mobile Drawer (`src/components/TopBar.vue`):**
  - Desktop/Tablet TopBar kini jauh lebih ringkas dan siap menampung modul berikutnya: **`Stok & Data ▾`** (`Kelola Barang`, `Kulakan Stok`, `Data Pelanggan`) | **`Layanan ▾`** (`Pulsa & Token PLN`, `Tarik Tunai & Transfer`, `Kas Keluar`) | **`Buku Utang`** | **`Laporan`** | **`⚙️`**.
  - Mobile Drawer ditata menjadi 4 kelompok 1-tap rapi: **Layanan Konter & Kas**, **Keuangan & Laporan**, **Stok & Pelanggan**, dan **Sistem**.

---

## [2.16.0] - 2026-11-27 (Backlog Fase 2 #1: Fitur Tarik Tunai & Transfer / Top-Up)

### Added
- **Layanan Tarik Tunai & Transfer / Top-Up (`src/components/CashServiceModal.vue`, `src/db/index.js` schema `v6`):**
  - Menambahkan tabel IndexedDB **`cashServices`** (`++id, serviceNumber, createdAt, type, cashSource, shiftId, updatedAt, deleted`) dengan migrasi otomatis `v1 -> v6`.
  - Modal terdedikasi `CashServiceModal.vue` (`Tarik Tunai` vs `Transfer / Top-Up` dengan tab `Catat Layanan` & `Riwayat`), preset nominal `50rb`–`1jt`, preset biaya admin `Rp 0`–`10rb`, pilihan channel (`QRIS`, `BRI`, `BCA`, `Mandiri`, `BNI`, `DANA`, `GoPay`, `ShopeePay`, `Lainnya`), nama pelanggan, catatan, serta ringkasan **Cara A** (`Total Dibayar = Nominal Pokok + Biaya Admin`).
  - **Hard Guard Saldo Laci:** Untuk `TARIK_TUNAI` (`cashSource: 'LACI'`), memblokir transaksi di UI & `recordCashService` apabila nominal pokok melebihi uang tunai yang tersedia di laci (`availableDrawerCash <= 0` atau `amount > availableDrawerCash`).
- **Navigasi & Struk Thermal (`TopBar.vue`, `thermalPrinter.js`, `ReceiptModal.vue`):**
  - Menambahkan tombol 1-klik **`Tarik & Tf`** di TopBar Desktop dan menu **`Tarik Tunai & Transfer`** di grup **Keuangan & Kasir** Mobile Drawer lengkap dengan badge jumlah transaksi periode berjalan.
  - Memperbarui encoder ESC/POS, HTML print `iframe`, preview `ReceiptModal.vue`, & format share WhatsApp agar nota `TARIK TUNAI` & `TRANSFER / TOP-UP` tercetak lengkap (`SELESAI (TARIK TUNAI)` / `SELESAI (TRANSFER)`) tanpa salah jatuh ke status Buku Utang.
- **Rekonsiliasi Keuangan, Shift, Laporan, Excel 8-Sheet & Google Sync (`dailyStats.js`, `useKasiryDB.js`, `useGoogleSync.js`, `excelExport.js`, `DailyReportModal.vue`, `ShiftModal.vue`):**
  - Mengintegrasikan `cashServices` ke `aggregateRecords`, `computeDailyStats`, `computeShiftClosingPreview`, dan `formatShiftWhatsAppText`:
    - `TARIK_TUNAI`: Laci `-amount`, Non-Tunai/QRIS `+(amount + adminFee)`, Untung Jasa Admin `+adminFee`.
    - `TRANSFER`: Laci `+(amount + adminFee)`, Non-Tunai/QRIS `-amount`, Untung Jasa Admin `+adminFee`.
  - Menambahkan sheet ke-8 **`Tarik Tunai & Transfer`** + indikator Tarik Tunai/Transfer & Jasa Admin di Sheet 1 (`Ringkasan Kas`) `excelExport.js`, serta dukungan `openShift` adopsi otomatis, `closeShift`, `appendCashServiceToSheet`, two-way merge Google Drive, JSON Backup/Restore, & Arsip Tahunan.

---

## [2.15.5] - 2026-11-27 (Modul 1 UI Polish: Perluasan Grid Terlaris Desktop ke 24 Produk & Ranking Dinamis)

### Changed
- **Grid Terlaris Desktop Lebih Padat & Ranking Dinamis (`src/composables/useKasiryDB.js`, `src/db/seedData.js`, `src/components/FrequentProductsSection.vue`):**
  - Meningkatkan kapasitas `frequentProducts` dari `8` menjadi hingga **`24` produk** (`FREQUENT_PRODUCTS_LIMIT = 24`) dan menandai 24 barang populer harian lintas 9 kategori di `seedData.js` agar tampilan Bento Workstation desktop terisi penuh tanpa area kosong.
  - Menambahkan perangkingan cerdas memakai `buildProductUsageMap`: produk yang benar-benar laku terjual otomatis naik ke posisi teratas, disusul produk yang sudah berharga (`sellPrice > 0`), item cepat (`isMacro`), lalu urutan katalog.
  - Pada tampilan mobile (`< 768px`), item ke-9 s/d ke-24 disembunyikan dengan `hidden md:flex` agar jangkauan jempol HP tetap ringkas dengan tautan `Lihat Semua`, sekaligus menampilkan counter `Terlaris (24)` di tab Desktop.

---

## [2.15.4] - 2026-11-27 (OAuth Non-Sensitive Scope: drive.file Saja Tanpa Scope Sensitif Spreadsheets)

### Changed
- **Hapus Scope Sensitif Google Sheets (`src/composables/useGoogleSync.js`, `public/privacy.html`):**
  - Menghapus `https://www.googleapis.com/auth/spreadsheets` dari `SCOPES` sehingga Kasiry kini hanya meminta izin **Non-Sensitive** (`drive.file`, `userinfo.profile`, `userinfo.email`). Karena file `Kasiry - Buku Kas ...` dibuat langsung oleh aplikasi ini via API, akses tulis ke Sheets API tetap berjalan penuh menggunakan `drive.file` tanpa perlu review scope sensitif Google.
  - Menambahkan auto-recovery di `appendRowsBatch` saat menemui respons `403`/`404` pada `linkedSheetId` usang agar otomatis mereset ID sheet dan membuat ulang Buku Kas milik `drive.file`.
  - Memperbarui penjelasan izin di `public/privacy.html` agar 100% sesuai scope `drive.file` non-sensitif.

---

## [2.15.3] - 2026-11-27 (Migrasi Custom Domain kasiry.awanbeo.my.id & Kepatuhan OAuth Branding)

### Changed
- **Custom Domain `https://kasiry.awanbeo.my.id` & Kepatuhan Google Auth Platform:**
  - Mengubah canonical, Open Graph, Twitter Card, JSON-LD Schema, `public/sitemap.xml`, dan `public/robots.txt` dari `kasiry.pages.dev` menjadi **`https://kasiry.awanbeo.my.id`**.
  - Mengarahkan seluruh tautan Kebijakan Privasi & Ketentuan Layanan (`index.html`, `src/App.vue`, `src/components/TopBar.vue`, `public/privacy.html`, `public/terms.html`, `sitemap.xml`) ke rute bersih **`/privacy`** dan **`/terms`** (`HTTP 200 OK` langsung tanpa redirect `308` `.html` Cloudflare Pages), serta menyelaraskan judul/nama produk di manifest PWA dan halaman kepatuhan menjadi **`Kasiry by Awanbeo`** sesuai Google Auth Platform Branding.

---

## [2.15.2] - 2026-11-27 (Konsistensi Branding Kasiry by Awanbeo, Tautan Portofolio & Auto-Refresh SW)

### Changed
- **Konsistensi Branding `Kasiry by Awanbeo` & SEO Portofolio (`index.html`, `src/App.vue`, `src/components/ReceiptModal.vue`, `src/components/DailyReportModal.vue`, `src/utils/dailyStats.js`, `src/utils/thermalPrinter.js`):**
  - Menghilangkan sisa label `'TES CETAK KASIRY POS'` menjadi `'TES CETAK KASIRY'` serta menyatukan footer **`Kasiry by Awanbeo`** ke pesan WhatsApp nota (`shareToWhatsApp`), rekap harian/tutup shift WA, dan footer desktop (`https://awanbeo.my.id`).
  - Memperbarui `<title>`, meta `author`, JSON-LD Schema (`Kasiry by Awanbeo` -> `https://awanbeo.my.id`) pada `index.html`.
- **Auto-Refresh Service Worker PWA (`src/main.js`):**
  - Menambahkan listener `controllerchange` pada `navigator.serviceWorker` (hanya saat sebelumnya sudah ada SW aktif) agar tab/PWA pengguna tidak terjebak di cache versi lama setelah deploy baru.

---

## [2.15.1] - 2026-11-27 (Branding Keterangan Bawah Struk: Kasiry by Awanbeo)

### Changed
- **Branding Footer Struk & Tes Cetak (`src/utils/thermalPrinter.js`, `src/components/ReceiptModal.vue`):**
  - Menstandarkan teks keterangan paling bawah pada preview struk, cetak termal ESC/POS (`Bluetooth`/`USB`/`Serial`), cetak HTML `iframe`, maupun tes cetak melalui satu konstanta `RECEIPT_BRAND_FOOTER` menjadi **`Kasiry by Awanbeo`** (sekaligus memperbarui teks tes cetak menjadi `'Printer Thermal Terhubung OK!'` agar akurat untuk koneksi Bluetooth maupun USB/Serial).

---

## [2.15.0] - 2026-11-27 (Dukungan Printer Thermal USB/OTG & Serial COM + Cetak Iframe Terisolasi)

### Added & Improved
- **Dukungan Multi-Transport ESC/POS (`src/composables/useThermalPrinter.js`):**
  - Menambahkan jalur koneksi **`WebUSB` (`navigator.usb`)** untuk printer kabel USB di **HP/Tablet Android (USB OTG)** maupun Desktop (pemilihan otomatis endpoint OUT bulk `interfaceClass === 7` / fallback, deteksi cabut kabel `disconnect`, pemetaan pesan error ramah saat port USB dikunci driver Windows Print Spooler agar pengguna tahu opsi **WinUSB via Zadig** vs **driver POS-58 + Cetak Browser**), serta jalur **`Web Serial` (`navigator.serial`)** lengkap dengan pilihan **Baud Rate** (`9600`–`115200`) untuk printer Port COM / Bluetooth Classic SPP.
  - Menambahkan **`autoReconnectPrinter()`** di `onMounted` [App.vue](file:///d:/web/kasiryy/src/App.vue) untuk menyambungkan ulang printer USB/Serial yang sudah diizinkan secara otomatis tanpa popup ulang.
- **Cetak Browser Iframe Terisolasi (`src/utils/thermalPrinter.js`, `src/components/ReceiptModal.vue`, `src/composables/useThermalPrinter.js`):**
  - Menambahkan `buildReceiptPrintHtml` dan `buildTestPrintHtml` agar jalur fallback **Cetak Browser** mencetak melalui hidden `<iframe>` murni dengan aturan `@page { size: 58mm|80mm auto; margin: 0; }`, bersih dari bentrok CSS `backdrop-blur` maupun `overflow-hidden` modal utama (termasuk pada **Tes Cetak Printer** non-Bluetooth).
- **Pembaruan UI Pengaturan & Modal Struk (`src/components/SettingsModal.vue`, `src/components/ReceiptModal.vue`):**
  - Tab **`Printer`** di `SettingsModal.vue` kini menampilkan tombol **`Hubungkan Bluetooth`**, **`Hubungkan USB / OTG`**, **`Port Serial / COM`**, pemilih Baud Rate Serial, dan **Panduan Cepat Kabel USB** (Android OTG vs Laptop Windows).
  - `ReceiptModal.vue` mendukung badge/tombol dinamis **`Cetak BT`**, **`Cetak USB`**, **`Cetak COM`**, dan pintasan cepat **`BT`** / **`USB`**.
- **Cakupan Test (`tests/thermalPrinter.test.js`, `tests/uiModals.test.js`):**
  - Menambah skenario unit/integration untuk `buildReceiptPrintHtml`, `buildTestPrintHtml`, pairing & print **WebUSB** (+ `autoReconnectPrinter` & simulasi blokir Windows `SecurityError`), dan **Web Serial** (**10 file / 42 skenario lulus**).

---

## [2.14.0] - 2026-11-27 (Roadmap #7: Koneksi Printer Thermal Bluetooth ESC/POS + Hotfix Edit Harga Keranjang)

### Added
- **Encoder ESC/POS Murni & Composable Web Bluetooth (`src/utils/thermalPrinter.js`, `src/composables/useThermalPrinter.js`):**
  - Menyusun payload ESC/POS native secara ringan tanpa pustaka eksternal (`CMD_INIT`, bold, double-height header, pembungkusan teks rapi `formatWrapText`, rata kiri-kanan `formatTwoColumnLine`, serta sanitasi karakter ASCII `sanitizeEscPosText`) untuk ukuran kertas **`58mm` (32 kolom)** dan **`80mm` (48 kolom)**.
  - Mendukung koneksi langsung **Web Bluetooth GATT** ke berbagai UUID layanan printer thermal, pemecahan paket BLE `splitIntoBleChunks` (default 80 byte dengan fallback otomatis ke 20 byte untuk printer MTU kecil), putus/sambung perangkat, serta fallback otomatis ke dialog cetak browser (`window.print()`) bila Bluetooth belum tersambung atau tidak didukung perangkat.
- **Tab Pengaturan `Printer` & Auto-Print Checkout (`src/components/SettingsModal.vue`, `src/components/ReceiptModal.vue`, `src/App.vue`):**
  - Menambahkan tab baru **`Printer`** di `SettingsModal.vue` berisi tombol **`Hubungkan Printer Bluetooth`** / **`Putus Koneksi Printer`**, pemilihan lebar kertas **`58mm (32 Kolom)`** vs **`80mm (48 Kolom)`**, toggle **`Cetak Otomatis Setelah Bayar`** (`autoPrint`), input **`Catatan Bawah Struk`** (`footerText`), serta tombol **`Tes Cetak Printer`** (`printTestThermal`).
  - Memperbarui `ReceiptModal.vue` dengan tombol cepat **`Cetak BT`** / **`Cetak`** sesuai status koneksi plus tombol fallback **`Browser`**, pratinjau cetak `.thermal-80mm` vs `58mm`, tampilan `footerText` kustom, dan penyembunyian baris **`WA:`** saat nomor telepon toko kosong.
  - Mengintegrasikan helper `openReceiptModal` di `src/App.vue` (untuk `finalizeDirectSale` maupun `handleProcessDebtPayment`) agar opsi `autoPrint` langsung mengeksekusi cetak struk secara otomatis seusai transaksi.
- **Cakupan Automated Test (`tests/thermalPrinter.test.js`, `tests/pricing.test.js`, `tests/uiModals.test.js`):**
  - Menambahkan suite khusus `tests/thermalPrinter.test.js` (5 skenario) untuk memverifikasi encoding ESC/POS `58mm`/`80mm`, persistensi pengaturan `localStorage`, koneksi GATT Bluetooth mock, retry chunk MTU 20-byte, dan fallback `window.print()`, plus memperluas skenario `uiModals.test.js` dan `pricing.test.js` (**10 file / 40 test lulus**).

### Fixed
- **Harga Ecer di Keranjang Terlihat Tertimpa Saat Simpan Harga Grosir/Agen (`src/App.vue`):**
  - Memperbaiki perilaku di handler pembaruan harga keranjang di mana menyimpan harga baru ke katalog (**`Jadi Grosir`** / **`Jadi Agen`**) saat mode nota aktif masih **`Ecer`** ikut mengunci item keranjang ke tier yang disimpan; kini item disetel ulang ke `'auto'` (`nextMode = saveToCatalogTier !== 'none' ? 'auto' : priceMode`) sehingga item tetap pada tarif **`Ecer`** hingga kasir benar-benar memindah `Harga Nota` atau memilih pelanggan berlevel.

---

## [2.13.1] - 2026-11-27 (Hotfix Live Update Pilihan Harga Ecer/Grosir/Agen di Keranjang)

### Fixed
- **Sinkronisasi Langsung Pilihan Harga di Keranjang (`src/utils/pricing.js`, `src/App.vue`, `src/components/CartSection.vue`):**
  - Memperbaiki bug di mana setelah menyimpan harga baru per item (`Jadi Ecer`, `Jadi Grosir`, atau `Jadi Agen`) di editor keranjang, pergantian tombol **`Harga Nota: Ecer | Grosir | Agen`** atau pemilihan pelanggan berlevel tidak langsung memperbarui harga sebelum mengosongkan keranjang (`priceMode` sebelumnya tertinggal terkunci di tier lama).
  - Menambahkan helper `repriceCartItems` agar setiap perubahan `Harga Nota` atau pelanggan otomatis menyinkronkan harga terbaru katalog dan mengembalikan item bertier katalog ke mode `'auto'` secara *real-time* (sambil tetap melindungi harga nego `'manual'`), sekaligus menonaktifkan tombol tier `Ecer (Kosong)` saat tarif dasar belum diatur.

---

## [2.13.0] - 2026-11-27 (Roadmap #6: Pembersihan Data Awal, 300 Katalog Warung, Harga Cepat, Reset Toko & Barang Tidak Terjual)

### Added & Changed
- **300 Katalog Barang Populer Warung Indonesia (`src/db/seedData.js`, `src/db/index.js`):**
  - Mengembangkan daftar barang bawaan dari 38 menjadi **300 produk warung terlaris** across 9 kategori (`Curah`, `Sembako`, `Makanan`, `Minuman`, `Jajanan & Kopi`, `Bumbu Dapur`, `Kebersihan`, `Rokok`, `Obat & Lainnya`) dengan `sellPrice: 0`, `buyPrice: 0`, dan `barcode: ''` agar pemilik toko cukup mengisi harga masing-masing dan mengikat barcode saat dibutuhkan.
  - `initDatabase()` memuat `./seedData` secara dinamis (`await import('./seedData')`) hanya saat IndexedDB masih kosong sehingga ukuran bundle awal tetap ringan.
- **Pembersihan Pelanggan Awal & Identitas Generik (`Warung Kasiry`):**
  - Menghapus seluruh contoh akun berutang demo dari `seedCustomers`; database awal kini bersih hanya berisi **1 akun `'Umum'`** dengan `totalDebt: 0`.
  - Menstandarkan seluruh profil/fallback default aplikasi menjadi **`Warung Kasiry`** (`owner: 'Pemilik Toko'`, nomor WA kosong) di `seedSettings`, `useKasiryDB.js`, `SettingsModal.vue`, `ShiftModal.vue`, `ReceiptModal.vue`, `TopBar.vue`, `CustomerManagementModal.vue`, `DebtBookModal.vue`, `DailyReportModal.vue`, `dailyStats.js`, dan `excelExport.js` (dengan mempertahankan fallback file backup Cloud lama agar cadangan pengguna lama tetap aman).
- **Manajemen Barang Tidak Terjual, Pengisian Harga Cepat & Hapus Massal (`src/utils/productUsage.js`, `src/components/ProductManagementModal.vue`):**
  - Menambahkan analitik penggunaan produk multi-tahun (`buildProductUsageMap` & `getAllProductUsageStats`) di `ProductManagementModal.vue` dengan filter status **`Semua`**, **`Belum Harga`**, **`Belum Terjual`**, dan **`Sepi ≥30 Hr`** untuk merapikan katalog starter maupun bahan acuan promo barang kurang laku.
  - Menyediakan **Input Harga Cepat Inline** (`Isi Harga` / tombol `Promo`) langsung per baris barang + **Pilih Banyak (`Pilih Semua` & `Hapus Terpilih`)** atomik via `deleteProductsBulk`, plus slice render (`60` per tahap) agar daftar 300 barang tetap ringan.
- **Alur Kasa Otomatis untuk Barang Belum Berharga & Reset Toko (`CartSection.vue`, `FrequentProductsSection.vue`, `BarcodeInputBar.vue`, `SettingsModal.vue`, `App.vue`):**
  - Menampilkan badge **`Atur Harga`** pada katalog/pencarian dan **`Isi Harga!`** di keranjang bagi produk bertarif `Rp 0`. Saat barang `Rp 0` ditambahkan ke keranjang (atau diklik bayar saat masih `Rp 0`), editor harga inline di `CartSection.vue` langsung terbuka otomatis dengan opsi default **Simpan Jadi Ecer**.
  - Menambahkan kontrol **Atur Ulang Katalog & Data Toko** di `SettingsModal.vue` (`Mulai Toko Kosong` 0 barang vs `Muat 300 Katalog Warung`) melalui `resetStoreData` di `useKasiryDB.js`.

---

## [2.12.0] - 2026-11-27 (Roadmap #5: Fitur Kulakan / Belanja Stok & Manajemen Stok Lunak)

### Added
- **Modal Kulakan & Riwayat Nota (`src/components/RestockModal.vue`):**
  - Mencatat nota belanja stok multi-item (`supplierName` opsional, `note` opsional) melalui 3 sumber dana: **Tunai Laci**, **Non-Tunai (QRIS / Rek)**, dan **Dana Luar (Pribadi Owner)**.
  - Pencarian barang cepat (memprioritaskan barang berstok tipis/habis), pengeditan kuantitas & harga beli baru, peringatan otomatis bila harga modal naik (+ opsi inline update harga jual langsung), serta centang per item **"Update Stok"** (default aktif).
  - Tab **Riwayat Kulakan** lengkap dengan hapus 2-tap untuk membatalkan nota beserta *rollback* aman stok, harga beli/jual, dan catatan kas keluar terkait.
- **Manajemen Stok Lunak & Non-Blocking (`src/composables/useKasiryDB.js`, `src/db/index.js`):**
  - Migrasi skema Dexie `v5` dengan tabel baru `restocks` (`++id, restockNumber, createdAt, source, supplierName, updatedAt, deleted`).
  - Kolom opsional `stock` (`null` = tidak dilacak; angka = dilacak lunak): berkurang otomatis secara atomik saat checkout (`recordTransaction`, dihentikan minimal `0`) dan bertambah saat kulakan (`recordRestock`), **namun barang berstok `0` tetap bebas dibeli di kasa**.
  - Saat kulakan dibayar dari **Tunai Laci** atau **QRIS / Rek**, sistem atomik membuat catatan kas keluar berkategori `'kulakan'` (`affectsProfit: false`) sehingga saldo laci/rekening Shift & Harian ikut terpotong tanpa membuat laba jualan terpotong ganda.
- **Navigasi, Lencana Stok, Excel 7-Sheet & Google Sync (`TopBar.vue`, `ProductManagementModal.vue`, `FrequentProductsSection.vue`, `excelExport.js`, `useGoogleSync.js`, `SettingsModal.vue`):**
  - Menambahkan pintasan **`Kulakan Stok`** di dropdown desktop **`Stok & Data ▾`** maupun Drawer mobile **Stok & Pelanggan**.
  - Input opsional **Stok Saat Ini** & lencana stok di `ProductManagementModal.vue`, serta lencana non-blokir `Habis` / `Sisa N` di kartu cepat `FrequentProductsSection.vue`.
  - Penambahan sheet ke-7 **`Riwayat Kulakan`** di `exportKasiryExcel`, `appendRestockToSheet` & two-way LWW merge `restocks` di `useGoogleSync.js`, serta pratinjau jumlah nota kulakan di `SettingsModal.vue`.

---

## [2.11.0] - 2026-11-27 (Roadmap #4: Multi Harga Ecer / Grosir / Agen & Edit Harga Manual)

### Added
- **Mesin Multi Harga (`src/utils/pricing.js`):**
  - Mendukung 3 tingkatan harga per produk (**Ecer** sebagai harga wajib/default, plus opsional **Harga Grosir**, **Min. Qty Grosir**, dan **Harga Agen**) dengan fallback aman berjenjang (`Agen -> Grosir -> Ecer`) agar barang tanpa tier grosir/agen tidak pernah terhitung `Rp 0`.
  - **Aturan Otomatis Qty:** Ketika mode nota `Ecer` aktif dan `qty >= wholesaleMinQty`, harga satuan item di keranjang otomatis beralih menjadi `Grosir (Auto)`.
- **Kontrol Harga Lengkap di Keranjang (`src/components/CartSection.vue` & `src/App.vue`):**
  - Saklar cepat **`Harga Nota: Ecer | Grosir | Agen`** pada header `Struk Belanjaan`.
  - **Editor Harga Inline Per Item:** Mengetuk harga satuan baris belanjaan membuka kontrol cepat untuk pindah tier khusus item tersebut (`Auto Nota`, `Ecer`, `Grosir`, `Agen`) **atau ketik harga manual/nego**, lengkap dengan opsi sekali pakai (*Nota ini saja*) maupun **simpan permanen** ke harga `Ecer` / `Grosir` / `Agen` di katalog barang.
- **Integrasi Produk, Lazy Inventory, Pelanggan, Pembayaran & Struk:**
  - `ProductManagementModal.vue` & `LazyInventoryModal.vue` menyediakan input opsional `Harga Grosir`, `Min. Qty Grosir`, dan `Harga Agen` (+ badge tier di daftar barang & kartu cepat `FrequentProductsSection.vue`).
  - `CustomerManagementModal.vue` menambahkan pilihan **Level Harga Default Pelanggan** (`Ecer`, `Grosir`, `Agen`), dan memilih pelanggan di `PaymentModal.vue` otomatis menyesuaikan mode harga keranjang & tagihan secara live (dengan proteksi akun `"Umum"` tetap `'ecer'`).
  - `useKasiryDB.js` (`recordTransaction`) menyimpan `baseSellPrice`, `priceTier`, dan `priceLabel`, sedangkan `ReceiptModal.vue` menampilkan label tier non-ecer (`Grosir` / `Agen` / `Khusus`) pada struk 58mm & pesan WhatsApp.

---

## [2.10.0] - 2026-11-27 (Roadmap #3: Sistem Buka & Tutup Shift / Tutup Buku Harian)

### Added
- **Modal Buka & Tutup Shift (`src/components/ShiftModal.vue`):**
  - Model 1 shift = 1 hari buka warung (jam buka & tutup fleksibel termasuk melewati tengah malam).
  - Prompt **Buka Shift** 1x saat pagi jika belum ada shift aktif (lengkap dengan tombol **Nanti Saja** agar tidak menghalangi pembeli), pengisian otomatis nama kasir (`storeProfile.owner`), auto-isi nominal modal awal laci terakhir + preset cepat (`Rp 0`–`500rb`), serta opsi **Sertakan catatan hari ini yang belum masuk shift** bila terlanjur melakukan transaksi sebelum klik Buka Shift.
  - Pengingat otomatis apabila shift dari **hari kemarin** masih berstatus terbuka agar segera ditutup buku sebelum omzet tercampur ke hari baru.
  - Layar **Tutup Shift & Buku Harian** dengan hitungan otomatis **`Seharusnya di Laci = Modal Awal + Penjualan Tunai + Pelunasan Bon Tunai - Kas Keluar Laci`** (QRIS dan Utang Baru dipisahkan), input uang fisik + tombol **Pas (Sesuai Sistem)**, live selisih (**Pas ✓**, **Lebih**, **Kurang**), catatan tutup buku, dan **Kirim Laporan Tutup Shift ke WhatsApp**.
- **Chip Status Shift di TopBar (`src/components/TopBar.vue`):** Indikator status shift aktif / kemarin / belum buka di sisi kiri bar desktop maupun mobile + akses langsung di Drawer **Keuangan & Kasir**.
- **Skema IndexedDB v4 (`src/db/index.js` & `src/composables/useKasiryDB.js`):** Penambahan tabel `shifts` (`++id, shiftCode, status, openedAt, closedAt, updatedAt, deleted`), penandaan `shiftId` & `shiftCode` pada transaksi, pelunasan utang, dan kas keluar, serta dukungan penuh backup/restore JSON dan arsip tahunan (tanpa menghapus shift yang masih terbuka).
- **Integrasi Lingkup Shift di Laporan, Excel 6 Sheet & Cloud Sync:**
  - `src/utils/dailyStats.js` (`computeDailyStats`, `computeShiftClosingPreview`, `formatShiftWhatsAppText`) kini otomatis menghitung angka dalam lingkup Shift Aktif ketika shift berjalan.
  - `DailyReportModal.vue` menambahkan banner status Shift Aktif + tab ke-4 **`Shift`** (riwayat tutup buku lengkap + tombol Kirim WA per shift); `ExpenseModal.vue` menyelaraskan filter pengeluarannya ke shift aktif.
  - `src/utils/excelExport.js` menambahkan baris modal awal & kas seharusnya di **Ringkasan Kas** serta sheet ke-6 **`Riwayat Shift`**.
  - `src/composables/useGoogleSync.js` menambahkan `appendShiftEventToSheet` (`BUKA SHIFT` / `TUTUP SHIFT`) beserta *two-way LWW merge* untuk tabel `shifts`.

---

## [2.9.1] - 2026-11-27 (Hotfix Layering Dropdown TopBar & Badge Kuantitas Barang Cepat)

### Fixed
- **Menu Dropdown `Stok & Data` Tertutup Card Pencarian (`src/components/TopBar.vue` & `src/App.vue`):** Menambahkan `relative z-40` pada `<header>` `TopBar` dan `relative z-10` pada `<main>` agar dropdown menu selalu berada di atas stacking context `backdrop-blur-md` dari panel katalog/pencarian produk, sambil tetap berada di bawah modal overlay (`z-50`).
- **Badge Jumlah (`1×`, `2×`) Terpotong di Baris Paling Atas (`src/components/FrequentProductsSection.vue`):** Memindahkan badge kuantitas aktif dari `-top-1.5 -right-1.5` ke dalam batas aman sudut kanan atas kartu (`top-1.5 right-1.5` dengan clearance teks `pr-8`), menambahkan `pt-1 md:pr-1 pb-1` pada scroll pane, serta memberi `relative z-20` pada wrapper `#search` inline agar dropdown hasil pencarian tampil rapi di atas grid kartu.

---

## [2.9.0] - 2026-11-27 (Roadmap #2: Pengeluaran Harian & Reorganisasi Menu Kompak)

### Added
- **Catatan Kas Keluar / Pengeluaran Per Hari (`src/components/ExpenseModal.vue` & `src/utils/expenseConstants.js`):**
  - 4 kategori cepat (`Operasional`, `Makan & Transport`, `Tarik / Setor Owner`, `Lainnya` — siap menampung `Kulakan Stok` pada tahap berikutnya), 2 pilihan sumber uang (`Tunai (Dari Laci)` vs `Non-Tunai (QRIS / Rek)`), tombol nominal cepat (`5rb`–`100rb`), keterangan opsional, KPI real-time **Sisa Tunai Laci**, serta daftar keluar hari ini dengan konfirmasi hapus 2-tap aman.
  - Aturan akuntansi terpisah: pengeluaran **Tunai Laci** memotong **Sisa Tunai Laci**, biaya operasional mengurangi **Untung Bersih (Laba)**, sementara kategori **`prive` (Tarik / Setor Owner)** mengurangi saldo laci tanpa membuat estimasi untung jualan terlihat rugi.
- **Migrasi Skema IndexedDB v3 (`src/db/index.js`):** Penambahan tabel `expenses` (`++id, expenseNumber, createdAt, category, source, updatedAt, deleted`) dengan dukungan penuh `recordExpense`, `deleteExpense`, `getFullDatabasePayload`, `importBackupJSON` (LWW + soft-delete), `inspectBackupJSON`, dan `archiveOldTransactions`.
- **Integrasi Laporan, Excel 5 Sheet & Google Sync:**
  - `DailyReportModal.vue` kini menampilkan strip **Kas Keluar Hari Ini** + tombol cepat **+ Catat Keluar**, rincian **Sisa Laci** vs **Untung Bersih**, tab baru **Kas Keluar**, serta ringkasan pengeluaran otomatis pada pesan laporan **WhatsApp**.
  - `src/utils/excelExport.js` menambahkan rincian pengeluaran & sisa bersih laci pada sheet **Ringkasan Kas** serta sheet ke-5 **`Pengeluaran Kas`**.
  - `src/composables/useGoogleSync.js` menambahkan `appendExpenseToSheet` (`KAS KELUAR (TUNAI)` / `KAS KELUAR (NON-TUNAI)` bernominal negatif ke Google Sheets dengan antrean offline) serta *two-way merge* `expenses` ke Google Drive.

### Changed
- **Reorganisasi Navigasi Kompak (`src/components/TopBar.vue`):**
  - **Tablet & Desktop (`md+`/`lg+`):** Dirampingkan menjadi **`Stok & Data ▾`** (dropdown *Kelola Barang* & *Data Pelanggan*, siap untuk *Kulakan Stok*), **`Buku Utang`**, **`Kas Keluar`** (1-klik), **`Laporan`**, dan tombol ikon **`Pengaturan`** agar lega di layar tablet maupun desktop.
  - **Drawer HP (`md:hidden`):** Tetap 1-tap per menu yang dikelompokkan rapi ke dalam seksi **Keuangan & Kasir**, **Stok & Pelanggan**, dan **Sistem**.

---

## [2.8.3] - 2026-11-26 (Hotfix Tampilan Kartu QRIS & KPI Strip PaymentModal)

### Fixed
- Menambahkan `min-w-0` dan menghapus pemotongan satu baris (`truncate`) pada kotak KPI atas di `src/components/PaymentModal.vue` (`Total Tagihan`, `Uang Kembalian`, `Metode QRIS`, dan `Masuk Buku Bon`), serta memecah teks status QRIS menjadi **`Uang Pas ✓`** dengan sublabel **`Non-Tunai (Otomatis Pas)`** agar tidak terpotong di HP maupun laptop.

---

## [2.8.2] - 2026-11-26 (Optimasi Tampilan Laptop Modal Bayar & Isolasi Cetak Termal)

### Fixed
- **Tampilan Kembalian di Laptop/Desktop (`src/components/PaymentModal.vue`):** Memindahkan tampilan **Uang Kembalian / Masih Kurang** menjadi kartu KPI berdampingan dengan **Total Tagihan** di atas area scroll, memperlebar modal pada tablet/laptop (`md:max-w-2xl lg:max-w-3xl`), dan menata mode Tunai/QRIS ke layout 2 kolom agar seluruh kontrol pembayaran dan nominal kembalian terlihat sekaligus tanpa scroll.
- **Notifikasi / Header Ikut Tercetak (`src/components/ReceiptModal.vue`):** Menghilangkan `<style scoped>` pada aturan `@media print` agar `body, body * { visibility: hidden !important; }` benar-benar menyembunyikan elemen halaman & header *"Transaksi Selesai"* (plus class `print:hidden` pada header/footer modal serta `overflow: visible` pada kertas struk 58mm).

### Added
- Menambahkan topik pembahasan lanjutan **Koneksi Printer Thermal (Bluetooth ESC/POS / USB / 58mm-80mm)** ke backlog di `PRD_v2.0.md`.

---

## [2.8.1] - 2026-11-26 (Hotfix Modal Pembayaran Utang & Vue SFC UI Tests)

### Fixed
- Mengembalikan helper O(1) `getCustomerTxCount` berbasis `customerStatsMap` di `src/components/PaymentModal.vue` agar perpindahan ke tab **Utang / Bon** serta pembukaan dropdown pelanggan di tab Tunai/QRIS berjalan mulus tanpa error `ReferenceError`.

### Added
- Menambahkan `@vue/test-utils` dan `happy-dom` ke `vitest.config.js` dengan suite integrasi komponen Vue (`tests/uiModals.test.js`) untuk menguji langsung perpindahan tab (`Tunai` -> `QRIS` -> `Utang / Bon`), validasi Buku Utang, struk, laporan, pelanggan, lazy inventory, katalog produk, dan pengaturan arsip tahunan.

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
