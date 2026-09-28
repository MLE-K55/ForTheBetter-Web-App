import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'For The Better',
        short_name: 'For Better',
        description: 'A private nine week Kaizen journal.',
        theme_color: '#ef8e8e',
        background_color: '#fff8f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logos/ftb-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logos/ftb-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
