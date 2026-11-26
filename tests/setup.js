import 'fake-indexeddb/auto'

// In-memory localStorage mock bersih per suite/test (dapat di-clear via localStorage.clear())
const createStorageMock = () => {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
    removeItem(key) {
      store.delete(String(key))
    },
    clear() {
      store.clear()
    },
    key(idx) {
      return Array.from(store.keys())[idx] ?? null
    },
    get length() {
      return store.size
    }
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageMock()
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true }
} else {
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    })
  } catch {
    // Abaikan jika read-only di lingkungan tertentu
  }
}
