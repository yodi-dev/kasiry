// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PaymentModal from '../src/components/PaymentModal.vue'
import DebtBookModal from '../src/components/DebtBookModal.vue'
import ReceiptModal from '../src/components/ReceiptModal.vue'
import DailyReportModal from '../src/components/DailyReportModal.vue'
import ExpenseModal from '../src/components/ExpenseModal.vue'
import RestockModal from '../src/components/RestockModal.vue'
import ShiftModal from '../src/components/ShiftModal.vue'
import CartSection from '../src/components/CartSection.vue'
import FrequentProductsSection from '../src/components/FrequentProductsSection.vue'
import TopBar from '../src/components/TopBar.vue'
import BarcodeInputBar from '../src/components/BarcodeInputBar.vue'
import CustomerManagementModal from '../src/components/CustomerManagementModal.vue'
import LazyInventoryModal from '../src/components/LazyInventoryModal.vue'
import ProductManagementModal from '../src/components/ProductManagementModal.vue'
import SettingsModal from '../src/components/SettingsModal.vue'
import CashServiceModal from '../src/components/CashServiceModal.vue'
import DigitalProductModal from '../src/components/DigitalProductModal.vue'
import FinanceModal from '../src/components/FinanceModal.vue'
import { APP_BRAND_NAME, APP_BRAND_TAGLINE, DEFAULT_DOCUMENT_TITLE, formatDocumentTitle, getStoreInitials } from '../src/utils/branding'

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

    // Ketik 0 -> KPI berubah ke Uang Masih Kurang; ketik kurang (>0) -> Masuk Buku Utang; ketik lebih -> Uang Kembalian
    const cashInput = wrapper.find('input[placeholder="0"]')
    await cashInput.setValue('0')
    await nextTick()
    expect(wrapper.text()).toContain('Uang Masih Kurang:')
    expect(wrapper.text()).toContain('Rp 29.000')

    await cashInput.setValue('20000')
    await nextTick()
    expect(wrapper.text()).toContain('Masuk Buku Utang:')
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

    // Dropdown Layanan Konter di TopBar membuka Pulsa/PLN & Tarik Tunai
    const layananDropdownBtn = topBar.find('button[title="Pulsa, Token PLN & Tarik Tunai"]')
    await layananDropdownBtn.trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Pulsa & Token PLN')
    expect(topBar.text()).toContain('Tarik Tunai & Transfer')
    expect(topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Kas Keluar'))).toBeUndefined()

    // Dropdown Keuangan di TopBar membuka Manajemen Keuangan, Buku Utang, & Kas Keluar
    const financeDropdownBtn = topBar.find('button[title="Keuangan, Buku Utang & Kas Keluar"]')
    await financeDropdownBtn.trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Manajemen Keuangan & Tabungan')
    expect(topBar.text()).toContain('Buku Utang')
    const kasKeluarItem = topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Kas Keluar'))
    await kasKeluarItem.trigger('click')
    expect(topBar.emitted('openExpense')).toHaveLength(1)

    // Uji Buku Utang dari dropdown Keuangan
    await financeDropdownBtn.trigger('click')
    await nextTick()
    const debtBookItem = topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Buku Utang'))
    await debtBookItem.trigger('click')
    expect(topBar.emitted('openDebtBook')).toHaveLength(1)

    // Mobile drawer menampilkan grup rapi tanpa dropdown
    await topBar.find('button[aria-label="Buka Menu"]').trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Shift & Layanan Konter')
    expect(topBar.text()).toContain('Keuangan & Laporan')
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

    await expenseModal.findAll('button').find(b => b.text().includes('Ambil Kas Laci')).trigger('click')
    await expenseModal.findAll('button').find(b => b.text().trim() === 'Non-Tunai').trigger('click')
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
        shifts: [
          {
            id: 91,
            shiftCode: 'SHF-91',
            cashierName: 'Habiba',
            status: 'CLOSED',
            openedAt: Date.now() - 7200000,
            closedAt: Date.now() - 3600000,
            openingCash: 100000,
            expectedCash: 125000,
            actualCash: 125000,
            cashDifference: 0,
            summary: { todayCashDrawer: 25000, todayExpensesCash: 0, todayQrisTotal: 30000 }
          }
        ],
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

    await reportWithExpenses.findAll('button').find(b => b.text().includes('Shift (1)')).trigger('click')
    await nextTick()
    expect(reportWithExpenses.text()).toContain('SHF-91')
    expect(reportWithExpenses.text()).toContain('Pas ✓')

    // ShiftModal: Mode Buka Shift, Mode Tutup Shift (selisih), & Mode Summary
    const shiftOpenModal = mount(ShiftModal, {
      props: {
        isOpen: true,
        activeShift: null,
        completedShift: null,
        defaultCashierName: 'Habiba',
        lastOpeningCash: 100000,
        unassignedTodayCount: 2,
        isAutoPrompt: true
      }
    })
    expect(shiftOpenModal.text()).toContain('Sertakan 2 catatan hari ini')
    await shiftOpenModal.findAll('button').find(b => b.text().trim() === '200rb').trigger('click')
    await shiftOpenModal.find('form').trigger('submit.prevent')
    expect(shiftOpenModal.emitted('openShift')?.[0]?.[0]).toEqual({
      cashierName: 'Habiba',
      openingCash: 200000,
      adoptUnassignedToday: true
    })
    await shiftOpenModal.findAll('button').find(b => b.text().includes('Nanti Saja')).trigger('click')
    expect(shiftOpenModal.emitted('dismissPrompt')).toHaveLength(1)

    const runningShift = {
      id: 92,
      shiftCode: 'SHF-92',
      cashierName: 'Habiba',
      openedAt: Date.now() - 86400000,
      openingCash: 200000,
      status: 'OPEN'
    }
    const shiftCloseModal = mount(ShiftModal, {
      props: {
        isOpen: true,
        activeShift: runningShift,
        isActiveShiftStale: true,
        transactions: sampleTransactions.map(t => ({ ...t, shiftId: 92, shiftCode: 'SHF-92' })),
        debtPayments: [],
        expenses: sampleExpenses.map(e => ({ ...e, shiftId: 92, shiftCode: 'SHF-92' }))
      }
    })
    expect(shiftCloseModal.text()).toContain('Shift kemarin masih terbuka!')
    // Seharusnya di laci = 200.000 modal + 25.000 tunai - 19.000 keluar laci = 206.000
    expect(shiftCloseModal.text()).toContain('Rp 206.000')
    await shiftCloseModal.findAll('button').find(b => b.text().includes('Pas (Sesuai Sistem)')).trigger('click')
    await nextTick()
    expect(shiftCloseModal.text()).toContain('Pas / Cocok ✓ (Rp 0)')
    await shiftCloseModal.find('form').trigger('submit.prevent')
    expect(shiftCloseModal.emitted('closeShift')?.[0]?.[0]).toEqual({
      shiftId: 92,
      actualCash: 206000,
      closingNote: '',
      handoverToKasAmount: 0
    })

    // Summary mode setelah ditutup
    await shiftCloseModal.setProps({
      activeShift: null,
      completedShift: {
        ...runningShift,
        status: 'CLOSED',
        closedAt: Date.now(),
        expectedCash: 206000,
        actualCash: 206000,
        cashDifference: 0,
        summary: { todayCashDrawer: 25000, todayExpensesCash: 19000, todayQrisTotal: 30000, todayProfit: -11000 }
      }
    })
    await nextTick()
    expect(shiftCloseModal.text()).toContain('Shift Berhasil Ditutup')
    await shiftCloseModal.findAll('button').find(b => b.text().includes('Buka Shift Baru')).trigger('click')
    expect(shiftCloseModal.emitted('startNextShift')).toHaveLength(1)
  })

  it('handles CartSection tier switching, inline manual price editing, and Payment/Receipt multi-tier display', async () => {
    const cart = mount(CartSection, {
      props: {
        cartPriceTier: 'ecer',
        totalAmount: 3500,
        totalCount: 1,
        cartItems: [{
          id: 50,
          name: 'Indomie Goreng',
          sellPrice: 3500,
          baseSellPrice: 3500,
          wholesalePrice: 3200,
          wholesaleMinQty: 5,
          agentPrice: 3000,
          qty: 1,
          priceMode: 'auto',
          appliedTier: 'ecer',
          tierLabel: 'Ecer'
        }]
      }
    })

    // 1. Ganti harga nota seluruh keranjang ke Agen
    const tierGroup = cart.find('[role="group"][aria-label="Level Harga Keranjang"]')
    await tierGroup.findAll('button').find(b => b.text().trim() === 'Agen').trigger('click')
    expect(cart.emitted('changePriceTier')?.[0]).toEqual(['agen'])

    // 2. Buka inline editor harga satuan & simpan manual menjadi Harga Grosir katalog
    const unitBtn = cart.findAll('button').find(b => b.text().includes('Rp 3.500') && b.text().includes('Ecer'))
    await unitBtn.trigger('click')
    await nextTick()
    expect(cart.text()).toContain('Atur Harga: Indomie Goreng')

    const manualInput = cart.find('input[aria-label="Harga manual satuan"]')
    await manualInput.setValue('3100')
    await cart.findAll('button').find(b => b.text().trim() === 'Jadi Grosir').trigger('click')
    await cart.findAll('button').find(b => b.text().trim() === 'Pakai').trigger('click')

    expect(cart.emitted('updateItemPrice')?.[0]?.[0]).toEqual({
      productId: 50,
      priceMode: 'manual',
      customPrice: 3100,
      saveToCatalogTier: 'grosir'
    })

    // 3. PaymentModal meneruskan level harga pelanggan saat dipilih
    const agenCustomers = [
      { id: 1, name: 'Umum', phone: '', totalDebt: 0, priceTier: 'ecer' },
      { id: 8, name: 'Warung Jaya', phone: '08199', totalDebt: 0, priceTier: 'agen' }
    ]
    const payModal = mount(PaymentModal, {
      props: {
        isOpen: true,
        totalAmount: 35000,
        cartPriceTier: 'ecer',
        savedCustomers: agenCustomers,
        transactions: []
      }
    })
    await payModal.find('[title="Sentuh untuk ganti pelanggan"]').trigger('click')
    await nextTick()
    const agenCustBtn = payModal.findAll('button').find(b => b.text().includes('Warung Jaya'))
    expect(agenCustBtn.text()).toContain('Agen')
    await agenCustBtn.trigger('click')
    expect(payModal.emitted('changeCustomerPriceTier')?.[0]?.[0]?.priceTier).toBe('agen')

    // 4. ReceiptModal menampilkan label tier non-ecer pada nota
    const receiptGrosir = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Habiba Store', phone: '081234567890' },
        receiptData: {
          invoiceNumber: 'KSR-777',
          time: '10:00',
          totalAmount: 16000,
          paymentMethod: 'TUNAI',
          cashGiven: 20000,
          changeAmount: 4000,
          customer: { name: 'Warung Jaya' },
          items: [{ id: 50, name: 'Indomie Goreng', sellPrice: 3200, qty: 5, priceTier: 'grosir', priceLabel: 'Grosir (Auto)' }]
        }
      }
    })
    expect(receiptGrosir.text()).toContain('Grosir (Auto)')
  })

  it('handles TopBar Kulakan Stok action, soft stock badges without blocking clicks, and RestockModal workflows', async () => {
    // 1. TopBar dropdown Stok & Data memuat opsi Kulakan Stok dan emit openRestock
    const topBar = mount(TopBar, {
      props: {
        storeName: 'Habiba Store',
        totalDebtCount: 0,
        todayTxCount: 0,
        todayExpenseCount: 0
      }
    })
    await topBar.find('button[title="Kelola Barang & Data Pelanggan"]').trigger('click')
    await nextTick()
    expect(topBar.text()).toContain('Kulakan Stok')
    const kulakanBtn = topBar.findAll('button').find(b => b.text().includes('Kulakan Stok'))
    await kulakanBtn.trigger('click')
    expect(topBar.emitted('openRestock')).toBeTruthy()

    // 2. FrequentProductsSection menampilkan lencana stok lunak (Habis / Sisa N) tanpa memblokir klik
    const freq = mount(FrequentProductsSection, {
      props: {
        frequentProducts: [
          { id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, category: 'Sembako', stock: 0 },
          { id: 2, name: 'Gula 1kg', sellPrice: 17500, category: 'Sembako', stock: 4 }
        ],
        allProducts: [
          { id: 1, name: 'Gas LPG 3 Kg', sellPrice: 22000, category: 'Sembako', stock: 0 },
          { id: 2, name: 'Gula 1kg', sellPrice: 17500, category: 'Sembako', stock: 4 }
        ],
        categories: ['Sembako'],
        cartItems: []
      }
    })
    expect(freq.text()).toContain('Habis')
    expect(freq.text()).toContain('Sisa 4')
    const gasBtn = freq.findAll('button').find(b => b.text().includes('Gas LPG 3 Kg'))
    await gasBtn.trigger('click')
    expect(freq.emitted('selectProduct')?.[0]?.[0]?.id).toBe(1)

    // 3. ProductManagementModal menampilkan badge Stok pada daftar produk
    const prodModal = mount(ProductManagementModal, {
      props: {
        isOpen: true,
        products: [{ id: 2, name: 'Gula 1kg', sellPrice: 17500, buyPrice: 15000, stock: 4, category: 'Sembako' }],
        categories: ['Sembako']
      }
    })
    expect(prodModal.text()).toContain('Stok: 4')

    // 4. RestockModal: pilih produk, deteksi kenaikan modal, simpan nota kulakan, & hapus di riwayat
    const restock = mount(RestockModal, {
      props: {
        isOpen: true,
        products: [{ id: 10, name: 'Minyak Goreng 1L', sellPrice: 18000, buyPrice: 14500, stock: 2, category: 'Sembako' }],
        restocks: [
          {
            id: 501,
            restockNumber: 'KLK-501',
            createdAt: Date.now(),
            supplierName: 'Agen Maju',
            source: 'TUNAI_LACI',
            totalCost: 72500,
            totalItems: 5,
            items: [{ productId: 10, productName: 'Minyak Goreng 1L', qty: 5, unitBuyPrice: 14500 }],
            deleted: false
          }
        ],
        stats: { todayCashDrawer: 150000, todayNetCashDrawer: 150000, todayExpensesCash: 0 }
      }
    })

    const pickProdBtn = restock.findAll('button').find(b => b.text().includes('Minyak Goreng 1L'))
    expect(pickProdBtn).toBeTruthy()
    await pickProdBtn.trigger('click')
    await nextTick()
    expect(restock.text()).toContain('Daftar Belanja Nota (1 Item)')

    const supplierInput = restock.find('input[placeholder="Misal: Agen Sembako Jaya"]')
    await supplierInput.setValue('Agen Sumber Rezeki')

    const numInputs = restock.findAll('input[type="number"]')
    await numInputs[0].setValue('6')
    await numInputs[1].setValue('15500')
    await nextTick()
    expect(restock.text()).toContain('Modal naik')
    expect(restock.text()).toContain('Ubah Jual:')

    const submitBtn = restock.findAll('button').find(b => b.text().includes('Simpan Nota Kulakan'))
    await submitBtn.trigger('click')
    expect(restock.emitted('recordRestock')?.[0]?.[0]).toEqual({
      supplierName: 'Agen Sumber Rezeki',
      source: 'TUNAI_LACI',
      note: '',
      items: [
        {
          productId: 10,
          productName: 'Minyak Goreng 1L',
          qty: 6,
          unitBuyPrice: 15500,
          trackStock: true,
          newSellPrice: null
        }
      ]
    })

    const historyTab = restock.findAll('button').find(b => b.text().includes('Riwayat Kulakan'))
    await historyTab.trigger('click')
    await nextTick()
    expect(restock.text()).toContain('Agen Maju')
    const trashBtn = restock.find('button[title="Batalkan / Hapus Nota Kulakan"]')
    await trashBtn.trigger('click')
    await nextTick()
    const confirmDelBtn = restock.findAll('button').find(b => b.text().trim() === 'Hapus')
    await confirmDelBtn.trigger('click')
    expect(restock.emitted('deleteRestock')?.[0]?.[0]).toBe(501)
  })

  it('handles unpriced quick pricing, unsold/slow-moving catalog cleanup, autoEdit CartSection, and Settings reset flows', async () => {
    // 1. FrequentProductsSection menampilkan label Atur Harga pada produk Rp 0
    const freqUnpriced = mount(FrequentProductsSection, {
      props: {
        frequentProducts: [{ id: 1, name: 'Indomie Goreng', sellPrice: 0, category: 'Makanan' }],
        allProducts: [{ id: 1, name: 'Indomie Goreng', sellPrice: 0, category: 'Makanan' }],
        categories: ['Makanan'],
        cartItems: []
      }
    })
    expect(freqUnpriced.text()).toContain('Atur Harga')

    // 1b. Desktop Terlaris mendukung 24 produk tanpa memadati layar mobile (idx >= 8 hidden md:flex)
    const freq24 = Array.from({ length: 24 }, (_, idx) => ({
      id: idx + 1,
      name: `Produk Terlaris ${idx + 1}`,
      sellPrice: 5000 + idx * 500,
      category: 'Sembako'
    }))
    const freqDesktop = mount(FrequentProductsSection, {
      props: {
        frequentProducts: freq24,
        allProducts: freq24,
        categories: ['Sembako'],
        cartItems: []
      }
    })
    expect(freqDesktop.text()).toContain('Terlaris(24)')
    const card24 = freqDesktop.findAll('button').find(b => b.text().includes('Produk Terlaris 24'))
    expect(card24.classes()).toContain('hidden')
    expect(card24.classes()).toContain('md:flex')

    // 2. CartSection membuka inline editor otomatis saat item Rp 0 masuk (autoEditProductId)
    const cartAuto = mount(CartSection, {
      props: {
        cartItems: [{
          id: 99,
          name: 'Indomie Goreng',
          sellPrice: 0,
          baseSellPrice: 0,
          qty: 1,
          priceMode: 'auto',
          appliedTier: 'ecer',
          tierLabel: 'Ecer'
        }],
        totalAmount: 0,
        totalCount: 1,
        autoEditProductId: null
      }
    })
    expect(cartAuto.text()).toContain('Isi Harga!')
    await cartAuto.setProps({ autoEditProductId: 99 })
    await nextTick()
    expect(cartAuto.text()).toContain('Atur Harga: Indomie Goreng')

    // 3. ProductManagementModal: filter Belum Harga -> simpan harga inline, filter Belum Terjual & hapus massal
    const now = Date.now()
    const prodManage = mount(ProductManagementModal, {
      props: {
        isOpen: true,
        products: [
          { id: 1, name: 'Beras 5kg', sellPrice: 0, buyPrice: 0, category: 'Sembako' },
          { id: 2, name: 'Snack Pasif', sellPrice: 10000, buyPrice: 8000, category: 'Makanan' },
          { id: 3, name: 'Laku Keras', sellPrice: 5000, buyPrice: 4000, category: 'Minuman' }
        ],
        categories: ['Sembako', 'Makanan', 'Minuman'],
        getProductUsageStats: async () => ({
          unpricedCount: 1,
          neverSoldCount: 2,
          slowMovingCount: 0,
          byId: {
            1: { totalQtySold: 0, txCount: 0, lastSoldAt: null, isUnpriced: true, isNeverSold: true, isSlowMoving: false },
            2: { totalQtySold: 0, txCount: 0, lastSoldAt: null, isUnpriced: false, isNeverSold: true, isSlowMoving: false },
            3: { totalQtySold: 12, txCount: 4, lastSoldAt: now, isUnpriced: false, isNeverSold: false, isSlowMoving: false }
          }
        })
      }
    })
    await nextTick()
    await nextTick()

    const unpricedFilterBtn = prodManage.findAll('button').find(b => b.text().includes('Belum Harga (1)'))
    expect(unpricedFilterBtn).toBeTruthy()
    await unpricedFilterBtn.trigger('click')
    await nextTick()

    const quickInput = prodManage.find('input[aria-label="Harga cepat Beras 5kg"]')
    await quickInput.setValue('68000')
    await prodManage.findAll('button').find(b => b.text().trim() === 'Simpan').trigger('click')
    expect(prodManage.emitted('saveProduct')?.[0]?.[0]).toMatchObject({
      id: 1,
      sellPrice: 68000,
      buyPrice: 54400
    })

    // Pindah ke filter Belum Terjual & uji Pilih Semua + Hapus Terpilih
    const neverSoldBtn = prodManage.findAll('button').find(b => b.text().includes('Belum Terjual'))
    await neverSoldBtn.trigger('click')
    await nextTick()
    const selectAllBtn = prodManage.findAll('button').find(b => b.text().includes('Pilih Semua'))
    await selectAllBtn.trigger('click')
    await nextTick()
    await prodManage.findAll('button').find(b => b.text().includes('Hapus Terpilih')).trigger('click')
    await nextTick()
    await prodManage.findAll('button').find(b => b.text().trim() === 'Ya, Hapus').trigger('click')
    expect(prodManage.emitted('deleteProductsBulk')?.[0]?.[0]).toEqual([2, 1])

    // 4. SettingsModal: tab Printer (58mm/80mm, autoPrint, footer, tes cetak) & reset data
    const settingsReset = mount(SettingsModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', owner: 'Pemilik Toko', phone: '' },
        productCount: 300,
        customerCount: 1
      }
    })
    const printerTab = settingsReset.findAll('button').find(b => b.text().trim() === 'Printer')
    expect(printerTab).toBeTruthy()
    await printerTab.trigger('click')
    await nextTick()
    expect(settingsReset.text()).toContain('Koneksi Printer Thermal ESC/POS')
    expect(settingsReset.text()).toContain('Hubungkan Bluetooth')
    expect(settingsReset.text()).toContain('Hubungkan USB / OTG')
    expect(settingsReset.text()).toContain('Port Serial / COM')
    expect(settingsReset.text()).toContain('58mm (32 Kolom)')
    expect(settingsReset.text()).toContain('80mm (48 Kolom)')
    expect(settingsReset.text()).toContain('Cetak Otomatis Setelah Bayar')
    expect(settingsReset.text()).toContain('Tes Cetak Printer')

    const size80Btn = settingsReset.findAll('button').find(b => b.text().includes('80mm (48 Kolom)'))
    await size80Btn.trigger('click')
    const footerInput = settingsReset.find('#printer-footer-note')
    await footerInput.setValue('Buka 06.00 - 22.00')
    await nextTick()

    const receiptNoPhone80 = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', phone: '' },
        receiptData: {
          invoiceNumber: 'KSR-202',
          time: '08:15',
          totalAmount: 12000,
          paymentMethod: 'TUNAI',
          cashGiven: 20000,
          changeAmount: 8000,
          customer: { name: 'Umum' },
          items: [{ id: 1, name: 'Kopi', sellPrice: 12000, qty: 1 }]
        }
      }
    })
    expect(receiptNoPhone80.text()).not.toContain('WA:')
    expect(receiptNoPhone80.text()).toContain('Buka 06.00 - 22.00')
    expect(receiptNoPhone80.text()).toContain('Kasiry by Awanbeo')
    expect(receiptNoPhone80.html()).toContain('thermal-80mm')

    // Pulihkan preferensi printer default agar tidak memengaruhi skenario lain
    const size58Btn = settingsReset.findAll('button').find(b => b.text().includes('58mm (32 Kolom)'))
    await size58Btn.trigger('click')
    await footerInput.setValue('Terima kasih telah berbelanja!')
    await nextTick()

    const backupTab = settingsReset.findAll('button').find(b => b.text().includes('Pencadangan'))
    await backupTab.trigger('click')
    await nextTick()
    await settingsReset.findAll('button').find(b => b.text().includes('Mulai Toko Kosong')).trigger('click')
    await nextTick()
    await settingsReset.findAll('button').find(b => b.text().includes('Ya, Atur Ulang Sekarang')).trigger('click')
    expect(settingsReset.emitted('resetStoreData')?.[0]).toEqual(['empty'])
  })

  it('guards insufficient drawer cash in CashServiceModal, emits Cara A Tarik Tunai & Transfer, and opens from TopBar', async () => {
    const topBar = mount(TopBar, {
      props: {
        storeName: 'Warung Kasiry',
        todayCashServiceCount: 3
      }
    })
    const navBtn = topBar.find('button[title="Pulsa, Token PLN & Tarik Tunai"]')
    expect(navBtn).toBeTruthy()
    await navBtn.trigger('click')
    await nextTick()
    const cashSvcItem = topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Tarik Tunai & Transfer'))
    await cashSvcItem.trigger('click')
    expect(topBar.emitted('openCashService')).toBeTruthy()

    const modal = mount(CashServiceModal, {
      props: {
        isOpen: true,
        cashServices: [],
        activeShift: { id: 1, shiftCode: 'SHF-CS', openingCash: 100000 },
        stats: {
          isShiftScoped: true,
          openingCash: 100000,
          todayNetCashDrawer: 0,
          expectedCashDrawer: 100000,
          todayCashServiceAdminProfit: 0
        }
      }
    })

    // Tarik Tunai 200rb melebihi saldo laci 100rb -> warning & tombol disabled
    const preset200 = modal.findAll('button').find(b => b.text().trim() === '200rb')
    await preset200.trigger('click')
    await nextTick()
    expect(modal.text()).toContain('Uang tunai di Laci Kasir tidak cukup')
    const saveTarikBtn = modal.findAll('button').find(b => b.text().includes('Simpan Tarik Tunai'))
    expect(saveTarikBtn.attributes('disabled')).toBeDefined()

    // Pilih 50rb (cukup di laci 100rb) -> admin default 5000 -> Cara A Total = 55.000
    const preset50 = modal.findAll('button').find(b => b.text().trim() === '50rb')
    await preset50.trigger('click')
    await nextTick()
    expect(modal.text()).toContain('Rp 55.000')
    expect(saveTarikBtn.attributes('disabled')).toBeUndefined()
    await modal.find('form').trigger('submit')
    expect(modal.emitted('recordCashService')?.[0]?.[0]).toMatchObject({
      type: 'TARIK_TUNAI',
      amount: 50000,
      adminFee: 5000,
      cashSource: 'LACI'
    })

    // Switch ke Transfer / Top-Up (Laci Masuk) -> 100rb + 5rb tidak diblokir laci
    const transferTab = modal.findAll('button').find(b => b.text().includes('Transfer / Top-Up'))
    await transferTab.trigger('click')
    await nextTick()
    const preset100 = modal.findAll('button').find(b => b.text().trim() === '100rb')
    await preset100.trigger('click')
    await nextTick()
    const saveTransferBtn = modal.findAll('button').find(b => b.text().includes('Simpan Transfer / Top-Up'))
    expect(saveTransferBtn.attributes('disabled')).toBeUndefined()
    await modal.find('form').trigger('submit')
    expect(modal.emitted('recordCashService')?.[1]?.[0]).toMatchObject({
      type: 'TRANSFER',
      amount: 100000,
      adminFee: 5000,
      cashSource: 'LACI'
    })

    // ReceiptModal merender struk TARIK TUNAI dengan status SELESAI (bukan Buku Utang)
    const serviceReceipt = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', phone: '' },
        receiptData: {
          invoiceNumber: 'TT-555',
          time: '15:00',
          paymentMethod: 'TARIK TUNAI',
          totalAmount: 55000,
          cashGiven: 50000,
          changeAmount: 0,
          serviceMeta: { type: 'TARIK_TUNAI', amount: 50000, adminFee: 5000, totalPaid: 55000, channel: 'QRIS' },
          items: [
            { id: 1, name: 'Tarik Tunai (QRIS)', qty: 1, sellPrice: 50000 },
            { id: 2, name: 'Biaya Admin Jasa', qty: 1, sellPrice: 5000 }
          ]
        }
      }
    })
    expect(serviceReceipt.text()).toContain('SELESAI (TARIK TUNAI)')
    expect(serviceReceipt.text()).not.toContain('DICATAT DI BUKU UTANG')
  })

  it('handles DigitalProductModal PLN Token SN, remembered preset pricing, Utang customer guard, and ReceiptModal display', async () => {
    localStorage.removeItem('kasiry_digital_presets_v1')

    const topBar = mount(TopBar, {
      props: {
        storeName: 'Warung Kasiry',
        todayDigitalCount: 2
      }
    })
    await topBar.find('button[title="Pulsa, Token PLN & Tarik Tunai"]').trigger('click')
    await nextTick()
    await topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Pulsa & Token PLN')).trigger('click')
    expect(topBar.emitted('openDigitalProduct')).toBeTruthy()

    const modal = mount(DigitalProductModal, {
      props: {
        isOpen: true,
        digitalProducts: [],
        customers: sampleCustomers,
        stats: {
          todayDigitalSales: 52500,
          todayDigitalProfit: 2000
        }
      }
    })

    // Pindah ke kategori Token PLN, isi No. Meter + 20 digit Token Listrik
    await modal.findAll('button').find(b => b.text().includes('Token PLN')).trigger('click')
    await nextTick()
    await modal.findAll('button').find(b => b.text().trim() === '50rb').trigger('click')
    await nextTick()

    const targetInput = modal.find('input[placeholder*="541200889911"]')
    const tokenInput = modal.find('input[placeholder*="20 digit token"]')
    await targetInput.setValue('541200889911')
    await tokenInput.setValue('1234 5678 9012 3456 7890')

    // Ubah harga jual preset 50rb dari 52500 ke 53000 agar diingat otomatis
    const sellInput = modal.find('input[placeholder="12000"]')
    await sellInput.setValue('53000')
    await nextTick()
    expect(modal.text()).toContain('+Rp 2.500')

    await modal.find('form').trigger('submit')
    expect(modal.emitted('recordDigitalProduct')?.[0]?.[0]).toMatchObject({
      category: 'TOKEN_LISTRIK',
      targetNumber: '541200889911',
      tokenCode: '1234 5678 9012 3456 7890',
      sellPrice: 53000,
      paymentMethod: 'TUNAI',
      costSource: 'PIHAK_KETIGA'
    })

    // Verifikasi preset 50rb tersimpan di localStorage dan tampil saat mount ulang
    const modalAgain = mount(DigitalProductModal, {
      props: { isOpen: true, customers: sampleCustomers }
    })
    await modalAgain.findAll('button').find(b => b.text().includes('Token PLN')).trigger('click')
    await nextTick()
    await modalAgain.findAll('button').find(b => b.text().trim() === '50rb').trigger('click')
    await nextTick()
    expect(modalAgain.find('input[placeholder="12000"]').element.value).toBe('53000')

    // Uji metode Utang / Bon memblokir Umum hingga pelanggan dipilih
    await modalAgain.findAll('button').find(b => b.text().includes('Utang / Bon')).trigger('click')
    await nextTick()
    const submitBtn = modalAgain.findAll('button').find(b => b.text().includes('Simpan Transaksi'))
    expect(submitBtn.attributes('disabled')).toBeDefined()

    await modalAgain.findAll('button').find(b => b.text().trim() === 'Bu Tejo').trigger('click')
    await nextTick()
    expect(submitBtn.attributes('disabled')).toBeUndefined()
    await modalAgain.find('form').trigger('submit')
    expect(modalAgain.emitted('recordDigitalProduct')?.[0]?.[0]).toMatchObject({
      paymentMethod: 'UTANG / BON',
      customer: expect.objectContaining({ id: 2, name: 'Bu Tejo' })
    })

    // ReceiptModal menampilkan Token / SN PLN & No. Meter secara jelas
    const digitalReceipt = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', phone: '' },
        receiptData: {
          invoiceNumber: 'PLN-8801',
          time: '19:05',
          paymentMethod: 'TUNAI',
          totalAmount: 53000,
          cashGiven: 53000,
          changeAmount: 0,
          digitalMeta: {
            category: 'TOKEN_LISTRIK',
            provider: 'PLN',
            targetNumber: '541200889911',
            tokenCode: '1234 5678 9012 3456 7890'
          },
          items: [{ id: 1, name: 'Token PLN 50.000', qty: 1, sellPrice: 53000 }]
        }
      }
    })
    expect(digitalReceipt.text()).toContain('541200889911')
    expect(digitalReceipt.text()).toContain('1234 5678 9012 3456 7890')
  })

  it('allows partial Tunai/QRIS payment into Buku Utang when non-Umum customer is selected, and shows shortfall in ReceiptModal', async () => {
    const payModal = mount(PaymentModal, {
      props: {
        isOpen: true,
        totalAmount: 50000,
        savedCustomers: sampleCustomers,
        transactions: sampleTransactions
      }
    })

    // Masukkan nominal kurang (30.000 < 50.000) saat pelanggan masih "Umum" -> tombol disabled & peringatan tampil
    const cashInput = payModal.find('input[placeholder="0"]')
    await cashInput.setValue('30000')
    await nextTick()
    expect(payModal.text()).toContain('Masuk Buku Utang:')
    expect(payModal.text()).toContain('Rp 20.000')
    expect(payModal.text()).toContain('selain "Umum"')
    const submitBtn = payModal.findAll('button').find(b => b.text().includes('Bayar Sebagian & Catat Bon'))
    expect(submitBtn.attributes('disabled')).toBeDefined()

    // Pilih pelanggan "Bu Tejo" -> tombol langsung aktif dan emit paidAmount 30000 + debtAmount 20000
    await payModal.find('div[title="Sentuh untuk ganti pelanggan"]').trigger('click')
    await nextTick()
    await payModal.findAll('button').find(b => b.text().includes('Bu Tejo')).trigger('click')
    await nextTick()
    expect(submitBtn.attributes('disabled')).toBeUndefined()

    await submitBtn.trigger('click')
    expect(payModal.emitted('processCashPayment')?.[0]?.[0]).toMatchObject({
      totalAmount: 50000,
      cashGiven: 30000,
      paidAmount: 30000,
      debtAmount: 20000,
      changeAmount: 0,
      customer: expect.objectContaining({ id: 2, name: 'Bu Tejo' })
    })

    // ReceiptModal menampilkan rincian Dibayar + Masuk Buku Utang
    const partReceipt = mount(ReceiptModal, {
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', phone: '' },
        receiptData: {
          invoiceNumber: 'KSR-PART-1',
          time: '19:40',
          paymentMethod: 'TUNAI (SEBAGIAN BON)',
          totalAmount: 50000,
          paidAmount: 30000,
          debtAmount: 20000,
          cashGiven: 30000,
          changeAmount: 0,
          customer: { id: 2, name: 'Bu Tejo' },
          items: [{ id: 1, name: 'Beras 5kg', qty: 1, sellPrice: 50000 }]
        }
      }
    })
    expect(partReceipt.text()).toContain('MASUK BUKU UTANG')
    expect(partReceipt.text()).toContain('BAYAR SEBAGIAN (BON)')
  })

  it('opens FinanceModal from TopBar, renders 4 pockets + period selector, validates overdraft, and emits Tambah Tabungan & KAS CashService source', async () => {
    // 1. TopBar memiliki dropdown Keuangan yang memuat Manajemen Keuangan & Tabungan (openFinance)
    const topBar = mount(TopBar, {
      props: { storeName: 'Warung Kasiry' }
    })
    const financeNav = topBar.find('button[title="Keuangan, Buku Utang & Kas Keluar"]')
    expect(financeNav.exists()).toBe(true)
    await financeNav.trigger('click')
    await nextTick()
    const financeItem = topBar.findAll('button[role="menuitem"]').find(b => b.text().includes('Manajemen Keuangan & Tabungan'))
    expect(financeItem).toBeTruthy()
    await financeItem.trigger('click')
    expect(topBar.emitted('openFinance')).toBeTruthy()

    // 2. FinanceModal menampilkan 4 kantong saldo, periode, dan form Tambah Tabungan
    const now = Date.now()
    const financeModal = mount(FinanceModal, {
      props: {
        isOpen: true,
        activeShift: { id: 1, shiftCode: 'SHF-KEU', openingCash: 100000, openedAt: now - 5000 },
        stats: {
          isShiftScoped: true,
          openingCash: 100000,
          todayNetCashDrawer: 50000,
          expectedCashDrawer: 150000
        },
        transactions: [],
        debtPayments: [],
        expenses: [],
        cashServices: [],
        digitalProducts: [],
        fundMovements: [
          { id: 1, movementNumber: 'KEU-001', createdAt: now, type: 'SETOR_MODAL', fromAccount: 'LUAR', toAccount: 'KAS', amount: 300000, deleted: false }
        ],
        customers: sampleCustomers
      }
    })

    expect(financeModal.text()).toContain('Rp 150.000') // LACI
    expect(financeModal.text()).toContain('Rp 300.000') // KAS

    // Pindah ke tab Tabungan & Mutasi
    const mutasiTab = financeModal.findAll('button').find(b => b.text().includes('Tabungan & Mutasi'))
    expect(mutasiTab).toBeTruthy()
    await mutasiTab.trigger('click')
    await nextTick()

    // Isi nominal Tambah Tabungan 50rb dari LACI (150rb tersedia) -> submit emit TAMBAH_TABUNGAN
    const amountInput = financeModal.find('input[inputmode="numeric"]')
    await amountInput.setValue('50000')
    await nextTick()
    await financeModal.find('form').trigger('submit')
    expect(financeModal.emitted('recordFundMovement')?.[0]?.[0]).toMatchObject({
      type: 'TAMBAH_TABUNGAN',
      toAccount: 'TABUNGAN',
      amount: 50000
    })

    // 3. CashServiceModal memilih sumber Uang Kas ('KAS')
    const cashModal = mount(CashServiceModal, {
      props: {
        isOpen: true,
        cashServices: [],
        transactions: [],
        debtPayments: [],
        expenses: [],
        digitalProducts: [],
        fundMovements: [
          { id: 1, createdAt: now, type: 'SETOR_MODAL', fromAccount: 'LUAR', toAccount: 'KAS', amount: 300000, deleted: false }
        ],
        customers: sampleCustomers,
        activeShift: { id: 1, shiftCode: 'SHF-KAS', openingCash: 50000 },
        stats: {
          isShiftScoped: true,
          openingCash: 50000,
          todayNetCashDrawer: 0,
          expectedCashDrawer: 50000
        }
      }
    })

    const kasSourceBtn = cashModal.findAll('button').find(b => b.text().includes('Uang Kas'))
    await kasSourceBtn.trigger('click')
    await nextTick()
    // Pilih 200rb -> di Laci tidak cukup (50rb), tapi di Uang Kas cukup (300rb)!
    await cashModal.findAll('button').find(b => b.text().trim() === '200rb').trigger('click')
    await nextTick()
    const submitCashBtn = cashModal.findAll('button').find(b => b.text().includes('Simpan Tarik Tunai'))
    expect(submitCashBtn.attributes('disabled')).toBeUndefined()
    await cashModal.find('form').trigger('submit')
    expect(cashModal.emitted('recordCashService')?.[0]?.[0]).toMatchObject({
      type: 'TARIK_TUNAI',
      cashSource: 'KAS',
      amount: 200000
    })
  })

  it('verifies audit fixes: 5th pocket Saldo Pihak Ketiga, Uang Kas in Expense/Restock, Shift handover, Report Reprint/Void, and Digital Bon in DebtBook', async () => {
    const now = Date.now()
    // 1. FinanceModal menampilkan kantong ke-5 Saldo Pihak Ketiga & shortcut Isi Saldo
    const fin = mount(FinanceModal, {
      props: {
        isOpen: true,
        precomputedPockets: {
          kasBalance: 200000,
          rekeningBalance: 150000,
          tabunganBalance: 100000,
          pihakKetigaBalance: 85000
        },
        customers: sampleCustomers
      }
    })
    expect(fin.text()).toContain('Saldo Pihak Ketiga')
    expect(fin.text()).toContain('Rp 85.000')

    // 2. ExpenseModal menghormati expectedCashDrawer saat shift aktif & menyediakan Uang Kas Toko
    const exp = mount(ExpenseModal, {
      props: {
        isOpen: true,
        activeShift: { id: 1, shiftCode: 'SHF-EXP', status: 'OPEN', openingCash: 100000 },
        stats: {
          isShiftScoped: true,
          openingCash: 100000,
          todayNetCashDrawer: 25000,
          expectedCashDrawer: 125000,
          todayExpensesCash: 0,
          todayExpensesNonCash: 0,
          todayExpensesTotal: 0
        }
      }
    })
    expect(exp.text()).toContain('Rp 125.000')
    await exp.findAll('button').find(b => b.text().trim() === 'Uang Kas').trigger('click')
    await exp.findAll('button').find(b => b.text().trim() === '50rb').trigger('click')
    await exp.find('form').trigger('submit.prevent')
    expect(exp.emitted('recordExpense')?.[0]?.[0]).toMatchObject({
      amount: 50000,
      source: 'KAS'
    })

    // 3. RestockModal menyediakan sumber Uang Kas & menampilkan Sisa Tunai Laci konsisten dg Shift
    const restock = mount(RestockModal, {
      props: {
        isOpen: true,
        products: [{ id: 1, name: 'Beras', buyPrice: 50000, sellPrice: 60000, stock: 5 }],
        stats: {
          isShiftScoped: true,
          openingCash: 100000,
          todayNetCashDrawer: 0,
          expectedCashDrawer: 100000
        }
      }
    })
    expect(restock.text()).toContain('Rp 100.000')
    expect(restock.text()).toContain('Uang Kas')

    // 4. DailyReportModal memicu Cetak Struk & Batalkan -> Ya, Void pada Riwayat Transaksi
    const report = mount(DailyReportModal, {
      props: {
        isOpen: true,
        transactions: [
          {
            id: 777,
            invoiceNumber: 'KSR-RPT1',
            createdAt: now,
            paymentMethod: 'TUNAI',
            totalAmount: 25000,
            items: [{ id: 1, name: 'Beras', sellPrice: 25000, qty: 1 }]
          }
        ]
      }
    })
    await report.findAll('button').find(b => b.text().includes('Riwayat')).trigger('click')
    await nextTick()
    await report.findAll('button').find(b => b.text().includes('Cetak Struk')).trigger('click')
    expect(report.emitted('openReceipt')?.[0]?.[0]?.invoiceNumber).toBe('KSR-RPT1')
    await report.findAll('button').find(b => b.text().includes('Batalkan')).trigger('click')
    await nextTick()
    await report.findAll('button').find(b => b.text().includes('Ya, Void')).trigger('click')
    expect(report.emitted('deleteTransaction')?.[0]?.[0]?.id).toBe(777)

    // 5. DebtBookModal menampilkan rincian utang dari Pulsa / Token Listrik (digitalProducts UTANG / BON)
    const debtModal = mount(DebtBookModal, {
      props: {
        isOpen: true,
        customers: sampleCustomers,
        transactions: [],
        digitalProducts: [
          {
            id: 888,
            digitalNumber: 'PLS-BON1',
            createdAt: now,
            productName: 'Pulsa 20.000',
            targetNumber: '081234567890',
            sellPrice: 22000,
            paymentMethod: 'UTANG / BON',
            customerId: 2,
            customerName: 'Bu Tejo',
            deleted: false
          }
        ]
      }
    })
    await debtModal.findAll('button').find(b => b.text().trim() === 'Bayar').trigger('click')
    await nextTick()
    expect(debtModal.text()).toContain('PLS-BON1')
    expect(debtModal.text()).toContain('Pulsa 20.000')
  })

  it('formats dynamic document title, uses KS fallback initials instead of HS, and unifies drawer footer branding', async () => {
    expect(formatDocumentTitle('')).toBe(DEFAULT_DOCUMENT_TITLE)
    expect(formatDocumentTitle('Warung Kasiry')).toBe(DEFAULT_DOCUMENT_TITLE)
    expect(formatDocumentTitle('Toko Berkah')).toBe(`Toko Berkah — ${APP_BRAND_NAME}`)

    expect(getStoreInitials('')).toBe('KS')
    expect(getStoreInitials('Toko Berkah')).toBe('TO')

    const topBarBlank = mount(TopBar, {
      props: { storeName: '', isGoogleConnected: true }
    })
    expect(topBarBlank.text()).toContain('KS')
    expect(topBarBlank.text()).not.toContain('HS')
    // Pil teks status Cloud/Online dipindah ke dot avatar & Drawer agar header utama tetap ringkas
    expect(topBarBlank.find('header > div').text()).not.toContain('Cloud Aktif')

    await topBarBlank.find('button[aria-label="Buka Menu"]').trigger('click')
    await nextTick()
    expect(topBarBlank.text()).toContain('Cloud Aktif')
    expect(topBarBlank.text()).toContain(APP_BRAND_NAME)
    expect(topBarBlank.text()).toContain(APP_BRAND_TAGLINE)
    expect(topBarBlank.text()).toContain('Kebijakan Privasi')
    expect(topBarBlank.text()).toContain('Ketentuan Layanan')
  })

  it('supports ArrowDown, ArrowUp, Enter, and Escape keyboard navigation on BarcodeInputBar search results', async () => {
    const searchResults = [
      { id: 101, name: 'Beras Ramos 5 Kg', sellPrice: 72000, barcode: '8991001' },
      { id: 102, name: 'Beras Pandan Wangi 5 Kg', sellPrice: 82000, barcode: '8991002' },
      { id: 103, name: 'Beras Merah 1 Kg', sellPrice: 24000, barcode: '8991003' }
    ]
    const bar = mount(BarcodeInputBar, {
      props: {
        variant: 'inline',
        searchQuery: 'Beras',
        searchResults
      }
    })

    const input = bar.find('input[role="combobox"]')
    expect(input.attributes('aria-activedescendant')).toBe('search-option-inline-0')

    // ArrowDown -> pindah ke item kedua (index 1)
    await input.trigger('keydown.down')
    await nextTick()
    expect(input.attributes('aria-activedescendant')).toBe('search-option-inline-1')

    // ArrowDown 2x -> wrap ke index 0
    await input.trigger('keydown.down')
    await input.trigger('keydown.down')
    await nextTick()
    expect(input.attributes('aria-activedescendant')).toBe('search-option-inline-0')

    // ArrowUp dari index 0 -> wrap ke item terakhir (index 2), lalu Enter memilih item ke-3
    await input.trigger('keydown.up')
    await nextTick()
    expect(input.attributes('aria-activedescendant')).toBe('search-option-inline-2')

    await input.trigger('keydown.enter')
    expect(bar.emitted('selectProduct')?.[0]?.[0]?.id).toBe(103)
    expect(bar.emitted('update:searchQuery')?.[0]).toEqual([''])
  })

  it('supports Enter (instant uang pas checkout) and Escape (sub-dropdown -> modal close) in PaymentModal', async () => {
    const payModal = mount(PaymentModal, {
      attachTo: document.body,
      props: {
        isOpen: true,
        totalAmount: 25000,
        savedCustomers: sampleCustomers,
        transactions: []
      }
    })
    await nextTick()

    // 1. Tekan Enter langsung saat modal terbuka -> otomatis bayar uang pas Rp 25.000 pelanggan Umum
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(payModal.emitted('processCashPayment')).toHaveLength(1)
    expect(payModal.emitted('processCashPayment')[0][0]).toMatchObject({
      totalAmount: 25000,
      cashGiven: 25000,
      changeAmount: 0
    })

    // 2. Jika form Tambah Pelanggan cepat terbuka, Esc menutup form tersebut dulu, Esc kedua menutup modal
    await payModal.find('button[title="Daftarkan pelanggan baru langsung di sini"]').trigger('click')
    await nextTick()
    expect(payModal.text()).toContain('Tambah Pelanggan Baru')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(payModal.text()).not.toContain('Tambah Pelanggan Baru')
    expect(payModal.emitted('close')).toBeFalsy()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(payModal.emitted('close')).toHaveLength(1)

    // 3. Alt+2 pindah ke QRIS, Alt+3 ke Utang, F9 balik ke Tunai dan fokus ke input nominal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }))
    await nextTick()
    expect(payModal.text()).toContain('Konfirmasi Bayar QRIS')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', altKey: true, bubbles: true }))
    await nextTick()
    expect(payModal.text()).toContain('Catat ke Buku Utang')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }))
    await nextTick()
    expect(payModal.text()).toContain('Uang Diterima dari Pembeli')

    payModal.unmount()
  })

  it('supports Enter (print receipt) and Escape (newTransaction) keyboard shortcuts in ReceiptModal', async () => {
    const printSpy = vi.fn()
    window.print = printSpy

    const receiptModal = mount(ReceiptModal, {
      attachTo: document.body,
      props: {
        isOpen: true,
        storeProfile: { name: 'Warung Kasiry', phone: '' },
        receiptData: {
          invoiceNumber: 'KSR-KEY-1',
          time: '10:15',
          totalAmount: 15000,
          cashGiven: 20000,
          changeAmount: 5000,
          paymentMethod: 'TUNAI',
          items: [{ name: 'Gula 1 Kg', qty: 1, sellPrice: 15000 }]
        }
      }
    })
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(printSpy).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(receiptModal.emitted('newTransaction')).toHaveLength(1)

    receiptModal.unmount()
  })

  it('supports 2-tap customer delete and 2-tap void of goods/digital bon notes in DebtBookModal', async () => {
    const now = Date.now()
    const debtModal = mount(DebtBookModal, {
      props: {
        isOpen: true,
        customers: sampleCustomers,
        transactions: [
          {
            id: 701,
            invoiceNumber: 'UTG-701',
            createdAt: now,
            paymentMethod: 'UTANG / BON',
            customerId: 2,
            customerName: 'Bu Tejo',
            totalAmount: 23000,
            debtAmount: 23000,
            items: [{ id: 1, name: 'Minyak 1L', qty: 1, sellPrice: 23000 }]
          }
        ],
        digitalProducts: [
          {
            id: 702,
            digitalNumber: 'PLS-702',
            createdAt: now - 1000,
            productName: 'Pulsa 20.000',
            targetNumber: '081234567891',
            sellPrice: 22000,
            paymentMethod: 'UTANG / BON',
            customerId: 2,
            customerName: 'Bu Tejo',
            deleted: false
          }
        ]
      }
    })

    // 1. 2-tap hapus pelanggan dari daftar Buku Utang
    const delBtn = debtModal.find('button[aria-label="Hapus Bu Tejo"]')
    await delBtn.trigger('click')
    expect(debtModal.emitted('deleteCustomer')).toBeFalsy()
    expect(delBtn.text()).toContain('Hapus Bon?')

    // Buka detail pembayaran bon sebelum hapus untuk uji void nota bon
    await debtModal.findAll('button').find(b => b.text().trim() === 'Bayar').trigger('click')
    await nextTick()

    const voidButtons = debtModal.findAll('button').filter(b => b.text().trim() === 'Hapus')
    expect(voidButtons).toHaveLength(2)

    // Void nota barang (UTG-701) 2-tap
    await voidButtons[0].trigger('click')
    expect(debtModal.emitted('deleteTransaction')).toBeFalsy()
    await voidButtons[0].trigger('click')
    expect(debtModal.emitted('deleteTransaction')?.[0]?.[0]?.id).toBe(701)

    // Void nota pulsa (PLS-702) 2-tap
    await voidButtons[1].trigger('click')
    expect(debtModal.emitted('deleteDigitalProduct')).toBeFalsy()
    await voidButtons[1].trigger('click')
    expect(debtModal.emitted('deleteDigitalProduct')?.[0]).toEqual([702])

    // Kembali ke daftar & konfirmasi tap ke-2 hapus pelanggan
    await debtModal.findAll('button').find(b => b.text().includes('Kembali ke Buku Utang')).trigger('click')
    await nextTick()
    const delBtnAgain = debtModal.find('button[aria-label="Hapus Bu Tejo"]')
    await delBtnAgain.trigger('click')
    expect(debtModal.emitted('deleteCustomer')?.[0]).toEqual([2])
  })
})
