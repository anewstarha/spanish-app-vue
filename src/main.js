// src/main.js

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. 从 pinia 库导入 createPinia 函数
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia()) // 2. 在应用中使用 Pinia
app.use(router)

app.mount('#app')
