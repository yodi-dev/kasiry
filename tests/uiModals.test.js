// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PaymentModal from '../src/components/PaymentModal.vue'
import DebtBookModal from '../src/components/DebtBookModal.vue'
import ReceiptModal from '../src/components/ReceiptModal.vue'
import DailyReportModal from '../src/components/DailyReportModal.vue'
import ExpenseModal from '../src/components/ExpenseModal.vue'
import FrequentProductsSection from '../src/components/FrequentProductsSection.vue'
import TopBar from '../src/components/TopBar.vue'
import CustomerManagementModal from '../src/components/CustomerManagementModal.vue'
import LazyInventoryModal from '../src/components/LazyInventoryModal.vue'
import ProductManagementModal from '../src/components/ProductManagementModal.vue'
import SettingsModal from '../src/components/SettingsModal.vue'

const sampleCustomers = [
  { id: 1, name: 'Umum', phone: '', totalDebt: 0, updatedAt: 1000 },
  { id: 2, name: 'Bu Tejo', phone: '081234567891', totalDebt: 45000, updatedAt: 2000 },
  { id: 3, name: 'Pak RT Bambang', phone: '081398765432', totalDebt: 0, updatedAt: 3000 }
]

const sampleTransactions = [
  {
    invoiceNumber: 'KSR-100',
    createdAt: Date.now(),
    paymentMethod: 'TUNAI',
    customerId: 2,
    customerName: 'Bu Tejo',
    totalAmount: 25000,
    items: [{ id: 1, name: 'Beras', sellPrice: 25000, qty: 1 }]
  },
  {
    invoiceNumber: 'QRS-101',
    createdAt: Date.now(),
    paymentMethod: 'QRIS',
    customerId: 1,
    customerName: 'Umum',
    totalAmount: 30000,
    items: [{ id: 2, name: 'Minyak', sellPrice: 30000, qty: 1 }]
  },
  {
    invoiceNumber: 'BON-102',
    createdAt: Date.now(),
    paymentMethod: 'UTANG / BON',
    customerId: 2,
    customerName: 'Bu Tejo',
    totalAmount: 20000,
    items: [{ id: 3, name: 'Telur', sellPrice: 20000, qty: 1 }]
  }
]

