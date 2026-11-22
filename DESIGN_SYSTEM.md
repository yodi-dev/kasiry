# Desain Sistem & Panduan Visual (Design Tokens): Kasiry (Habiba Store)

Dokumen ini merupakan panduan implementasi antarmuka (*UI Guidelines*), *Design Tokens*, dan standar komponen resmi Kasiry yang dibangun di atas **Tailwind CSS v4** dengan kepatuhan terhadap standar **WCAG AAA** dan ergonomi kasir warung.

Desain ini berlaku sebagai **referensi standar tunggal** untuk halaman kasir utama dan seluruh halaman/modal dialog lainnya.

---

## 1. Prinsip Visual Kasiry (Modern Ethereal Glassmorphism)

1. **Warung-First & Merakyat:** Tampilan bersih, ramah, dan profesional. Tidak mengintimidasi penjaga warung lansia maupun anggota keluarga penjaga pengganti.
2. **Keterbacaan Seimbang (Anti-Excessive Bold):**
   - Menghindari penegasan tebal (*font-black*) pada semua elemen teks.
   - Judul menggunakan `font-bold` dengan warna Midnight Navy (`#0a193d`).
   - Teks bodi menggunakan `font-medium` dengan warna `slate-500` / `slate-600` untuk keterbacaan yang nyaman di mata.
   - Nominal uang menggunakan `font-bold` atau `font-black` untuk presisi kasir.
3. **Ergonomi Terbalik (Inverted Ergonomics):**
   - **Glance Zone (Atas):** Struk belanjaan ditempatkan di atas agar kasir leluasa melihat daftar belanja tanpa tertutup telapak tangan/jempol.
   - **Thumb Zone (Bawah):** Form input barcode, pencarian, dan tombol *Pembayaran* berada di konsol melayang (*sticky dock*) di bagian bawah layar.
4. **Anti-Slop & Anti-Jargon:**
   - Menghilangkan ornamen visual yang tidak fungsional (ikon dekoratif berlebihan di kartu produk, kartu akordeon hitam pekat yang menghalangi konten).
   - Menghilangkan jargon akuntansi (*Revenue, COGS, Gross Profit*). Menggunakan bahasa warung asli: *Uang Masuk, Perkiraan Untung, Buku Utang, Pembayaran*.

---

## 2. Token Desain (Three-Layer Architecture)

### 2.1. Primitive Tokens (Nilai Mentah)

```css
/* Palet Warna Primer: Midnight Deep Navy & Azure Sky */
--kasiry-navy-950: #050d21;
--kasiry-navy-900: #0a193d; /* Primary Text & Dark Elements */
--kasiry-navy-800: #102b66; /* Hover Navy */
--kasiry-navy-700: #1a3a80;

--kasiry-azure-600: #0284c7; /* Brand Primary Accent */
--kasiry-sky-400:   #38bdf8; /* Active Badge & Glowing Ring */
--kasiry-sky-200:   #bae6fd;
--kasiry-sky-50:    #f0f9ff;

/* Latar Belakang Gradien Halus */
--kasiry-canvas-from: #e2effb;
--kasiry-canvas-via:  #edf5fd;
--kasiry-canvas-to:   #e5f0fb;

/* Status Semantik */
--kasiry-emerald-600: #059669; /* Untung Bersih & Online Dot */
--kasiry-emerald-50:  #ecfdf5;
--kasiry-coral-600:   #ef4444; /* Peringatan Utang & Hapus */
--kasiry-coral-50:    #fef2f2;
--kasiry-amber-500:   #f59e0b; /* Pending / Warning */

/* Netral & Kaca (Frosted Glass) */
--kasiry-glass-white: rgba(255, 255, 255, 0.90);
--kasiry-border-white: rgba(255, 255, 255, 0.90);
--kasiry-slate-400:   #94a3b8;
--kasiry-slate-500:   #64748b;
```

### 2.2. Semantic Tokens (Tujuan Pemakaian)

```css
:root {
  /* Latar Belakang & Permukaan */
  --bg-app: radial-gradient(circle at 50% 0%, #e2effb 0%, #edf5fd 50%, #e5f0fb 100%);
  --bg-card: var(--kasiry-glass-white);
  --bg-modal: #ffffff;
  --bg-dark-dock: rgba(10, 25, 61, 0.95);

  /* Tipografi */
  --text-primary: var(--kasiry-navy-900);
  --text-muted: var(--kasiry-slate-500);
  --text-accent: var(--kasiry-azure-600);
  --text-inverse: #ffffff;

  /* Status */
  --status-online: var(--kasiry-emerald-600);
  --status-debt: var(--kasiry-coral-600);

  /* Interaksi */
  --focus-ring: rgba(56, 189, 248, 0.25);
  --focus-border: var(--kasiry-azure-600);
}
```

### 2.3. Component Tokens (Spesifikasi Komponen)

```css
:root {
  /* Sudut Membulat (Border Radius) */
  --radius-card: 24px;   /* rounded-3xl */
  --radius-button: 16px; /* rounded-2xl */
  --radius-pill: 9999px; /* rounded-full */

  /* Ketinggian Elemen Sentuh (Ergonomi Minimal 44-52px) */
  --h-input-search: 48px;
  --h-button-primary: 48px;
  --h-stepper-btn: 32px;
  --h-checkout-dock: 64px;

  /* Bayangan Halus */
  --shadow-dock: 0 20px 25px -5px rgba(10, 25, 61, 0.25), 0 8px 10px -6px rgba(10, 25, 61, 0.1);
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
}
```

