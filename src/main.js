import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Jika PWA mendapat versi baru di latar belakang saat pengguna masih di versi lama, muat ulang agar fitur terbaru langsung aktif
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}

const app = createApp(App)
app.mount('#app')