describe('Vue SFC Modals Integration & Tab Switching', () => {
  it('switches across Tunai, QRIS, and Utang/Bon tabs in PaymentModal without crashing or disappearing', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        isOpen: true,
        totalAmount: 29000,
        savedCustomers: sampleCustomers,
        transactions: sampleTransactions
      }
    })

    // 1. Default tab Tunai, KPI kembalian live & customer dropdown
    expect(wrapper.text()).toContain('Selesaikan Pembayaran')
    expect(wrapper.text()).toContain('Umum')
    expect(wrapper.text()).toContain('Uang Kembalian:')

    // Ketik nominal kurang -> KPI berubah ke Uang Masih Kurang; ketik lebih -> Uang Kembalian akurat
    const cashInput = wrapper.find('input[placeholder="0"]')
    await cashInput.setValue('20000')
    await nextTick()
    expect(wrapper.text()).toContain('Uang Masih Kurang:')
    expect(wrapper.text()).toContain('Rp 9.000')

    await cashInput.setValue('50000')
    await nextTick()
    expect(wrapper.text()).toContain('Uang Kembalian:')
    expect(wrapper.text()).toContain('Rp 21.000')

    // Buka dropdown pelanggan di tab Tunai -> pastikan getCustomerTxCount & sorting tidak error
    await wrapper.find('[title="Sentuh untuk ganti pelanggan"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Bu Tejo')
    expect(wrapper.text()).toContain('2x belanja')

    // 2. Pindah ke tab QRIS -> otomatis uang pas
    const tabButtons = wrapper.findAll('button')
    const qrisTabBtn = tabButtons.find(b => b.text().trim() === 'QRIS')
    expect(qrisTabBtn).toBeTruthy()
    await qrisTabBtn.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Non-Tunai (Otomatis Pas)')
    expect(wrapper.text()).toContain('Pembayaran QRIS (Uang Pas)')
    expect(wrapper.text()).toContain('Konfirmasi Bayar QRIS')
    const confirmQrisBtn = wrapper.findAll('button').find(b => b.text().includes('Konfirmasi Bayar QRIS'))
    await confirmQrisBtn.trigger('click')
    expect(wrapper.emitted('processQrisPayment')?.[0]?.[0]?.totalAmount).toBe(29000)

    // 3. Pindah ke tab Utang / Bon -> bug lama melempar ReferenceError getCustomerTxCount!
    const debtTabBtn = wrapper.findAll('button').find(b => b.text().includes('Utang / Bon'))
    await debtTabBtn.trigger('click')
    await nextTick()

    // Modal tetap tampil & daftar pelanggan non-Umum terender dengan frekuensi belanja
    expect(wrapper.text()).toContain('Pilih Pelanggan Tersimpan:')
    expect(wrapper.text()).toContain('Bu Tejo')
    expect(wrapper.text()).toContain('2x')
    expect(wrapper.text()).toContain('Catat ke Buku Utang')

    // Ketik "Umum" -> peringatan muncul & submit nonaktif
    const debtInput = wrapper.find('input[placeholder="Ketik nama pelanggan..."]')
    await debtInput.setValue('Umum')
    await nextTick()
    expect(wrapper.text()).toContain('khusus transaksi tunai')
    const submitDebtBtn = wrapper.findAll('button').find(b => b.text().includes('Catat ke Buku Utang'))
    expect(submitDebtBtn.attributes('disabled')).toBeDefined()

    // Kosongkan ketikan -> daftar pelanggan tersimpan muncul lagi -> pilih Bu Tejo
    await debtInput.setValue('')
    await nextTick()
    const buTejoCard = wrapper.findAll('button').find(b => b.text().includes('Bu Tejo') && b.text().includes('Sisa Bon'))
    expect(buTejoCard).toBeTruthy()
    await buTejoCard.trigger('click')
    await submitDebtBtn.trigger('click')
    expect(wrapper.emitted('processDebtPayment')?.[0]?.[0]?.customer?.name).toBe('Bu Tejo')

    // Tutup & buka kembali modal tetap berfungsi normal
    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    await nextTick()
    expect(wrapper.text()).toContain('Selesaikan Pembayaran')
  })

  it('mounts LazyInventoryModal, ProductManagementModal, and SettingsModal tabs cleanly without runtime errors', async () => {
    const lazy = mount(LazyInventoryModal, {
      props: { isOpen: true, scannedBarcode: '89912345', categories: ['Sembako', 'Makanan'] }
    })
    expect(lazy.text()).toContain('89912345')

    const prodManage = mount(ProductManagementModal, {
      props: {
        isOpen: true,
        products: [{ id: 1, name: 'Beras 5kg', barcode: '8991', sellPrice: 68000, buyPrice: 63000, category: 'Sembako', isMacro: true }],
        categories: ['Sembako', 'Makanan']
      }
    })
    expect(prodManage.text()).toContain('Beras 5kg')

    const settings = mount(SettingsModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Habiba Store', owner: 'Habiba', phone: '081234567890' },
        totalTransactionCount: 10,
        olderTransactionCount: 2,
        productCount: 38,
        customerCount: 5,
        getArchivableSummary: async () => ({ txCount: 2, payCount: 1, cutoffTimestamp: Date.now() })
      }
    })
    const backupTab = settings.findAll('button').find(b => b.text().includes('Pencadangan'))
    expect(backupTab).toBeTruthy()
    await backupTab.trigger('click')
    await nextTick()
    expect(settings.text()).toContain('Kesehatan & Arsip Data Tahunan')
  })

  it('handles Tunai vs QRIS debt repayment validation cleanly in DebtBookModal', async () => {
    const wrapper = mount(DebtBookModal, {
      props: {
        isOpen: true,
        customers: sampleCustomers,
        transactions: sampleTransactions,
        storeName: 'Habiba Store'
      }
    })

    const bayarBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Bayar')
    await bayarBtn.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Metode Pembayaran Bon:')
    const qrisPayTab = wrapper.findAll('button').find(b => b.text().includes('QRIS (Non-Tunai)'))
    await qrisPayTab.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Pelunasan Non-Tunai QRIS')

    // Ketik melebihi sisa bon saat QRIS -> tombol Simpan disabled & peringatan muncul
    const amountInput = wrapper.find('input[placeholder="0"]')
    await amountInput.setValue('50000')
    await nextTick()
    expect(wrapper.text()).toContain('QRIS maksimal sebesar sisa bon')
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Simpan Bayar QRIS'))
    expect(saveBtn.attributes('disabled')).toBeDefined()

    // Klik Pas-kan -> kembali 45000 dan emit recordPayment dengan paymentMethod: 'QRIS'
    const exactBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Pas-kan')
    await exactBtn.trigger('click')
    await saveBtn.trigger('click')
    expect(wrapper.emitted('recordPayment')?.[0]?.[0]).toEqual({
      customerId: 2,
      amount: 45000,
      paymentMethod: 'QRIS'
    })
  })

  it('renders ReceiptModal, DailyReportModal, and CustomerManagementModal cleanly across QRIS/Debt states', async () => {
    const receiptQris = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Habiba Store', phone: '081234567890' },
        receiptData: {
          invoiceNumber: 'QRS-101',
          time: '12:00',
          totalAmount: 30000,
          paymentMethod: 'QRIS',
          cashGiven: 30000,
          changeAmount: 0,
          customer: { name: 'Umum' },
          items: [{ id: 2, name: 'Minyak', sellPrice: 30000, qty: 1 }]
        }
      }
    })
    expect(receiptQris.text()).toContain('LUNAS (NON-TUNAI)')
    expect(receiptQris.text()).not.toContain('DICATAT DI BUKU UTANG')

    const report = mount(DailyReportModal, {
      props: {
        isOpen: true,
        storeName: 'Habiba Store',
        transactions: sampleTransactions,
        stats: {
          todaySales: 55000,
          todayCashSales: 25000,
          todayQrisSales: 30000,
          todayDebtPaid: 0,
          todayCashDrawer: 25000,
          todayQrisTotal: 30000,
          todayProfit: 8000,
          todayNewDebt: 20000,
          transactionCount: 3,
          topProducts: []
        }
      }
    })
    expect(report.text()).toContain('Laci Tunai: Rp 25.000')
    expect(report.text()).toContain('QRIS: Rp 30.000')
    const historyTab = report.findAll('button').find(b => b.text().includes('Riwayat Transaksi'))
    await historyTab.trigger('click')
    expect(report.text()).toContain('QRS-101')
    expect(report.text()).toContain('QRIS')

    const custModal = mount(CustomerManagementModal, {
      props: {
        isOpen: true,
        customers: sampleCustomers,
        transactions: sampleTransactions
      }
    })
    expect(custModal.text()).toContain('Bu Tejo')
    expect(custModal.text()).toContain('2x belanja')
  })

  it('handles TopBar compact dropdown/actions and ExpenseModal / DailyReport expense flows cleanly', async () => {
    const topBar = mount(TopBar, {
      props: {
        storeName: 'Habiba Store',
        totalDebtCount: 2,
        todayTxCount: 5,
        todayExpenseCount: 1
      }
    })

    // Header TopBar harus berada di atas stacking context main workspace & search card
    expect(topBar.find('header').classes()).toContain('z-40')

    // FrequentProductsSection: badge kuantitas berada di dalam batas kartu (tidak overflow keluar)
    const freqSection = mount(FrequentProductsSection, {
      props: {
        frequentProducts: [{ id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, category: 'Sembako' }],
        allProducts: [{ id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, category: 'Sembako' }],
        categories: ['Sembako'],
        cartItems: [{ id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, qty: 2 }]
      }
    })
    const qtyBadge = freqSection.findAll('span').find(s => s.text().trim() === '2×')
    expect(qtyBadge).toBeTruthy()
    expect(qtyBadge.classes()).toContain('top-1.5')
    expect(qtyBadge.classes()).toContain('right-1.5')
    expect(qtyBadge.classes()).not.toContain('-top-1.5')

    // Dropdown Stok & Data pada desktop/tablet membuka pilihan Barang & Pelanggan
    const stokDropdownBtn = topBar.find('button[title="Kelola Barang & Data Pelanggan"]')
    await stokDropdownBtn.trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Kelola Barang')
    expect(topBar.text()).toContain('Data Pelanggan')

    const manageBarangBtn = topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Kelola Barang'))
    await manageBarangBtn.trigger('click')
    expect(topBar.emitted('openProductManage')).toHaveLength(1)

    // Tombol Kas Keluar 1-klik tetap berada di bar utama TopBar
    const kasKeluarBtn = topBar.find('button[title="Kas Keluar"]')
    await kasKeluarBtn.trigger('click')
    expect(topBar.emitted('openExpense')).toHaveLength(1)

    // Mobile drawer menampilkan grup rapi tanpa dropdown
    await topBar.find('button[aria-label="Buka Menu"]').trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Keuangan & Kasir')
    expect(topBar.text()).toContain('Stok & Pelanggan')

    // ExpenseModal: submit kas keluar baru + tampilkan daftar + konfirmasi hapus 2-tap
    const sampleExpenses = [
      {
        id: 501,
        expenseNumber: 'KLR-101',
        createdAt: Date.now(),
        category: 'operasional',
        source: 'TUNAI_LACI',
        amount: 19000,
        note: 'Beli galon',
        deleted: false
      }
    ]
    const expenseModal = mount(ExpenseModal, {
      props: {
        isOpen: true,
        expenses: sampleExpenses,
        stats: {
          todayCashDrawer: 100000,
          todayNetCashDrawer: 81000,
          todayExpensesCash: 19000,
          todayExpensesNonCash: 0,
          todayExpensesTotal: 19000
        }
      }
    })
    expect(expenseModal.text()).toContain('Sisa Tunai Laci')
    expect(expenseModal.text()).toContain('Rp 81.000')
    expect(expenseModal.text()).toContain('KLR-101')

    await expenseModal.findAll('button').find(b => b.text().includes('Tarik / Setor Owner')).trigger('click')
    await expenseModal.findAll('button').find(b => b.text().trim() === 'Non-Tunai (QRIS / Rek)').trigger('click')
    await expenseModal.findAll('button').find(b => b.text().trim() === '50rb').trigger('click')
    await expenseModal.find('input[placeholder*="galon"]').setValue('Setor ke rekening')
    await expenseModal.find('form').trigger('submit.prevent')

    expect(expenseModal.emitted('recordExpense')?.[0]?.[0]).toEqual({
      amount: 50000,
      category: 'prive',
      source: 'NON_TUNAI',
      note: 'Setor ke rekening'
    })

    // Hapus 2-langkah di ExpenseModal
    await expenseModal.find('button[aria-label="Hapus KLR-101"]').trigger('click')
    await nextTick()
    await expenseModal.findAll('button').find(b => b.text().trim() === 'Ya, Hapus').trigger('click')
    expect(expenseModal.emitted('deleteExpense')?.[0]).toEqual([501])

    // DailyReportModal menampilkan tab Kas Keluar & memicu openExpense
    const reportWithExpenses = mount(DailyReportModal, {
      props: {
        isOpen: true,
        storeName: 'Habiba Store',
        transactions: sampleTransactions,
        expenses: sampleExpenses,
        stats: {
          todaySales: 55000,
          todayCashSales: 25000,
          todayQrisSales: 30000,
          todayDebtPaid: 0,
          todayCashDrawer: 25000,
          todayExpensesCash: 19000,
          todayExpensesNonCash: 0,
          todayExpensesTotal: 19000,
          todayOperationalExpenses: 19000,
          todayNetCashDrawer: 6000,
          todayGrossProfit: 8000,
          todayQrisTotal: 30000,
          todayProfit: -11000,
          todayNewDebt: 20000,
          transactionCount: 3,
          topProducts: []
        }
      }
    })
    expect(reportWithExpenses.text()).toContain('Sisa Laci: Rp 6.000')
    await reportWithExpenses.findAll('button').find(b => b.text().includes('Kas Keluar (1)')).trigger('click')
    await nextTick()
    expect(reportWithExpenses.text()).toContain('Beli galon')
    await reportWithExpenses.findAll('button').find(b => b.text().includes('Catat Kas Keluar')).trigger('click')
    expect(reportWithExpenses.emitted('openExpense')).toHaveLength(1)
  })
})