---

## 3. Spesifikasi Komponen Utama

### 3.1. Kartu Struk Belanjaan (`CartSection.vue` - Glance Zone)
- **Letak:** Di paling atas area konten kasir.
- **Wadah:** `bg-white/90 backdrop-blur-md rounded-3xl border border-white/90 shadow-sm`.
- **Header:** Ikon tas belanja sky, judul "Struk Belanjaan", info jenis item & total pcs, dan tombol "Kosongkan" merah lembut saat disentuh.
- **Daftar Belanja:** Scrollable dengan batas tinggi `max-h-[35vh]` agar tidak mendominasi layar.
- **Baris Item:** Nama barang tebal alami (`font-semibold text-[#0a193d]`), harga satuan, stepper kuantitas `[-] [qty] [+]` dengan background slate lembut, subtotal harga, dan tombol hapus.

### 3.2. Grid Tombol Cepat (`FrequentProductsSection.vue`)
- **Letak:** Di bawah Struk Belanjaan.
- **Judul:** Lugas dan jelas: **"BARANG SERING TERJUAL"** (`text-xs font-bold text-[#0a193d] uppercase tracking-wide`).
- **Katalog:** 6 hingga 8 produk terlaris tanpa ikon dekoratif yang berulang.
- **Kartu Produk:** `min-h-[76px] p-3 bg-white/90 hover:bg-white rounded-2xl border border-white/90 shadow-xs`.
  - Nama barang 2 baris (`line-clamp-2`).
  - Harga jelas di kiri bawah, tombol `[+]` di kanan bawah.

### 3.3. Konsol Melayang di Bawah (`Floating Sticky Bottom Console`)
- **Wadah:** `fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 max-w-4xl mx-auto z-30 flex flex-col gap-2`.
- **Lapis 1 - Input Barcode & Cari (`BarcodeInputBar.vue`):**
  - Mengambang dengan latar frosted glass putih (`bg-white/95 backdrop-blur-md rounded-2xl border-2`).
  - **Status Fokus (Autofocus):** `border-sky-500 ring-4 ring-sky-500/20 bg-white` dengan ikon pencarian berubah menjadi `text-sky-600`.
  - Tombol Scan Kamera di sisi kanan berlatar Midnight Navy (`bg-[#0a193d] text-sky-400`).
  - **Dropdown Hasil Pencarian:** Membuka ke arah **atas** (`bottom-full mb-2.5`) dengan bayangan mendalam (`shadow-2xl rounded-2xl border border-slate-200/90`) agar tidak terpotong tepi bawah layar.
- **Lapis 2 - Bar Total & Pembayaran (`StickyBottomBar.vue`):**
  - Kapsul Deep Navy (`bg-[#0a193d]/95 backdrop-blur-xl rounded-[24px] p-3 sm:p-3.5 shadow-2xl`).
  - Menampilkan Total Tagihan nominal rupiah tebal & jumlah pcs.
  - Tombol **"Pembayaran"** bergradien biru cerah (`from-sky-500 to-sky-600 hover:from-sky-400`).
  - **Kondisional:** Tersembunyi saat keranjang kosong (`itemCount === 0`) dan otomatis meluncur muncul saat ada barang.

---

## 4. Standar Universal Desain Modal Dialog (Referensi Seluruh Halaman Lain)

Seluruh fitur sekunder (Buku Utang, Laporan Harian, Kelola Barang, Pengaturan, Nota Struk, Scanner Kamera, dan Pembayaran) **WAJIB** menerapkan standar visual ini agar konsisten:

### 4.1. Struktur HTML Modal Standar
```html
<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-[#0a193d]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
  >
    <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      
      <!-- 1. Modal Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60">
            <!-- Icon Fitur -->
          </div>
          <div>
            <h3 class="text-base font-bold text-[#0a193d] leading-tight">Judul Fitur</h3>
            <p class="text-xs text-slate-500 font-medium">Penjelasan singkat fitur</p>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 2. Modal Body (Scrollable) -->
      <div class="p-5 overflow-y-auto flex-1 space-y-4">
        <!-- Konten Form / List Data -->
      </div>

      <!-- 3. Modal Footer (Actions) -->
      <div class="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5 shrink-0">
        <button 
          @click="emit('close')"
          class="h-11 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
        >
          Tutup / Batal
        </button>
        <button 
          @click="handleAction"
          class="h-11 px-5 bg-[#0a193d] hover:bg-[#102b66] active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
        >
          Simpan / Konfirmasi
        </button>
      </div>

    </div>
  </div>
</template>
```

### 4.2. Aturan Input Formulir di dalam Modal:
- Kotak input teks: `h-11 px-3.5 rounded-xl border border-slate-200 text-[#0a193d] text-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all`.
- Label input: `text-xs font-semibold text-[#0a193d] mb-1 block`.
- Bantuan / error: `text-[11px] text-slate-500` atau `text-red-500`.

---

## 5. Ringkasan Kepatuhan & Checklist Desain

- [x] Background menggunakan gradien radial halus `#e2effb` ke `#edf5fd`.
- [x] Tidak ada warna mencolok yang beradu secara sembarangan.
- [x] Header menggunakan teks Midnight Deep Navy `#0a193d`.
- [x] Input Barcode memiliki visual fokus tegas (*Sky Blue ring glow*).
- [x] Seluruh modal menggunakan border radius `rounded-3xl` dan tombol `rounded-xl` / `rounded-2xl`.
- [x] Seluruh teks berbahasa Indonesia yang bersahabat (*anti-jargon*).
