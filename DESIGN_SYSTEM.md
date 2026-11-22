# Desain Sistem & Panduan Visual (Design Tokens): Kasiry

Dokumen ini merupakan panduan implementasi antarmuka (*UI Guidelines*) dan *Design System* resmi Kasiry yang dibangun di atas **Tailwind CSS v4** dengan kepatuhan terhadap standar **WCAG AAA** dan ergonomi kasir warung.

---

## 1. Prinsip Visual Kasiry

1. **Warung-First & Merakyat:** Desain hangat, bersahabat, dan tidak mengintimidasi pengguna lanjut usia atau berpendidikan dasar.
2. **Keterbacaan Ekstrem (High Contrast & Large Types):** Angka harga dan nominal uang harus terlihat jelas dari jarak pandang 50–70 cm (jarak HP di atas meja kasir warung).
3. **Ergonomi Jempol (Thumb-Friendly):** Tombol aksi utama berada di separuh bawah layar dengan tinggi minimal **56px–64px**.
4. **Anti-Guncang (Zero Layout Shift):** Interaksi sentuh memberikan respons instan (*visual ripple / scale feedback*) tanpa menggeser elemen di sekitarnya.

---

## 2. Token Desain (Three-Layer Architecture)

### 2.1. Primitive Tokens (Nilai Mentah)

```css
/* Color Palette */
--kasiry-green-900: #14532d;
--kasiry-green-800: #166534;
--kasiry-green-700: #2e7d32; /* Primary Brand */
--kasiry-green-600: #16a34a;
--kasiry-green-100: #dcfce7;
--kasiry-green-50:  #f0fdf4;

--kasiry-gold-600:  #d97706;
--kasiry-gold-500:  #f59e0b; /* Secondary Brand */
--kasiry-gold-400:  #fbbf24;
--kasiry-gold-100:  #fef3c7;

--kasiry-red-700:   #b91c1c;
--kasiry-red-600:   #dc2626; /* Debt / Warning */
--kasiry-red-50:    #fef2f2;

--kasiry-neutral-900: #0f172a;
--kasiry-neutral-700: #334155;
--kasiry-neutral-400: #94a3b8;
--kasiry-neutral-200: #e2e8f0;
--kasiry-neutral-100: #f1f5f9;
--kasiry-neutral-50:  #f8faf8; /* Warm Milk White */
```

### 2.2. Semantic Tokens (Tujuan Pemakaian)

```css
:root {
  /* Surface & Background */
  --bg-app: var(--kasiry-neutral-50);
  --bg-surface: #ffffff;
  --bg-surface-elevated: #ffffff;
  --bg-overlay: rgba(15, 23, 42, 0.7);

  /* Typography */
  --text-main: var(--kasiry-neutral-900);
  --text-muted: var(--kasiry-neutral-700);
  --text-inverse: #ffffff;

  /* Brand Semantics */
  --color-primary: var(--kasiry-green-700);
  --color-primary-active: var(--kasiry-green-800);
  --color-secondary: var(--kasiry-gold-500);
  --color-debt: var(--kasiry-red-600);
  --color-border: var(--kasiry-neutral-200);
}
```

### 2.3. Component Tokens (Spesifikasi Komponen)

```css
:root {
  /* Button Sizing */
  --btn-h-primary: 60px;
  --btn-h-macro: 64px;
  --btn-h-small: 44px;
  --btn-radius: 12px;

  /* Cart Item */
  --cart-item-py: 14px;
  --cart-counter-size: 48px;

  /* Typography Scales */
  --font-cash-total: 32px;
  --font-price-item: 20px;
  --font-label-bold: 16px;
}
```

---

## 3. Konfigurasi Tailwind CSS v4

Pada `src/style.css`, konfigurasi tema didefinisikan secara deklaratif:

```css
@import "tailwindcss";

@theme {
  --color-kasiry-green: #2e7d32;
  --color-kasiry-green-dark: #1b5e20;
  --color-kasiry-green-light: #f0fdf4;
  --color-kasiry-gold: #f59e0b;
  --color-kasiry-gold-light: #fef3c7;
  --color-kasiry-red: #dc2626;
  --color-kasiry-bg: #f8faf8;
  
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}
```

---

## 4. Panduan Komponen Khusus (Ergonomic Component Specs)

### 4.1. Tombol Matriks Cepat (`MacroButton.vue`)
* **Tinggi:** 64px.
* **Layout:** Nama barang 2 baris (font size 14px tebal), harga barang di bawah (font size 15px warna hijau tua).
* **Efek Sentuh:** `active:scale-[0.97] transition-transform duration-75`.
* **State Aktif:** Border tebal 2px warna hijau emerald.

### 4.2. Pengatur Kuantitas Belanja (`CartQuantityControl.vue`)
* Tombol `[-]` dan `[+]` berukuran minimal **48px $\times$ 48px** dengan ikon tebal.
* Angka kuantitas diapit di tengah dengan font 20px tebal.
* Mencegah salah pencet saat antrean panjang.

### 4.3. Layar Dialog / Modal (`NativeDialog.vue`)
* Menggunakan elemen native `<dialog>` browser modern (didukung penuh di Chrome Android & Safari).
* Latar belakang gelap (*scrim*): `backdrop:bg-black/60 backdrop:backdrop-blur-sm`.
* Animasi buka/tutup halus 150ms tanpa guncangan layar.
* Menutup modal cukup dengan sentuh di luar area dialog (*light dismiss*) atau tombol silang besar di pojok kanan atas.
