import { ref, computed } from 'vue'

const PIN_HASH_STORAGE_KEY = 'kasiry_owner_pin_hash'
const PIN_SALT = 'kasiry-owner-v1:'
const UNLOCK_DURATION_MS = 15 * 60 * 1000 // 15 menit sesi pemilik terbuka

function loadStoredPinHash() {
  try {
    if (typeof localStorage === 'undefined') return ''
    return localStorage.getItem(PIN_HASH_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

const storedPinHash = ref(loadStoredPinHash())
const isOwnerUnlocked = ref(false)
const unlockedUntil = ref(0)

const isPinModalOpen = ref(false)
const pinModalReason = ref('')
const pinModalError = ref('')
let pendingOwnerAction = null

/**
 * Hash PIN/kata sandi secara deterministik dengan SHA-256 (Web Crypto API + fallback aman).
 */
export async function hashOwnerPin(rawPin = '') {
  const input = `${PIN_SALT}${String(rawPin)}`
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    const encoded = new TextEncoder().encode(input)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback FNV-1a 64-bit pseudo-hex jika crypto.subtle tidak tersedia di context HTTP non-localhost
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0
  }
  return `fb-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

export function useOwnerLock() {
  const isPinEnabled = computed(() => Boolean(storedPinHash.value))

  const hasActiveUnlockSession = () => {
    if (!isPinEnabled.value) return true
    if (!isOwnerUnlocked.value) return false
    if (Date.now() > unlockedUntil.value) {
      isOwnerUnlocked.value = false
      unlockedUntil.value = 0
      return false
    }
    return true
  }

  const lockOwnerMode = () => {
    isOwnerUnlocked.value = false
    unlockedUntil.value = 0
  }

  const unlockSession = () => {
    isOwnerUnlocked.value = true
    unlockedUntil.value = Date.now() + UNLOCK_DURATION_MS
  }

  const setOwnerPin = async (newPin, currentPin = '') => {
    const cleanNew = String(newPin || '').trim()
    if (cleanNew.length < 4) {
      return { ok: false, error: 'PIN / kata sandi minimal 4 karakter atau angka.' }
    }

    if (storedPinHash.value) {
      const currentHash = await hashOwnerPin(String(currentPin || '').trim())
      if (currentHash !== storedPinHash.value) {
        return { ok: false, error: 'PIN / kata sandi saat ini salah.' }
      }
    }

    const nextHash = await hashOwnerPin(cleanNew)
    storedPinHash.value = nextHash
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PIN_HASH_STORAGE_KEY, nextHash)
      }
    } catch {
      // Abaikan jika storage penuh
    }
    unlockSession()
    return { ok: true }
  }

  const disableOwnerPin = async (currentPin) => {
    if (!storedPinHash.value) return { ok: true }
    const currentHash = await hashOwnerPin(String(currentPin || '').trim())
    if (currentHash !== storedPinHash.value) {
      return { ok: false, error: 'PIN / kata sandi saat ini salah.' }
    }
    storedPinHash.value = ''
    lockOwnerMode()
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PIN_HASH_STORAGE_KEY)
      }
    } catch {
      // Abaikan
    }
    return { ok: true }
  }

  const requireOwnerAuth = (actionCallback, reason = 'mengakses fitur terlindungi') => {
    if (hasActiveUnlockSession()) {
      return typeof actionCallback === 'function' ? actionCallback() : undefined
    }
    pendingOwnerAction = typeof actionCallback === 'function' ? actionCallback : null
    pinModalReason.value = reason
    pinModalError.value = ''
    isPinModalOpen.value = true
    return undefined
  }

  const verifyAndUnlock = async (pinInput) => {
    const clean = String(pinInput || '').trim()
    if (!clean) {
      pinModalError.value = 'Masukkan PIN atau kata sandi pemilik terlebih dahulu.'
      return false
    }
    const candidateHash = await hashOwnerPin(clean)
    if (candidateHash !== storedPinHash.value) {
      pinModalError.value = 'PIN / kata sandi salah. Silakan coba lagi.'
      return false
    }

    unlockSession()
    isPinModalOpen.value = false
    pinModalError.value = ''
    const cb = pendingOwnerAction
    pendingOwnerAction = null
    if (typeof cb === 'function') {
      await cb()
    }
    return true
  }

  const cancelOwnerAuth = () => {
    isPinModalOpen.value = false
    pinModalError.value = ''
    pendingOwnerAction = null
  }

  return {
    isPinEnabled,
    isOwnerUnlocked,
    isPinModalOpen,
    pinModalReason,
    pinModalError,
    hasActiveUnlockSession,
    setOwnerPin,
    disableOwnerPin,
    lockOwnerMode,
    requireOwnerAuth,
    verifyAndUnlock,
    cancelOwnerAuth
  }
}
