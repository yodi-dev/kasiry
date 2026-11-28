# Kasiry POS (Warung Kasiry)

> **Aplikasi Kasir Warung Pintar & Buku Utang Digital (PWA Offline-First)**  
> Dirancang khusus untuk warung kelontong & UMKM Indonesia dengan prinsip **Zero Login Wall**, **100% Berfungsi Tanpa Internet**, **Dual Layout Adaptif (Mobile Thumb-Zone & Desktop Bento Workstation)**, **Scanner Hardware HID & Kamera Hybrid**, **Skalabilitas Data Multi-Tahun**, dan **Cadangan Cloud Gratis ($0) ke Google Drive & Sheets**.

---

## Fitur Utama

- **Nol Hambatan Login (*Zero Login Wall*):** Buka aplikasi web langsung siap melayani transaksi pembeli tanpa wajib membuat akun atau koneksi server.
- **100% Offline-First PWA:** Seluruh produk, keranjang, transaksi, kas keluar, kulakan, tarik tunai/transfer, pulsa/token listrik, mutasi keuangan & tabungan, shift kasir, dan piutang pelanggan disimpan lokal di IndexedDB (`Dexie.js` v8) lengkap dengan `navigator.storage.persist()` dan Service Worker Workbox (`vite-plugin-pwa`).
- **Tata Letak Responsif Dual-Mode:**
  - **Mobile (`< 768px`):** Alur ergonomi terbalik (*Glance Zone* keranjang di atas + tombol cepat di tengah + *Floating Bottom Console* di jangkauan jempol bawah), bebas footer agar layar transaksi lega, penguncian soft-keyboard HP hingga input benar-benar disentuh, serta Drawer terstruktur (*Shift & Layanan Konter*, *Keuangan & Laporan*, *Stok & Pelanggan*, *Sistem*).
  - **Tablet & Desktop (`md+` / `lg+`):** *Bento POS Workstation* 2-kolom dengan TopBar kompak (`Chip Shift` | `Stok & Data ▾`, `Layanan ▾`, `Keuangan ▾`, `Laporan`, `⚙️`), filter kategori pill, input pencarian inline berfokus otomatis, serta pintasan keyboard `/` (Cari) dan `F2` (Pembayaran).
- **300 Katalog Awal Warung Indonesia, Harga Cepat & Kebersihan Barang Pasif:** Saat pertama dibuka, Kasiry sudah menyediakan 300 nama barang populer warung (termuat malas agar booting ringan, harga `Rp 0`, akun `'Umum'` bersih `0` utang, profil default `Warung Kasiry`) lengkap dengan isi harga cepat per baris di `Kelola Barang`, auto-buka editor harga bila item `Rp 0` diklik di kasa, filter **Belum Harga / Belum Terjual / Sepi ≥30 Hr** + **Hapus Massal**, serta tombol **Mulai Toko Kosong** di Pengaturan.
- **Hardware Barcode Scanner (HID) & Kamera Hybrid:** Mendukung scanner USB/Bluetooth OTG secara global sekaligus kamera depan/belakang browser menggunakan kombinasi `BarcodeDetector` native + `@zxing/library`, lengkap dengan zoom, lampu kilat (*torch*), dan panduan jarak fokus.
- **Lazy Inventory + Kategori Dinamis:** Scan barcode barang yang belum terdaftar akan membuka modal input kilat — kini sekaligus bisa menambah kategori baru secara inline dan langsung memasukkan barang ke keranjang.
- **Kulakan / Belanja Stok & Manajemen Stok Lunak:** Mencatat nota kulakan multi-item (`RestockModal.vue`) untuk otomatis memperbarui harga beli/modal, opsi update harga jual, serta menambah stok produk (opsional/lunak: barang stok `0` tetap bebas dibeli tanpa memblokir kasa), lengkap dengan pilihan sumber dana **Tunai Laci**, **QRIS/Rek**, atau **Dana Luar**.
- **Pembayaran & Multi Harga Cerdas (Ecer / Grosir / Agen):**
  - **Multi Harga Fleksibel:** Harga Ecer wajib sebagai default; tiap barang opsional memiliki **Harga Grosir**, **Min. Qty Grosir** (otomatis turun harga saat jumlah beli tercapai), dan **Harga Agen**. Kasir dapat berpindah tier untuk seluruh nota di `CartSection`, memilih pelanggan berlevel `Grosir`/`Agen`, atau mengetuk harga barang untuk ubah/simpan harga manual secara langsung.
  - **Tunai:** Pelanggan default **"Umum"**, nominal cepat & pembulatan ke atas otomatis, hitung kembalian real-time, serta dukungan **bayar kurang / sebagian** (`0 < bayar < total`) yang otomatis memasukkan kekurangannya ke Buku Utang pelanggan non-Umum.
  - **QRIS:** Pembayaran non-tunai uang pas otomatis (`QRS-...`) atau **bayar sebagian QRIS** (`QRIS (SEBAGIAN BON)`) dengan pemisahan uang laci & rekening.
  - **Utang / Bon:** Cari atau daftarkan pelanggan baru secara cepat (akun `"Umum"` otomatis diblokir agar tidak mencatat piutang maupun bayar kurang), catat cicilan atau pelunasan Tunai/QRIS dengan kembalian presisi, dan kirim pengingat tagihan via WhatsApp.
