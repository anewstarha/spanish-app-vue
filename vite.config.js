import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path' // 1. 导入 Node.js 的 path 模块

// https://vitejs.dev/config/
export default defineConfig({
  // 2. 添加 resolve 配置来定义路径别名
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 3. 我们之前定义的 base 路径

  plugins: [
    vue(),
    // 4. 我们之前定义的 PWA 插件配置
    VitePWA({
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
  ],
})
