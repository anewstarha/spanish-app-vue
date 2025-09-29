// src/main.js

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 1. 导入 supabase 客户端
import { supabase } from './supabase'

let app;

// 2. 将 app 的创建和挂载移入 onAuthStateChange 回调
// 这个回调函数在页面加载时会立即被触发一次
supabase.auth.onAuthStateChange(() => {

  // 3. 使用一个技巧确保应用只被创建和挂载一次
  if (!app) {
    app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  }
})
