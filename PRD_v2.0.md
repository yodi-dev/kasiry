# Product Requirements Document (PRD) & Blueprint Arsitektur: Kasiry

**Versi Dokumen:** 2.1 (Konsolidasi PWA, Google Ecosystem, Dexie DB, & UX Warung Pedesaan)  
**Status:** Approved for Implementation  
**Penulis:** Yodi & Antigravity (AI Assistant)  
**Platform Target:** Progressive Web App (PWA) Mobile-First & Desktop POS  
**Repository:** `d:\web\kasiryy`  

---

## 📌 Dokumen Kontrol & Riwayat Versi (Changelog)

| Versi | Tanggal | Penulis | Ringkasan Perubahan Utama |
| :---: | :---: | :---: | :--- |
| **v2.1** | 22 November 2026 | Yodi & AI Assistant | **Evolusi ke Progressive Web App (PWA) & Ekosistem Google ($0 Cost):**<br>1. **Adopsi Stack PWA Teruji:** Mengadopsi fondasi dari *Dailyy* dan *Trainyy* (Vue 3, Tailwind CSS v4, Lucide Icons, Dexie.js IndexedDB, Vite-Plugin-PWA).<br>2. **Integrasi Google Identity Services (GIS):** Autentikasi 1-klik tanpa password untuk menghubungkan Google Drive & Google Sheets pribadi pemilik warung.<br>3. **Buku Kas Otomatis Google Sheets:** Sinkronisasi multi-tab (Rekap Penjualan, Rincian Barang Terjual, Buku Utang) yang bisa dipantau jarak jauh dari laptop/HP pemilik.<br>4. **Ekspor Excel (.xlsx) Offline:** Kemampuan mengunduh pembukuan kasir dalam format Excel kapan saja meski tanpa internet.<br>5. **Optimasi Barcode Scanner Fisik (HID):** Rekayasa `inputmode="none"` dan global keydown listener untuk mencegah keyboard virtual menutupi layar kasir.<br>6. **Desain Sistem & Bahasa Warung:** Penerapan token visual, ergonomi tombol raksasa ($\ge 48\text{dp}$–$64\text{dp}$), kontras tinggi, dan penghapusan total istilah akuntansi teknis. |
| **v2.0** | 22 November 2026 | Yodi | Konsolidasi konsep awal, branding, UX warung kelontong, dan model bisnis beli-putus. |

---

## 1. Ringkasan Eksekutif & Identitas Brand

### 1.1 Filosofi Produk
**Kasiry** adalah aplikasi kasir (*Point of Sale*) Progressive Web App (PWA) yang dirancang khusus untuk **warung kelontong dan pedagang mikro di pedesaan Indonesia**.

Banyak aplikasi kasir modern gagal diadopsi di warung desa karena:
1. **Wajib Internet:** Sinyal pedesaan sering hilang/mati lampu.
2. **Mental Block Input Data:** Pemilik warung enggan menginput manual 500+ barang sebelum mulai berjualan.
3. **Penjaga Pengganti Tidak Hafal Harga:** Anggota keluarga (anak, kakek/nenek) yang menjaga warung saat pemilik pergi sering bingung harga barang.
4. **UI Terlalu Rumit:** Menu bertingkat, istilah akuntansi asing (*Revenue, COGS, Inventory*), dan tombol kecil yang sulit ditekan jempol orang tua.

**Kasiry membalik paradigma tersebut:**
> *"Buka aplikasi langsung jualan. Tanpa login awal, tanpa pusing input data berhari-hari, dan 100% jalan secepat kilat tanpa internet."*

### 1.2 Identitas Merek (Brand Identity)
* **Nama Produk:** **Kasiry** (Gabungan kata *Kasir* dan inisial *Y*).
* **Tagline Komunikasi:** *"Kasiry: Aplikasi Kasir Warung Paling Gampang."*
* **Konsep Logo:** Monogram huruf **"Y"** tebal yang menyatu dengan siluet **Atap Warung Tradisional** dan simbol **Centang ($\checkmark$)** pelunasan rezeki.
* **Palet Warna Utama (Sesuai Karakter Pedesaan):**
  * **Primary (Hijau Daun Rezeki - `#2E7D32`):** Melambangkan uang masuk, pertumbuhan usaha, serta adem dan nyaman dipandang mata seharian di toko.
  * **Secondary (Kuning Emas Rezeki - `#FBC02D` / `#F59E0B`):** Memberi kesan hangat, merakyat, ramah, dan simbol kelancaran rezeki kasir.
  * **Background Surface (Putih Susu Hangat - `#F8FAF8` / `#FFFFFF`):** Menghindari silau layar di bawah sinar matahari/lampu warung dan menjaga kontras teks di atas 4.5:1.
  * **Accent Utang (Merah Bata Peringatan - `#DC2626`):** Identifikasi tegas untuk status bon/utang pelanggan.

