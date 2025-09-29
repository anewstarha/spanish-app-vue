import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa' // 1. 导入插件

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({ // 2. 添加插件配置
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Aprende Español App',
        short_name: 'Español',
        description: 'Una aplicación para ayudarte a aprender español.',
        theme_color: '#4A90E2',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