- **Sistem Buka & Tutup Shift (Tutup Buku Harian):** 1 shift mewakili 1 hari operasional toko dengan jam buka/tutup fleksibel (termasuk lewat tengah malam), auto-isi modal awal terakhir, adopsi transaksi hari itu yang belum masuk shift, hitung uang fisik laci vs sistem (`Modal Awal + Tunai Masuk - Kas Keluar Laci`) beserta selisih kas, riwayat tutup shift, dan kirim laporan tutup buku ke WhatsApp.
- **Catatan Kas Keluar / Pengeluaran Harian:** Catat pengeluaran operasional (`Operasional`, `Makan & Transport`, `Lainnya`), `Kulakan Stok`, maupun `Tarik / Setor Owner` (`prive` — mengurangi saldo laci tanpa membuat estimasi laba jualan terlihat rugi) dari laci tunai atau sumber non-tunai.
- **Layanan Tarik Tunai & Transfer / Top-Up (`CashServiceModal.vue`):** Mencatat layanan tarik tunai (QRIS/transfer masuk, uang fisik keluar dari **Laci Kasir** maupun **Uang Kas**) maupun transfer/top-up (tunai masuk ke Laci atau Uang Kas, saldo dikirim) dengan perhitungan biaya admin **Cara A** (`Total Dibayar = Pokok + Admin`), penjagaan ketat agar tarik tunai tidak melebihi sisa tunai di sumber yang dipilih, cetak struk bukti thermal/WA, serta rekonsiliasi otomatis ke Shift & Untung Jasa Admin.
- **Penjualan Pulsa, Paket Data & Token Listrik PLN (`DigitalProductModal.vue`):** Mencatat penjualan produk digital dengan preset nominal yang mengingat harga modal & jual (`localStorage`), input No. HP / ID Meter PLN & Nomor Token 20 digit/SN (bisa diisi/edit belakangan di Riwayat), cetak struk & kirim token via WhatsApp, pembayaran Tunai / QRIS / Utang, serta pilihan sumber modal dari **Saldo Pihak Ketiga**, **Rekening/QRIS**, **Uang Kas**, atau **Dana Luar**.
- **Manajemen Keuangan & Tabungan Terpadu (`FinanceModal.vue`, terpisah dari Laporan Harian & Shift):** Pantau saldo 5 kantong dana toko (**Uang Laci Kasir**, **Uang Kas Toko**, **Rekening & QRIS**, **Tabungan Toko**, dan **Saldo Pihak Ketiga** untuk modal Pulsa/Token) yang dihitung penuh lintas riwayat IndexedDB + *archive snapshot*, total piutang, dan Kekayaan Bersih; analisis ringkasan **Hari/Shift Ini**, **7 Hari**, & **30 Hari**; serta catat **Tambah Tabungan**, **Isi Saldo Pihak Ketiga**, **Pindah Kantong**, **Setor Modal**, & **Ambil Dana** dengan penjagaan saldo anti-minus dan setoran laci otomatis saat Tutup Shift.
- **Laporan Harian/Shift & Ekspor Excel 10-Sheet:** Ringkasan lingkup shift aktif atau hari ini (uang masuk laci & QRIS, kas keluar, tarik tunai/transfer & laba admin, omzet & laba pulsa/PLN, sisa/seharusnya laci, perkiraan untung bersih, top 5 terlaris, riwayat harian & riwayat tutup shift), kirim ringkasan via WhatsApp, serta unduh file `.xlsx` 10 sheet (`Ringkasan Kas`, `Daftar Transaksi`, `Barang Terjual`, `Buku Utang Pelanggan`, `Pengeluaran Kas`, `Riwayat Shift`, `Riwayat Kulakan`, `Tarik Tunai & Transfer`, `Pulsa & Token Listrik`, `Mutasi Kas & Tabungan`) dengan SheetJS dinamis.
- **Cetak Struk Thermal Universal (Bluetooth BLE, USB/OTG, Serial COM & Browser Iframe):** Terhubung langsung ESC/POS ke printer thermal `58mm` (32 kolom) maupun `80mm` (48 kolom) melalui **Web Bluetooth**, **WebUSB** (HP/Tablet Android OTG & PC WinUSB), atau **Web Serial COM** dengan reconnect otomatis, tab **Printer** di Pengaturan (*ukuran kertas*, *catatan bawah struk kustom*, *cetak otomatis setelah bayar*, & *Tes Cetak Printer*), serta fallback bersih via hidden `<iframe>` `@page` `58mm`/`80mm` ke printer Windows/OS biasa.
- **Cloud Sync $0 (Google Drive & Sheets) + Arsip Tahunan:**
  - Login Google Identity Services (GIS) 1-klik, penulisan transaksi, pelunasan bon, kas keluar, nota kulakan, dan aktivitas buka/tutup shift realtime ke Google Sheets (dengan antrean otomatis saat offline), serta *two-way merge* cadangan Google Drive berbasis timestamp `updatedAt`.
  - **Skalabilitas Multi-Tahun:** Memori Kasa aktif menjaga jendela 90 hari di `shallowRef`, *batching* upload Drive otomatis saat transaksi besar, serta alat **Kesehatan & Arsip Data Tahunan** (`> 3 Bulan`, `> 6 Bulan`, `> 1 Tahun`) yang mengunduh arsip JSON (+ salinan ke Google Drive) sebelum meringankan memori HP tanpa menghapus barang maupun total saldo utang pelanggan.

