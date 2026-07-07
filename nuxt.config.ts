import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-02',
  nitro: {
    preset: 'cloudflare_pages',
  },
  runtimeConfig: {
    public: {
      aiApiKey: 'TestOnly1111@',
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    },
  },
  ssr: false,
  experimental: {
    viteEnvironmentApi: true,
  },
  app: {
    head: {
      title: 'MoneyCircle',
      meta: [
        { name: 'description', content: 'Score your habits, not your wealth' },
        { name: 'theme-color', content: '#BE1A1A' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'MoneyCircle' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png', sizes: '180x180' },
        { rel: 'mask-icon', href: '/favicon.svg', color: '#BE1A1A' },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  css: ['~/assets/css/style.css'],
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'favicon.ico'],
    manifest: {
      name: 'MoneyCircle',
      short_name: 'MoneyCircle',
      description: 'Score your habits, not your wealth',
      theme_color: '#BE1A1A',
      background_color: '#F8EBAB',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      lang: 'th',
      categories: ['finance', 'productivity'],
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-stylesheets',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          },
        },
        {
          urlPattern: /\/api\/v1\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
})
