// src/main.js

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useUserStore } from './stores/userStore' // 1. 在这里导入 userStore
import App from './App.vue'
import router from './router'
import { supabase } from './supabase'

// 先创建 App 实例和 Pinia 实例
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 在挂载 App 之前，先获取 userStore
const userStore = useUserStore()

let isMounted = false;

// 设置全局的认证状态监听器
supabase.auth.onAuthStateChange((event, session) => {
  // 无论何时认证状态变化，都立即更新 Store
  userStore.setUser(session?.user ?? null)

  // 确保 App 只被挂载一次
  if (!isMounted) {
    app.mount('#app')
    isMounted = true
  }
})