---

## Tech Stack

- **Frontend:** Vue 3.5 (`<script setup>`) + Vite 8 (Rolldown Code Splitting)
- **Styling:** Tailwind CSS v4 (*Modern Ethereal Glassmorphism*, Midnight Navy `#0a193d` & Azure Sky `#0284c7`)
- **Database Lokal:** Dexie 4 (IndexedDB schema v8 dengan migrasi otomatis)
- **Barcode & Ekspor:** `@zxing/library` (lazy chunk) + SheetJS `xlsx` (dynamic `import('xlsx')`) + `@lucide/vue`
- **PWA:** `vite-plugin-pwa` + Workbox (`generateSW`, offline precache seluruh chunk aplikasi & aset statis)
- **Automated Testing:** Vitest + `fake-indexeddb` + `@vue/test-utils` (`happy-dom`)

---

## Struktur Proyek Ringkas

```text
kasiryy/
├── public/                 # Aset PWA, OG preview, robots/sitemap, privacy.html & terms.html (OAuth)
├── src/
│   ├── components/         # 20 komponen aktif UI Kasa & 15 modal (lazy-loaded via defineAsyncComponent)
│   ├── composables/        # useKasiryDB.js, useGoogleSync.js, useHardwareScanner.js, useThermalPrinter.js
│   ├── db/                 # KasiryDatabase schema v8 & 300 starter katalog warung (lazy seedData)
│   ├── utils/              # customerStats.js, dailyStats.js, financeEngine.js, expenseConstants.js, pricing.js, productUsage.js, thermalPrinter.js, excelExport.js, sound.js
│   ├── App.vue             # Orkestrator Kasa, prewarm jalur checkout, auto-print, & state global
│   └── style.css           # Tailwind CSS v4, Bento container queries & content-visibility
├── tests/                  # 11 suite test Vitest (64 skenario: DB >90hr + archive baseline, migrasi v1->v8, pricing, finance 5 kantong, printer BT/USB/Serial, tarik/transfer, pulsa/PLN, bayar kurang bon, void transaksi, usage, sync, stats, Excel, UI)
├── CHANGELOG.md            # Riwayat rilis SemVer (Keep a Changelog)
├── DESIGN_SYSTEM.md        # Panduan visual & token warna/komponen
├── PRD_v2.0.md             # Spesifikasi produk & arsitektur (diperbarui hingga v2.20.0)
├── SITEMAP.md              # Alur interaksi & arsitektur komponen
└── vite.config.js          # Rolldown vendor splitting & PWA Workbox configuration
```

---

## Menjalankan Proyek Secara Lokal

1. **Clone repository:**
   ```bash
   git clone https://github.com/yodi-dev/kasiry.git
   cd kasiry
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Opsional — Konfigurasi Google OAuth Client ID (untuk pengembangan lokal):**
   Salin `.env.example` menjadi `.env` dan isi `VITE_GOOGLE_CLIENT_ID` bila memakai Client ID sendiri (pengguna akhir juga bisa mengatur Client ID lewat menu *Pengaturan*).

4. **Jalankan development server:**
   ```bash
   npm run dev
   ```

5. **Jalankan automated tests (Vitest + `fake-indexeddb`):**
   ```bash
   npm test
   ```
   Untuk mode watch saat mengembangkan fitur:
   ```bash
   npm run test:watch
   ```

6. **Build produksi & preview PWA:**
   ```bash
   npm run build
   npm run preview
   ```

---

## Deployment (Cloudflare Pages)

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Konfigurasi Statis:** Sudah dilengkapi `public/_headers` (`Cross-Origin-Opener-Policy: same-origin-allow-popups` untuk popup GIS OAuth), `public/_redirects`, `robots.txt`, `sitemap.xml`, dan `navigateFallbackDenylist` di `vite.config.js` agar halaman kepatuhan `/privacy` & `/terms` (`Kasiry by Awanbeo`) serta verifikasi Google Search Console di custom domain `https://kasiry.awanbeo.my.id` lolos langsung tanpa terhalang fallback SPA maupun redirect `.html`.

---

## Dokumentasi Terkait

- [PRD & Blueprint Arsitektur](PRD_v2.0.md)
- [Sitemap & Alur Interaksi](SITEMAP.md)
- [Panduan Desain Sistem](DESIGN_SYSTEM.md)
- [Catatan Rilis (Changelog)](CHANGELOG.md)

Dibuat untuk mendukung operasional harian warung kelontong & UMKM Indonesia.
