import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-xlsx',
              test: /node_modules[\\/]xlsx[\\/]/,
              priority: 30
            },
            {
              name: 'vendor-zxing',
              test: /node_modules[\\/]@zxing[\\/]/,
              priority: 30
            },
            {
              name: 'vendor-vue',
              test: /node_modules[\\/](vue|@vue)[\\/]/,
              priority: 20
            },
            {
              name: 'vendor-dexie',
              test: /node_modules[\\/]dexie[\\/]/,
              priority: 20
            }
          ]
        }
      }
    }
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Kasiry by Awanbeo — Aplikasi Kasir Warung & Buku Utang',
        short_name: 'Kasiry',
        description: 'Kasiry by Awanbeo — Aplikasi Kasir Warung Kelontong & UMKM Indonesia Offline-First',
        lang: 'id',
        theme_color: '#0a193d',
        background_color: '#edf5fd',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3500000,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        globIgnores: ['**/google*.html', '**/og-image.png', '**/kasiry-oauth-120x120.png', '**/privacy.html', '**/terms.html', '**/robots.txt', '**/sitemap.xml'],
        navigateFallbackDenylist: [/^\/google[a-z0-9]+\.html$/i, /^\/privacy(?:\.html)?$/, /^\/terms(?:\.html)?$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/]
      }
    })
  ]
})
