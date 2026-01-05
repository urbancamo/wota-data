import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

// Check if running behind a proxy (production-like environment)
const isProxied = process.env.VITE_PROXIED === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: '/data/',
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 3002,
    allowedHosts: [
      '.m5tea.uk',
      '.vault',
      'localhost',
    ],
    hmr: isProxied ? {
      protocol: 'wss',
      host: 'm5tea.uk',
      port: 443,
      clientPort: 443,
      path: '/data/',
    } : true,
    proxy: {
      '/data/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
})

