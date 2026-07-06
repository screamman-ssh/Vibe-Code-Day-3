import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-02',
  nitro: {
    preset: 'cloudflare_pages',
  },
  runtimeConfig: {
    public: {
      aiApiKey: 'TestOnly1111@', 
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    }
  },
  ssr: false,
  experimental: {
    viteEnvironmentApi: true
  },
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'MoneyCircle',
          short_name: 'MoneyCircle',
          description: 'Score your habits, not your wealth',
          theme_color: '#BE1A1A',
          background_color: '#F8EBAB',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
    ],
  },
  css: ['~/assets/css/style.css'],
  modules: [
    '@pinia/nuxt',
  ],
})
