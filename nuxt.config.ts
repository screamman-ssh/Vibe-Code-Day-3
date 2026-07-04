import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-02',
  nitro: {
    preset: 'cloudflare_pages',
  },
  runtimeConfig: {
    public: {
      aiApiKey: '', // public config, will map to NUXT_PUBLIC_AI_API_KEY env var
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
          theme_color: '#0f766e',
          background_color: '#f0fdfa',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
      }),
    ],
  },
  css: ['~/assets/css/style.css'],
  modules: [
    '@pinia/nuxt',
  ],
})
