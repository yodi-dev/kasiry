// Web Audio API Sound Utility untuk Kasiry POS
// Tidak butuh file mp3 eksternal, bekerja 100% offline dan instan

class SoundManager {
  constructor() {
    this.ctx = null
  }

  getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        this.ctx = new AudioContext()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  // Bunyi beep barcode kasir standar (High pitch crisp beep)
  beep(frequency = 1760, duration = 0.08) {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)

      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch (e) {
      console.warn('[SoundManager] Beep failed:', e)
    }
  }

  // Bunyi double beep untuk peringatan (misal barcode tidak ditemukan)
  warningBeep() {
    this.beep(880, 0.08)
    setTimeout(() => {
      this.beep(660, 0.12)
    }, 100)
  }

  // Bunyi sukses bayar / transaksi
  successBeep() {
    this.beep(1046.5, 0.06) // C6
    setTimeout(() => {
      this.beep(1318.5, 0.06) // E6
      setTimeout(() => {
        this.beep(1760, 0.1) // A6
      }, 70)
    }, 70)
  }
}

export const soundManager = new SoundManager()

export function playBeepSound(type = 'beep') {
  if (type === 'warning') {
    soundManager.warningBeep()
  } else if (type === 'success') {
    soundManager.successBeep()
  } else {
    soundManager.beep()
  }
}