---

## 2. Target Pengguna (User Persona)

### Persona 1: Pak Tejo (54 Tahun) - Pemilik Warung Kelontong
* **Karakter:** Mengelola warung di teras rumah di desa. Mata mulai butuh kacamata baca. HP yang digunakan adalah Android kelas *entry-level* (RAM 3 GB).
* **Kebiasaan:** Menggunakan WhatsApp dan kalkulator fisik. Sering merasa rugi karena barang dibeli dengan bon/utang tetangga yang catatannya hilang di buku kertas.
* **Kebutuhan Utama:** Tombol kasir besar, harga barang langsung muncul saat barcode discan/diketik, dan pencatatan utang semudah mengetik nama tetangga.

### Persona 2: Mbak Sri (21 Tahun) - Anak / Penjaga Toko Pengganti
* **Karakter:** Mahasiswi/lulusan SMK yang sering diminta gantian menjaga warung saat orang tua belanja ke pasar grosir.
* **Kebiasaan:** Fasih pakai HP, tapi tidak hafal harga ratusan jenis barang di warung (terutama barang curah seperti telur, terigu, atau sabun yang beda varian).
* **Kebutuhan Utama:** Kecepatan saat ada antrean pembeli, tidak perlu tanya-tanya harga lewat telepon ke orang tua, dan bisa langsung mengirim rekap penjualan ke WhatsApp bapaknya sore hari.

---

## 3. Sitemap & Arsitektur Informasi

Kasiry menganut prinsip **"Zero-Page Navigation"** (Layar Kasa Tunggal). Seluruh transaksi jual-beli diselesaikan dalam satu layar utama tanpa pernah berpindah URL/halaman. Fitur sekunder dibuka melalui lembar modal (*bottom sheet / pop-up dialog*) yang cepat dan mudah ditutup.

```mermaid
flowchart TD
    App([Layar Kasir Utama / Single Screen Hub])
    
    App -->|Scan Barcode / Ketik Barang| SearchBar[Smart Input & Scanner]
    App -->|Ketuk Tombol Cepat| MacroMatrix[Matriks Barang Curah Non-Barcode]
    App -->|Daftar Keranjang Belanja| Cart[Keranjang Belanja Dinamis]
    
    SearchBar -.->|Barcode Belum Ada| ModalLazyInv[Modal: Lazy Inventory Baru]
    
    Cart -->|Tekan Tombol [BAYAR]| ModalPayment[Modal: Pembayaran Cerdas]
    
    ModalPayment -->|Metode Tunai| CashFlow[Smart Static Cash Matrix]
    ModalPayment -->|Metode Utang/Bon| DebtFlow[Lazy Customer Utang Selector]
    
    App -->|Ikon Buku Utang di TopBar| ModalDebtBook[Modal: Buku Utang Warung]
    ModalDebtBook -->|Bayar Utang| DebtSettle[Pencatatan Cicilan / Lunas]
    
    App -->|Ikon Laporan di TopBar| ModalReport[Modal: Laporan Harian Warung]
    ModalReport -->|1-Klik| WhatsAppExport[Kirim Teks ke WhatsApp]
    ModalReport -->|1-Klik| ExcelExport[Unduh File Excel .xlsx]
    
    App -->|Ikon Pengaturan di TopBar| ModalSettings[Modal: Pengaturan Warung]
    ModalSettings -->|1-Klik GIS| GoogleAuth[Hubungkan Akun Google]
    GoogleAuth --> DriveSync[Auto-Backup Google Drive]
    GoogleAuth --> SheetsSync[Sinkronisasi Google Sheets]
```

### Rincian Tampilan (View Breakdown):
1. **TopBar Permanen:**
   * Nama Warung & Tanggal Hari Ini.
   * Indikator Sinyal: `[Offline]` (Abu/Hijau) & Indikator Cloud: `[Google Terhubung / Belum]`.
   * Tiga Tombol Aksi Cepat: `[Buku Utang]`, `[Laporan Hari Ini]`, `[Pengaturan/Google]`.
