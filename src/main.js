// src/main.js

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useUserStore } from './stores/userStore'
import App from './App.vue'
import router from './router'
import { supabase } from './supabase'

// 创建 App 和 Pinia 并立即挂载，避免依赖异步回调导致白屏
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 在挂载前写入一个简单的占位 DOM，方便在没有 Console 的情况下仍能看到页面已被触达
try {
  const rootEl = document.getElementById('app')
  if (rootEl) {
    rootEl.innerHTML = '<div id="__debug_mount" style="padding:20px;font-family:sans-serif;">App mounting...</div>'
  }

  // 立即挂载应用（即使 auth 初始化还没完成，也能渲染加载/错误界面）
  app.mount('#app')
  console.log('[app] mounted successfully')
  // 标记全局状态，便于在设备日志中检索
  window.__APP_MOUNTED = true
} catch (err) {
  console.error('[app] mount error:', err)
  // 尝试把错误信息写入 DOM，便于在看不到控制台时也能知道
  const rootEl = document.getElementById('app')
  if (rootEl) rootEl.innerHTML = '<pre style="color:red;padding:12px;">App mount error:\n' + String(err) + '</pre>'
}

// 之后异步初始化用户状态并监听变更
const userStore = useUserStore()

;(async () => {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('supabase.getSession error:', error)
    }
    const session = data?.session ?? null
    userStore.setUser(session?.user ?? null)
  } catch (err) {
    console.warn('Error getting supabase session:', err)
  }
})()

// 监听后续的认证状态变化
supabase.auth.onAuthStateChange((event, session) => {
  userStore.setUser(session?.user ?? null)
})
