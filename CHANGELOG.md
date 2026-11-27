# Changelog Kasiry POS

Seluruh perubahan penting, peningkatan fitur, perbaikan bug, dan rilis versi **Kasiry POS** dicatat pada dokumen ini mengikuti format [Keep a Changelog](https://keepachangelog.com/id-ID/1.0.0/) dan [Semantic Versioning](https://semver.org/).

> **Catatan Kompatibilitas Data:** Format JSON backup lokal/Google Drive tetap mempertahankan schema `version: '2.4'` agar file cadangan lama dan arsip tahunan tetap kompatibel lintas versi.

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