2. **Kawasan Kerja Kasir (Main Single Screen):**
   * **Zona Atas:** Barcode Input (Auto-focus, siap terima tembakan scanner USB/BT) + Tombol Kamera Scanner on-demand.
   * **Zona Tengah:** Matriks Tombol Makro Dinamis (Gas LPG 3kg, Telur 1kg, Es Batu, dll.).
   * **Zona Bawah:** Keranjang Belanja (Nama item, kuantitas, tombol `+` / `-` besar, hapus) + Sticky Bar Total Belanja & Tombol Raksasa **[ BAYAR (Rp ...) ]**.
3. **Modal Dialogs (Top Layer Native `<dialog>`):**
   * `PaymentModal.vue`: Pilihan Tunai (Uang Pas, Pecahan 2rb–100rb, Kembalian) vs Utang/Bon.
   * `LazyInventoryModal.vue`: Input kilat 2 kolom (`Nama Barang` & `Harga Jual`) saat barcode baru terdeteksi.
   * `DebtBookModal.vue`: Tabel daftar tetangga yang berutang, saldo, dan riwayat.
   * `DailyReportModal.vue`: Kartu rekap Uang Masuk, Estimasi Untung, dan tombol WhatsApp + Excel.
   * `SettingsModal.vue`: Profil Warung, Login Google, Backup/Restore JSON, dan Status Lisensi.

---

## 4. Spesifikasi Detail Fitur (Dari Hulu ke Hilir)

### 4.1. Onboarding Bebas Hambatan (No Login Wall)
* Saat pertama kali aplikasi dibuka di browser HP:
  1. Muncul sambutan singkat: *"Selamat Datang di Kasiry"*.
  2. Form super ringkas: **Nama Warung** (contoh: *Warung Bu Tejo*) dan **Nomor WhatsApp Pemilik**.
  3. Tombol besar: **[ MULAI JUALAN SEKARANG ]**.
  4. Data toko tersimpan permanen di `IndexedDB (Dexie)`. Pengguna langsung berada di layar kasir siap melayani pembeli pertama dalam waktu kurang dari 15 detik!

### 4.2. Tiga Pilar Master Data Produk
1. **Pre-loaded Seed Database (~200–500 SKU Populer):**
   * Bundling data barang kebutuhan pokok Indonesia: Indomie Goreng/Kuah, Kopi Kapal Api, Le Minerale 600ml, Teh Pucuk, Beras Ramos 5kg, Minyakita 1L, Sabun Lifebuoy, Rokok Surya 16, dll.
   * Lengkap dengan kode barcode EAN-13 resmi.
   * Saat warung menembakkan barcode barang tersebut untuk pertama kali, nama barang otomatis muncul; kasir hanya perlu mengonfirmasi atau menyesuaikan harga jualnya satu kali saja.
2. **Lazy Inventory (Input Sambil Jualan):**
   * Ketika scanner membaca barcode yang belum terdaftar:
     * Kasir tidak dialihkan ke halaman menu stok yang ribet.
     * Muncul pop-up kecil di tengah layar: *"Barang Baru Terdeteksi!"*.
     * Dua kolom input besar: **Nama Barang** dan **Harga Jual**.
     * Ketuk `[Simpan & Masukkan Keranjang]`.
     * Barang langsung masuk transaksi saat itu dan otomatis tersimpan ke katalog warung selamanya.
3. **Quick Macro Matrix (Barang Curah Non-Barcode):**
   * Grid tombol besar untuk barang tanpa kemasan pabrik (LPG 3Kg, Es Batu, Telur 1/2 Kg, Sayur, Cabe).
   * Dilengkapi fungsi filter ketik instan: jika kasir mengetik *"te"*, matriks langsung menyaring dan memunculkan tombol *[Telur]* dan *[Teh Manis]*.

### 4.3. Penanganan Barcode Scanner Fisik (HID Mode) & Kamera
* **Hardware Barcode Scanner via USB OTG / Bluetooth:**
  * Scanner fisik dikenali sistem operasi sebagai *hardware keyboard*. Scanner mengetikkan urutan angka dalam milidetik diakhiri karakter `Enter`.
  * **Solusi Web POS Kasiry:** Menggunakan kombinasi listener `window.addEventListener('keydown')` cerdas dengan buffer waktu (< 50ms per keystroke). Kolom input menggunakan atribut `inputmode="none"` saat mode scanner aktif agar keyboard virtual HP tidak melonjak keluar menutupi layar.
