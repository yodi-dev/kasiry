export const initialProducts = [
  // Barang Pokok & Harian
  { id: 1, barcode: '', name: 'Gas LPG 3 Kg', sellPrice: 22000, buyPrice: 19500, isMacro: true, category: 'Curah' },
  { id: 2, barcode: '', name: 'Telur Ayam (1 Kg)', sellPrice: 28000, buyPrice: 25000, isMacro: true, category: 'Sembako' },
  { id: 3, barcode: '', name: 'Es Batu Kristal', sellPrice: 2000, buyPrice: 1000, isMacro: true, category: 'Curah' },
  { id: 4, barcode: '', name: 'Minyak Goreng Curah 1L', sellPrice: 15500, buyPrice: 14000, isMacro: true, category: 'Sembako' },
  { id: 5, barcode: '', name: 'Beras Ramos 1 Liter', sellPrice: 13500, buyPrice: 12000, isMacro: true, category: 'Sembako' },
  { id: 6, barcode: '', name: 'Cabai Rawit 1 Ons', sellPrice: 6000, buyPrice: 4500, isMacro: true, category: 'Curah' },
  
  // FMCG Barcode
  { id: 7, barcode: '8998866200224', name: 'Indomie Goreng Spesial', sellPrice: 3500, buyPrice: 2900, isMacro: false, category: 'Makanan' },
  { id: 8, barcode: '8998866200118', name: 'Indomie Ayam Bawang', sellPrice: 3500, buyPrice: 2900, isMacro: false, category: 'Makanan' },
  { id: 9, barcode: '8991389221148', name: 'Le Minerale 600ml', sellPrice: 3500, buyPrice: 2600, isMacro: false, category: 'Minuman' },
  { id: 10, barcode: '8993175538119', name: 'Teh Pucuk Harum 350ml', sellPrice: 4000, buyPrice: 3100, isMacro: false, category: 'Minuman' },
  { id: 11, barcode: '8992753211102', name: 'Kopi Kapal Api Renceng', sellPrice: 15000, buyPrice: 13000, isMacro: false, category: 'Minuman' },
  { id: 12, barcode: '8999999001234', name: 'Minyakita Bantal 1L', sellPrice: 16000, buyPrice: 14500, isMacro: false, category: 'Sembako' },
  { id: 13, barcode: '8999999511111', name: 'Sabun Lifebuoy 85g', sellPrice: 4500, buyPrice: 3700, isMacro: false, category: 'Kebersihan' },
  { id: 14, barcode: '8999999712345', name: 'Sunlight 210ml', sellPrice: 5500, buyPrice: 4600, isMacro: false, category: 'Kebersihan' },
  { id: 15, barcode: '8991111222333', name: 'Gula Pasir 1 Kg', sellPrice: 17500, buyPrice: 15800, isMacro: false, category: 'Sembako' },
  { id: 16, barcode: '8998888777666', name: 'Sampoerna A Mild 16', sellPrice: 35000, buyPrice: 32500, isMacro: false, category: 'Rokok' },
  { id: 17, barcode: '8997777666555', name: 'Djarum Super 12', sellPrice: 24000, buyPrice: 22000, isMacro: false, category: 'Rokok' }
]

export const initialCustomers = [
  { id: 1, name: 'Bu Tejo', phone: '081234567891', totalDebt: 45000, lastDate: '21 Nov 2026' },
  { id: 2, name: 'Pak RT Bambang', phone: '081398765432', totalDebt: 120000, lastDate: '20 Nov 2026' },
  { id: 3, name: 'Mbak Pur', phone: '085712344321', totalDebt: 15000, lastDate: '22 Nov 2026' },
  { id: 4, name: 'Kang Ujang', phone: '082155566677', totalDebt: 72000, lastDate: '19 Nov 2026' }
]

export const initialStats = {
  todaySales: 1485000,
  todayProfit: 285000,
  transactionCount: 42,
  todayNewDebt: 60000,
  topProducts: [
    { name: 'Gas LPG 3 Kg', qty: 14, subtotal: 308000 },
    { name: 'Indomie Goreng Spesial', qty: 28, subtotal: 98000 },
    { name: 'Telur Ayam (1 Kg)', qty: 8, subtotal: 224000 },
    { name: 'Le Minerale 600ml', qty: 22, subtotal: 77000 },
    { name: 'Minyakita Bantal 1L', qty: 10, subtotal: 160000 }
  ]
}
