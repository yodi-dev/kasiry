// Katalog Bawaan Produk Warung Indonesia Lengkap dengan Barcode EAN-13 Asli
export const seedProducts = [
  // 1. BARANG CURAH & TERLARIS (Tombol Cepat / isMacro: true)
  {
    id: 1,
    barcode: '',
    name: 'Gas LPG 3 Kg',
    sellPrice: 22000,
    buyPrice: 19500,
    isMacro: true,
    category: 'Curah',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 2,
    barcode: '',
    name: 'Galon Aqua 19L (Tukar Galon)',
    sellPrice: 20000,
    buyPrice: 17500,
    isMacro: true,
    category: 'Curah',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 3,
    barcode: '',
    name: 'Telur Ayam Negeri (1 Kg)',
    sellPrice: 28000,
    buyPrice: 25000,
    isMacro: true,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 4,
    barcode: '',
    name: 'Es Batu Kristal (1 Kantong)',
    sellPrice: 2000,
    buyPrice: 1000,
    isMacro: true,
    category: 'Curah',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 5,
    barcode: '',
    name: 'Minyak Goreng Curah 1 Liter',
    sellPrice: 16500,
    buyPrice: 15000,
    isMacro: true,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 6,
    barcode: '',
    name: 'Beras Ramos Pulen 1 Liter',
    sellPrice: 14000,
    buyPrice: 12500,
    isMacro: true,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 7,
    barcode: '',
    name: 'Cabai Rawit Merah (1 Ons)',
    sellPrice: 6000,
    buyPrice: 4500,
    isMacro: true,
    category: 'Curah',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 8,
    barcode: '',
    name: 'Bawang Merah Brebes (1 Ons)',
    sellPrice: 5000,
    buyPrice: 3800,
    isMacro: true,
    category: 'Curah',
    updatedAt: Date.now(),
    deleted: false
  },

  // 2. MIE INSTAN & MAKANAN
  {
    id: 9,
    barcode: '8998866200224',
    name: 'Indomie Goreng Spesial 85g',
    sellPrice: 3500,
    buyPrice: 2900,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 10,
    barcode: '8998866200118',
    name: 'Indomie Ayam Bawang 69g',
    sellPrice: 3500,
    buyPrice: 2900,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 11,
    barcode: '8998866200330',
    name: 'Indomie Soto Mie 70g',
    sellPrice: 3500,
    buyPrice: 2900,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 12,
    barcode: '8998888123456',
    name: 'Mie Sedaap Goreng 90g',
    sellPrice: 3500,
    buyPrice: 2900,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 13,
    barcode: '8998888654321',
    name: 'Mie Sedaap Soto Madura 75g',
    sellPrice: 3500,
    buyPrice: 2900,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 14,
    barcode: '8999999054321',
    name: 'Kecap Manis Bango 135ml',
    sellPrice: 11000,
    buyPrice: 9500,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 15,
    barcode: '8999999123888',
    name: 'Saus Sambal ABC Botol 135ml',
    sellPrice: 8500,
    buyPrice: 7200,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 16,
    barcode: '8999999234999',
    name: 'Royco Bumbu Rasa Ayam Renceng',
    sellPrice: 6000,
    buyPrice: 5000,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 17,
    barcode: '8999999345000',
    name: 'Ladaku Merica Bubuk Renceng',
    sellPrice: 12000,
    buyPrice: 10500,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 18,
    barcode: '8993005123999',
    name: 'Biskuit Roma Kelapa 300g',
    sellPrice: 11500,
    buyPrice: 9800,
    isMacro: false,
    category: 'Makanan',
    updatedAt: Date.now(),
    deleted: false
  },

  // 3. MINUMAN
  {
    id: 19,
    barcode: '8991389221148',
    name: 'Le Minerale 600ml',
    sellPrice: 3500,
    buyPrice: 2600,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 20,
    barcode: '8992759111122',
    name: 'Aqua Botol 600ml',
    sellPrice: 4000,
    buyPrice: 3100,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 21,
    barcode: '8993175538119',
    name: 'Teh Pucuk Harum 350ml',
    sellPrice: 4000,
    buyPrice: 3100,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 22,
    barcode: '8992753211102',
    name: 'Kopi Kapal Api Spesial Mix Renceng',
    sellPrice: 15000,
    buyPrice: 13000,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 23,
    barcode: '8992753112233',
    name: 'Susu Kental Manis Frisian Flag 370g',
    sellPrice: 13500,
    buyPrice: 11800,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 24,
    barcode: '8992741987654',
    name: 'Pocari Sweat Botol 500ml',
    sellPrice: 7500,
    buyPrice: 6200,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 25,
    barcode: '8991001123456',
    name: 'Ultra Milk Cokelat 250ml',
    sellPrice: 6500,
    buyPrice: 5500,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 26,
    barcode: '8991001987654',
    name: 'Teh Botol Sosro Kotak 250ml',
    sellPrice: 3500,
    buyPrice: 2800,
    isMacro: false,
    category: 'Minuman',
    updatedAt: Date.now(),
    deleted: false
  },

  // 4. KEBERSIHAN & PERLENGKAPAN RUMAH
  {
    id: 27,
    barcode: '8999999712345',
    name: 'Sunlight Jeruk Nipis 210ml',
    sellPrice: 5500,
    buyPrice: 4600,
    isMacro: false,
    category: 'Kebersihan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 28,
    barcode: '8999999511111',
    name: 'Sabun Mandi Lifebuoy Total 10 85g',
    sellPrice: 4500,
    buyPrice: 3700,
    isMacro: false,
    category: 'Kebersihan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 29,
    barcode: '8998888771122',
    name: 'Deterjen Daia Putih 850g',
    sellPrice: 18000,
    buyPrice: 16000,
    isMacro: false,
    category: 'Kebersihan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 30,
    barcode: '8999999443322',
    name: 'Pewangi Molto All-in-1 Sachet Renceng',
    sellPrice: 11000,
    buyPrice: 9200,
    isMacro: false,
    category: 'Kebersihan',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 31,
    barcode: '8999999332211',
    name: 'Pasta Gigi Pepsodent 120g',
    sellPrice: 13000,
    buyPrice: 11200,
    isMacro: false,
    category: 'Kebersihan',
    updatedAt: Date.now(),
    deleted: false
  },

  // 5. SEMBAKO KEMASAN
  {
    id: 32,
    barcode: '8999999001234',
    name: 'Minyakita Bantal 1 Liter',
    sellPrice: 16000,
    buyPrice: 14500,
    isMacro: false,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 33,
    barcode: '8991111222333',
    name: 'Gula Pasir Kristal Putih 1 Kg',
    sellPrice: 17500,
    buyPrice: 15800,
    isMacro: false,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 34,
    barcode: '8992775112233',
    name: 'Tepung Terigu Segitiga Biru 1 Kg',
    sellPrice: 13000,
    buyPrice: 11500,
    isMacro: false,
    category: 'Sembako',
    updatedAt: Date.now(),
    deleted: false
  },

  // 6. ROKOK
  {
    id: 35,
    barcode: '8998888777666',
    name: 'Sampoerna A Mild 16',
    sellPrice: 36000,
    buyPrice: 33500,
    isMacro: false,
    category: 'Rokok',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 36,
    barcode: '8997777666555',
    name: 'Djarum Super 12',
    sellPrice: 24500,
    buyPrice: 22500,
    isMacro: false,
    category: 'Rokok',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 37,
    barcode: '8992345098765',
    name: 'Gudang Garam Surya 16',
    sellPrice: 34000,
    buyPrice: 31800,
    isMacro: false,
    category: 'Rokok',
    updatedAt: Date.now(),
    deleted: false
  },
  {
    id: 38,
    barcode: '8998888001122',
    name: 'Marlboro Red 20',
    sellPrice: 45000,
    buyPrice: 42000,
    isMacro: false,
    category: 'Rokok',
    updatedAt: Date.now(),
    deleted: false
  }
]

// Data Pelanggan Awal (Buku Utang Demo Warung)
export const seedCustomers = [
  { id: 1, name: 'Bu Tejo', phone: '081234567891', totalDebt: 45000, lastDate: '21 Nov 2026', updatedAt: Date.now(), deleted: false },
  { id: 2, name: 'Pak RT Bambang', phone: '081398765432', totalDebt: 120000, lastDate: '20 Nov 2026', updatedAt: Date.now(), deleted: false },
  { id: 3, name: 'Mbak Pur', phone: '085712344321', totalDebt: 15000, lastDate: '22 Nov 2026', updatedAt: Date.now(), deleted: false },
  { id: 4, name: 'Kang Ujang', phone: '082155566677', totalDebt: 72000, lastDate: '19 Nov 2026', updatedAt: Date.now(), deleted: false }
]

// Data Pengaturan Profil Awal (Habiba Store)
export const seedSettings = {
  storeProfile: {
    name: 'Habiba Store',
    owner: 'Habiba',
    phone: '081234567890'
  },
  licenseStatus: {
    isLifetime: true,
    txCount: 0,
    txLimit: 999999
  },
  googleIntegration: {
    isConnected: false,
    user: null,
    spreadsheetId: null,
    lastSyncTime: null
  }
}