* **Kamera Barcode Scanner On-Demand:**
  * Tombol kamera hanya aktif jika ditekan (menghemat baterai & menjaga HP tidak panas).
  * Menggunakan **Barcode Detection API** bawaan browser Chrome (didukung ML Kit lokal di Android) dengan fallback `@zxing/library` / `html5-qrcode`.

### 4.4. Modal Pembayaran Cerdas (Smart Payment Flow)
Ketika kasir menekan tombol **[ BAYAR ]**:
* **Mode Tunai (Default):**
  * Tombol raksasa **[ UANG PAS ]** (misal belanja Rp 37.500, tombol langsung bernilai Rp 37.500).
  * Tombol pecahan standar nominal Rupiah: `[+ 2.000]`, `[+ 5.000]`, `[+ 10.000]`, `[+ 20.000]`, `[+ 50.000]`, `[+ 100.000]`.
  * Saran pembulatan otomatis ke atas (misal total Rp 37.500 $\rightarrow$ muncul tombol cepat `[Rp 40.000]` dan `[Rp 50.000]`).
  * Tampilan **KEMBALIAN** berukuran ekstra besar dengan warna hijau tebal untuk mencegah kasir salah hitung uang kembalian.
* **Mode Utang / Bon (Lazy Customer):**
  * Digunakan saat tetangga belum bawa uang.
  * Kolom input nama pelanggan dengan pencarian otomatis nama yang sudah pernah berutang.
  * Jika nama baru (belum ada di daftar), muncul tombol cepat: **[ + Catat Utang ke "(Nama Baru)" ]**.
  * Transaksi langsung selesai, barang keluar dari stok, dan saldo utang orang tersebut otomatis bertambah di Buku Utang.

### 4.5. Buku Utang Digital & Pelunasan
* Tab/Modal khusus menampilkan daftar seluruh orang yang memiliki tanggungan utang.
* Menampilkan: Nama, Terakhir Belanja, dan Total Tagihan.
* Satu klik tombol **[ Bayar / Cicil ]**:
  * Masukkan nominal yang dibayarkan.
  * Utang otomatis berkurang. Jika lunas, status berganti menjadi `[LUNAS]`.
  * Ada tombol 1-klik: **[ Kirim Pengingat WhatsApp ]** berisi rincian sopan:
    > *"Halo Bu Tejo, sekadar menginfokan catatan bon belanja di Warung Bu Sri saat ini sebesar Rp 45.000. Matur nuwun."*

### 4.6. Laporan Harian Ala Chat WhatsApp
* Dirancang khusus tanpa grafik chart yang rumit. Menampilkan 3 kartu ringkas:
  1. **Uang Masuk Hari Ini (Rp ...)**
  2. **Perkiraan Untung Bersih (Rp ...)**
  3. **Barang Paling Laris (Top 5)**
  4. **Total Bon/Utang Baru Hari Ini (Rp ...)**
* Tombol **[ Kirim ke WhatsApp ]**:
  * Otomatis memformat teks rapi dan membuka aplikasi WhatsApp pemilik/keluarga.

### 4.7. Integrasi Google Ecosystem ($0 Server Cost)
Diadaptasi dari kesuksesan arsitektur di *Dailyy* dan *Trainyy*:
1. **Google Identity Services (GIS):** Login 1-klik menggunakan akun Google pemilik warung tanpa backend server.
2. **Auto-Backup Google Drive:** Menyimpan snapshot database `kasiry-backup.json` di folder pribadi Google Drive pengguna secara berkala atau manual 1-klik.
3. **Buku Kas Google Sheets Multi-Tab:**
   * Aplikasi otomatis membuat Google Spreadsheet berjudul:  
     📊 **"Kasiry - Buku Kas & Laporan Warung"**.
   * Memiliki 3 lembar kerja (sheets):
     * `Sheet1 - Rekap Transaksi`: Tanggal, Jam, No Nota, Total Belanja, Metode (Tunai/Utang), Uang Masuk, Kembalian, Untung.
     * `Sheet2 - Rincian Barang`: No Nota, Tanggal, Nama Barang, Barcode, Qty, Harga Satuan, Modal, Subtotal.
     * `Sheet3 - Rekap Utang Tetangga`: Nama, Nomor WA, Total Sisa Utang, Terakhir Diperbarui.
   * Pemilik warung bisa membuka laporan ini dari kantor, pasar, atau laptop kapan saja!
