# Kasiry (Habiba Store POS)

> **Aplikasi Kasir Warung Pintar & Buku Utang Digital (PWA Offline-First)**  
> Dirancang khusus untuk warung kelontong & UMKM Indonesia dengan prinsip **Zero Login Wall**, **100% Berfungsi Tanpa Internet**, **Dual Layout Adaptif (Mobile Thumb-Zone & Desktop Bento Workstation)**, **Scanner Hardware HID & Kamera Hybrid**, **Skalabilitas Data Multi-Tahun**, dan **Cadangan Cloud Gratis ($0) ke Google Drive & Sheets**.

---

## Fitur Utama

- **Nol Hambatan Login (*Zero Login Wall*):** Buka aplikasi web langsung siap melayani transaksi pembeli tanpa wajib membuat akun atau koneksi server.
- **100% Offline-First PWA:** Seluruh produk, keranjang, transaksi, dan piutang pelanggan disimpan lokal di IndexedDB (`Dexie.js` v2) lengkap dengan `navigator.storage.persist()` dan Service Worker Workbox (`vite-plugin-pwa`).
- **Tata Letak Responsif Dual-Mode:**
  - **Mobile (`< 768px`):** Alur ergonomi terbalik (*Glance Zone* keranjang di atas + tombol cepat di tengah + *Floating Bottom Console* di jangkauan jempol bawah), bebas footer agar layar transaksi lega, serta penguncian soft-keyboard HP hingga input benar-benar disentuh.
  - **Tablet & Desktop (`md+` / `lg+`):** *Bento POS Workstation* 2-kolom dengan filter kategori pill, input pencarian inline berfokus otomatis, serta pintasan keyboard `/` (Cari) dan `F2` (Pembayaran).
- **Hardware Barcode Scanner (HID) & Kamera Hybrid:** Mendukung scanner USB/Bluetooth OTG secara global sekaligus kamera depan/belakang browser menggunakan kombinasi `BarcodeDetector` native + `@zxing/library`, lengkap dengan zoom, lampu kilat (*torch*), dan panduan jarak fokus.
- **Lazy Inventory + Kategori Dinamis:** Scan barcode barang yang belum terdaftar akan membuka modal input kilat — kini sekaligus bisa menambah kategori baru secara inline dan langsung memasukkan barang ke keranjang.
- **Pembayaran Cerdas & Manajemen Pelanggan:**
  - **Tunai:** Pelanggan default **"Umum"**, nominal cepat & pembulatan ke atas otomatis, hitung kembalian real-time, serta daftar pelanggan diurutkan berdasarkan loyalitas ($O(N)$ `buildCustomerStatsMap`).
  - **Utang / Bon:** Cari atau daftarkan pelanggan baru secara cepat (akun `"Umum"` otomatis diblokir agar tidak mencatat piutang), catat cicilan atau pelunasan pecahan besar dengan kembalian presisi, dan kirim pengingat tagihan via WhatsApp.
- **Laporan Harian & Ekspor Excel Multi-Sheet:** Ringkasan uang masuk, perkiraan untung bersih, top 5 terlaris, riwayat transaksi harian, kirim ringkasan via WhatsApp, serta unduh file `.xlsx` multi-sheet (SheetJS dimuat dinamis agar bundle awal tetap ramping).
- **Cloud Sync $0 (Google Drive & Sheets) + Arsip Tahunan:**
  - Login Google Identity Services (GIS) 1-klik, penulisan transaksi & pelunasan bon realtime ke Google Sheets (dengan antrean otomatis saat offline), dan *two-way merge* cadangan Google Drive berbasis timestamp `updatedAt`.
  - **Skalabilitas Multi-Tahun:** Memori Kasa aktif menjaga jendela 90 hari di `shallowRef`, *batching* upload Drive otomatis saat transaksi besar, serta alat **Kesehatan & Arsip Data Tahunan** (`> 3 Bulan`, `> 6 Bulan`, `> 1 Tahun`) yang mengunduh arsip JSON (+ salinan ke Google Drive) sebelum meringankan memori HP tanpa menghapus barang maupun total saldo utang pelanggan.

---

## Tech Stack

- **Frontend:** Vue 3.5 (`<script setup>`) + Vite 8 (Rolldown Code Splitting)
- **Styling:** Tailwind CSS v4 (*Modern Ethereal Glassmorphism*, Midnight Navy `#0a193d` & Azure Sky `#0284c7`)
- **Database Lokal:** Dexie 4 (IndexedDB schema v2 dengan migrasi otomatis)
- **Barcode & Ekspor:** `@zxing/library` (lazy chunk) + SheetJS `xlsx` (dynamic `import('xlsx')`) + `@lucide/vue`
- **PWA:** `vite-plugin-pwa` + Workbox (`generateSW`, offline precache seluruh chunk aplikasi & aset statis)
- **Automated Testing:** Vitest + `fake-indexeddb`

---

## Struktur Proyek Ringkas

```text
kasiryy/
├── public/                 # Aset PWA, OG preview, robots/sitemap, privacy.html & terms.html (OAuth)
├── src/
│   ├── components/         # 14 komponen aktif UI Kasa & 9 modal (lazy-loaded via defineAsyncComponent)
│   ├── composables/        # useKasiryDB.js, useGoogleSync.js, useHardwareScanner.js
│   ├── db/                 # KasiryDatabase schema v2 & 38 seed produk + 5 seed pelanggan awal
│   ├── utils/              # customerStats.js O(N), excelExport.js (async SheetJS), sound.js
│   ├── App.vue             # Orkestrator Kasa, prewarm jalur checkout, & state global
│   └── style.css           # Tailwind CSS v4, Bento container queries & content-visibility
├── tests/                  # Suite test Vitest (DB, migrasi v1->v2, cloud sync, O(N) stats, Excel)
├── CHANGELOG.md            # Riwayat rilis SemVer (Keep a Changelog)
├── DESIGN_SYSTEM.md        # Panduan visual & token warna/komponen
├── PRD_v2.0.md             # Spesifikasi produk & arsitektur (diperbarui hingga v2.7)
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
- **Konfigurasi Statis:** Sudah dilengkapi `public/_headers` (`Cross-Origin-Opener-Policy: same-origin-allow-popups` untuk popup GIS OAuth), `public/_redirects`, `robots.txt`, `sitemap.xml`, dan `navigateFallbackDenylist` di `vite.config.js` agar halaman kepatuhan `/privacy.html` & `/terms.html` serta verifikasi Google Search Console lolos langsung tanpa terhalang fallback SPA.

---

## Dokumentasi Terkait

- [PRD & Blueprint Arsitektur](PRD_v2.0.md)
- [Sitemap & Alur Interaksi](SITEMAP.md)
- [Panduan Desain Sistem](DESIGN_SYSTEM.md)
- [Catatan Rilis (Changelog)](CHANGELOG.md)

Dibuat untuk mendukung operasional harian warung kelontong & UMKM Indonesia.
