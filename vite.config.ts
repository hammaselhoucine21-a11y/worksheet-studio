/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Cross-origin isolation lets the AI model use several CPU threads.
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Worksheet Studio',
        short_name: 'Worksheets',
        description: 'Simple photo editor for worksheets: crop, clean up, move, add text and print.',
        theme_color: '#e8505b',
        background_color: '#fffaf6',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  server: { headers, host: true },
  preview: { headers, host: true, port: 4321 },
  test: { environment: 'node' },
})