4. **Ekspor Excel (.xlsx) Offline:**
   * Menggunakan library client-side (`xlsx` / SheetJS).
   * Sekali ketuk tombol **[ Unduh Excel ]**, file `.xlsx` dengan format kolom rapi langsung tersimpan di folder download HP/komputer, tanpa butuh internet.

---

## 5. Desain Sistem & Panduan Ergonomi (UI/UX Guidelines)

Mengikuti standar **`ui-ux-pro-max`** dan **`modern-web-guidance`**:

### 5.1. Token Arsitektur (Three-Layer Structure)
* **Primitive Tokens:**
  * `--color-emerald-800: #1b5e20;`
  * `--color-emerald-700: #2e7d32;` (Primary Green)
  * `--color-emerald-600: #388e3c;`
  * `--color-amber-500: #f59e0b;` (Secondary Gold)
  * `--color-amber-400: #fbbf24;`
  * `--color-slate-900: #0f172a;`
  * `--color-slate-700: #334155;`
  * `--color-slate-100: #f1f5f9;`
  * `--color-cream-50: #f8faf8;`
* **Semantic Tokens:**
  * `--bg-app: var(--color-cream-50);`
  * `--bg-surface: #ffffff;`
  * `--text-primary: var(--color-slate-900);`
  * `--text-secondary: var(--color-slate-700);`
  * `--color-brand: var(--color-emerald-700);`
  * `--color-accent: var(--color-amber-500);`
  * `--color-danger: #dc2626;`
* **Component Tokens:**
  * `--btn-pos-height: 56px;` (Target sentuh jempol kasir)
  * `--btn-macro-height: 64px;`
  * `--btn-pay-height: 64px;`
  * `--font-price-size: 1.5rem;` (24px bold)
  * `--font-total-size: 2rem;` (32px extrabold)

### 5.2. Prinsip Ergonomi Warung (Touch Targets & Readability)
1. **Target Sentuh Minimum:** Seluruh tombol penting kasir memiliki tinggi minimal **56px–64px** dan padding minimal **12px–16px** agar tidak meleset saat kasir bekerja cepat.
2. **Kontras Teks Tinggi:** Teks harga dan total belanja menggunakan kontras ratio $\ge 7:1$ (di atas standar WCAG AAA 4.5:1) agar tetap terbaca jelas di bawah terik matahari atau lampu neon toko.
3. **Penyekat Visual & State Stabil:** Saat tombol ditekan, gunakan efek `active:scale-[0.98]` dan perubahan warna latar, **bukan perubahan ukuran tata letak (no layout shift)** agar antarmuka tidak bergetar.
4. **Ikon Vektor Standar:** Menggunakan `@lucide/vue` untuk konsistensi visual. Tidak menggunakan emoji sebagai tombol aksi struktural.

### 5.3. Kamus Bahasa Warung (Anti-Jargon)

| Istilah Akuntansi / POS Modern | Istilah di Kasiry | Alasan Pemilihan Kata |
| :--- | :--- | :--- |
| *Revenue / Gross Sales* | **Uang Masuk** | Sangat alami dan langsung dimengerti pedagang. |
| *Net Profit / Gross Margin* | **Untung Bersih** | Istilah pasar sehari-hari. |
| *Inventory / Stock Level* | **Sisa Barang** | Konkrit dan bebas istilah asing. |
| *Accounts Receivable (A/R)* | **Buku Utang / Bon** | Tradisi kelontong Indonesia. |
| *Cost of Goods Sold (COGS)* | **Harga Kulak / Modal** | Biasa diucapkan saat belanja ke pasar grosir. |
| *Void / Refund* | **Batal Belanja** | Jelas dan tidak membingungkan. |
| *Checkout* | **Bayar** | To the point. |

---

## 6. Arsitektur Data & Skema Database Lokal (Dexie.js)

Database lokal diberi nama: **`KasiryDB`** dengan skema versi 1:

```javascript
// Definisi Database Dexie
import Dexie from 'dexie'

export class KasiryDatabase extends Dexie {
  constructor() {
    super('KasiryDB')
    this.version(1).stores({
      products: '++id, barcode, name, sellPrice, buyPrice, isMacro, category, frequencyScore',
      transactions: '++id, invoiceNumber, timestamp, totalAmount, paymentMethod, cashGiven, changeAmount, customerId, isDebt, isSynced',
      transactionItems: '++id, transactionId, productId, productName, sellPrice, buyPrice, qty, subtotal',
      customers: '++id, name, phone, totalDebt, createdAt, updatedAt',
      debtPayments: '++id, customerId, amountPaid, timestamp, notes',
      settings: 'key'
    })
  }
}

export const db = new KasiryDatabase()
```

