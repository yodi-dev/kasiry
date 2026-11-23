# Kasiry (Habiba Store POS) 🛒⚡

> **Aplikasi Kasir Warung Pintar & Pembukuan Utang Otomatis (PWA Offline-First)**
> Dirancang khusus untuk warung kelontong & UMKM Indonesia dengan prinsip: **Nol Hambatan Login**, **100% Berfungsi Tanpa Internet**, **Dukungan Barcode Scanner Hardware (HID) & Kamera**, dan **Sinkronisasi Gratis ke Google Sheets**.

---

## ✨ Fitur Utama

- **🚀 Nol Hambatan Login (Zero Login Wall):** Buka web langsung masuk ke mode kasir kasir siap transaksi.
- **📱 Offline-First PWA:** Berjalan 100% tanpa internet menggunakan IndexedDB (Dexie.js) dan Service Worker Workbox.
- **⚡ Hardware Barcode Scanner (HID) & Kamera:** Mendukung barcode scanner USB/Bluetooth tanpa perlu klik mouse ke input box, plus scanner kamera via BarcodeDetector API.
- **🏷️ Lazy Inventory (Input Cepat Barang Baru):** Jika ada barang baru yang belum terdaftar saat di-scan, popup cepat muncul seketika tanpa membatalkan transaksi.
- **📖 Buku Utang Warung Digital (Buku Bon):** Pencatatan utang pelanggan otomatis, lacak riwayat pelunasan, dan tagih utang lewat WhatsApp dalam 1 klik.
- **📊 Laporan Harian & Kirim WA 1-Klik:** Ringkasan omzet, keuntungan bersih, jumlah transaksi, dan teks rekap otomatis untuk dikirim ke WhatsApp pemilik warung.
- **☁️ Cloud Backup $0 (Google Sheets & Drive):** Sinkronisasi otomatis ke Google Spreadsheet pemilik toko tanpa biaya server bulanan.
- **🖨️ Struk Monospace:** Pratinjau struk belanjaan format printer thermal 58mm/80mm.

---

## 🛠️ Tech Stack

- **Framework:** Vue 3 (`<script setup>`) + Vite
- **Styling:** Tailwind CSS v4 (Modern Ethereal Light-Blue & Deep Navy Glassmorphism)
- **Icons:** Lucide Icons (`@lucide/vue`)
- **Local Database:** Dexie.js (IndexedDB wrapper)
- **PWA:** `vite-plugin-pwa` + Workbox
- **Offline Export:** SheetJS (`xlsx`)

---

## 🚀 Menjalankan Project Secara Lokal

1. **Clone repository:**
   ```bash
   git clone https://github.com/yodi-dev/kasiry.git
   cd kasiry
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Jalankan development server:**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:5174` (atau port yang dialokasikan Vite).

4. **Build untuk Production:**
   ```bash
   npm run build
   ```

---

## ☁️ Deployment ke Cloudflare Pages

1. Hubungkan repo `yodi-dev/kasiry` di Cloudflare Pages.
2. Pengaturan build:
   - **Framework preset:** `None`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Aplikasi otomatis ter-deploy sebagai PWA offline-first dengan CDN global.

---

## 📄 Lisensi
Dibuat dengan ❤️ untuk kemajuan UMKM dan Warung Kelontong Indonesia.
