import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'                      // 1. 导入 path 用于路径别名
import { fileURLToPath } from 'url'

// ESM 环境下补充 __dirname（vite config 在 package.json 中为 "type": "module"）
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// import basicSsl from '@vitejs/plugin-basic-ssl' // 2. 移除或注释掉 SSL 插件导入

// https://vitejs.dev/config/
export default defineConfig({
  // Use a relative base so built asset links are relative paths.
  // This prevents leading '/' absolute paths in the generated index.html which
  // can cause resources to 404 when served from the app bundle.
  base: './',
  plugins: [
    vue(),
    // basicSsl() // 3. 移除或注释掉 SSL 插件启用
  ],
  resolve: {
    // 4. 配置路径别名
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    // 5. 将 https 移除或注释掉（默认即为 http: false/http 协议）
    // https: true,
    // host: '0.0.0.0' 允许网络访问的配置可以保留，方便手机通过 IP 访问
    host: '0.0.0.0'
  }
})
