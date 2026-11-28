// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import OwnerPinModal from '../src/components/OwnerPinModal.vue'
import TopBar from '../src/components/TopBar.vue'

describe('useOwnerLock & OwnerPinModal (Proteksi Omzet, Hapus & Reset)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('allows actions freely when PIN is disabled, gates protected actions when enabled, and supports unlock/lock', async () => {
    const { useOwnerLock } = await import('../src/composables/useOwnerLock')
    const lock = useOwnerLock()

    // 1. Default nonaktif -> langsung eksekusi tanpa modal PIN
    expect(lock.isPinEnabled.value).toBe(false)
    let called = 0
    lock.requireOwnerAuth(() => { called += 1 }, 'buka laporan')
    expect(called).toBe(1)
    expect(lock.isPinModalOpen.value).toBe(false)

    // 2. Aktifkan PIN minimal 4 karakter & simpan hash
    const badRes = await lock.setOwnerPin('12')
    expect(badRes.ok).toBe(false)

    const okRes = await lock.setOwnerPin('1234')
    expect(okRes.ok).toBe(true)
    expect(lock.isPinEnabled.value).toBe(true)
    expect(localStorage.getItem('kasiry_owner_pin_hash')).toBeTruthy()
    expect(localStorage.getItem('kasiry_owner_pin_hash')).not.toBe('1234')

    // 3. Kunci manual -> aksi sensitif ditahan dan membuka OwnerPinModal
    lock.lockOwnerMode()
    expect(lock.isOwnerUnlocked.value).toBe(false)
    let protectedDone = false
    lock.requireOwnerAuth(() => { protectedDone = true }, 'melihat Laporan Kasir & Omzet')
    expect(protectedDone).toBe(false)
    expect(lock.isPinModalOpen.value).toBe(true)

    // 4. PIN salah ditolak; PIN benar membuka kunci dan otomatis mengeksekusi aksi tertunda
    expect(await lock.verifyAndUnlock('9999')).toBe(false)
    expect(lock.pinModalError.value).toContain('salah')
    expect(protectedDone).toBe(false)

    expect(await lock.verifyAndUnlock('1234')).toBe(true)
    expect(lock.isPinModalOpen.value).toBe(false)
    expect(lock.isOwnerUnlocked.value).toBe(true)
    expect(protectedDone).toBe(true)

    // 5. Nonaktifkan PIN wajib memasukkan sandi lama yang benar
    expect((await lock.disableOwnerPin('0000')).ok).toBe(false)
    expect((await lock.disableOwnerPin('1234')).ok).toBe(true)
    expect(lock.isPinEnabled.value).toBe(false)
  })

  it('renders OwnerPinModal and TopBar lock/unlock controls cleanly', async () => {
    const pinModal = mount(OwnerPinModal, {
      props: {
        isOpen: true,
        reason: 'menghapus transaksi',
        errorMessage: 'PIN salah'
      }
    })
    expect(pinModal.text()).toContain('Verifikasi Sandi Pemilik')
    expect(pinModal.text()).toContain('menghapus transaksi')
    expect(pinModal.text()).toContain('PIN salah')

    await pinModal.find('input').setValue('5678')
    await pinModal.find('form').trigger('submit.prevent')
    expect(pinModal.emitted('submit')?.[0]).toEqual(['5678'])

    const topBarLocked = mount(TopBar, {
      props: {
        storeName: 'Warung Kasiry',
        isOwnerPinEnabled: true,
        isOwnerUnlocked: false
      }
    })
    await topBarLocked.find('button[aria-label="Buka Mode Pemilik"]').trigger('click')
    expect(topBarLocked.emitted('unlockOwner')).toHaveLength(1)

    const topBarUnlocked = mount(TopBar, {
      props: {
        storeName: 'Warung Kasiry',
        isOwnerPinEnabled: true,
        isOwnerUnlocked: true
      }
    })
    await nextTick()
    await topBarUnlocked.find('button[aria-label="Kunci Mode Pemilik"]').trigger('click')
    expect(topBarUnlocked.emitted('lockOwner')).toHaveLength(1)
  })
})