### Pemetaan Kolom Google Sheets:
1. **Sheet `Rekap_Transaksi`:**
   `[Waktu, No Nota, Total Belanja, Metode Bayar, Tunai Diberikan, Kembalian, Estimasi Untung, Nama Pelanggan]`
2. **Sheet `Detail_Barang_Terjual`:**
   `[No Nota, Waktu, Barcode, Nama Barang, Kuantitas, Harga Jual, Modal, Subtotal, Untung Item]`
3. **Sheet `Buku_Utang_Pelanggan`:**
   `[Nama Pelanggan, Nomor Telepon/WA, Total Sisa Utang, Tanggal Transaksi Terakhir, Status]`

---

## 7. Penanganan Masalah Teknis Kritis (Edge Cases)

### 7.1. Mencegah Kehilangan Data Lokal (Storage Persistence)
Pada saat aplikasi pertama kali dibuka, panggil:
```javascript
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist()
  console.log('Kasiry Storage Persisted:', isPersisted)
}
```
Ini mencegah Android menghapus database IndexedDB saat memori internal perangkat menipis.

### 7.2. Deteksi Scanner Fisik vs Ketikan Manual
* Scanner mengirimkan karakter sangat cepat (biasanya < 30ms antar karakter) dan diakhiri kode karakter `Enter` (KeyCode 13).
* Kasiry menyematkan *timing buffer*: jika ada input serial cepat diikuti `Enter`, sistem langsung memprosesnya sebagai pembacaan barcode tanpa perlu memindahkan kursor mouse atau fokus layar.

### 7.3. Antrean Sinkronisasi Offline ke Online (Sync Queue)
* Ketika kasir dalam kondisi offline, field `isSynced = 0` pada transaksi.
* Service worker memonitor event `window.addEventListener('online', ...)`.
* Begitu koneksi internet kembali aktif dan akun Google sedang terhubung, transaksi yang berstatus `isSynced = 0` otomatis diunggah ke Google Sheets di latar belakang tanpa mengganggu jalannya transaksi baru.

---

## 8. Rencana Implementasi Bertahap (Sprint Roadmap)

| Sprint | Fokus Pekerjaan | Output / Deliverables |
| :---: | :--- | :--- |
| **Sprint 1** | **Pondasi Proyek PWA & Skema Dexie** | • Setup Vite + Vue 3 + Tailwind v4 + Lucide + PWA.<br>• Skema `KasiryDB` Dexie & Inisialisasi Seed ~150 FMCG populer.<br>• Shell PWA (Manifest, Service Worker, Standalone Mode, Icons). |
| **Sprint 2** | **Layar Kasir Utama & Lazy Inventory** | • Barcode input bar (HID Scanner buffer & toggle kamera).<br>• Matriks tombol makro dinamis & Keranjang belanja.<br>• Modal Lazy Inventory (Input kilat saat scan barang baru). |
| **Sprint 3** | **Modal Pembayaran Cerdas & Kasus Utang** | • Smart Cash Matrix (Uang pas, pecahan rupiah, kalkulator kembalian).<br>• Mode Utang & Selector Lazy Customer (Input nama tetangga instan).<br>• Penyimpanan transaksi ke database lokal & nota belanja. |
| **Sprint 4** | **Buku Utang & Laporan Harian Warung** | • Modal Buku Utang (Daftar berutang & pelunasan/cicilan).<br>• Modal Laporan Harian (Uang masuk, untung, barang terlaris).<br>• Fitur 1-klik kirim teks laporan dan tagihan ke WhatsApp.<br>• Generator ekspor file Excel (`.xlsx`) offline. |
| **Sprint 5** | **Integrasi Google Ecosystem & Polishing** | • Composable `useGoogleDrive.js` (Google Identity Services token client).<br>• Pembuatan & sinkronisasi multi-tab Google Spreadsheet otomatis.<br>• Backup/Restore JSON ke Google Drive pribadi.<br>• Audit aksesibilitas, touch target $\ge 56\text{px}$, dan uji performa offline. |

---

## 9. Penutup & Persetujuan Desain

Dokumen ini menjadi **acuan tunggal kebenaran (Single Source of Truth)** dari perancangan arsitektur Kasiry dari hulu ke hilir. Seluruh pengembangan kode dan komponen antarmuka akan mengacu secara ketat pada spesifikasi di atas.
