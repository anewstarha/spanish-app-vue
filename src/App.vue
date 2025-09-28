<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import { useUserStore } from './stores/userStore'
import { supabase } from './supabase'

const store = useUserStore()

// 设置一个持久的 Supabase 认证状态监听器
onMounted(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    // 当用户的登录状态发生任何变化时（包括页面首次加载），这个函数都会被自动触发
    store.setUser(session?.user ?? null)
  })
})
</script>

<template>
  <div class="mobile-container">
    <main class="main-content">
      <RouterView />
    </main>
    <BottomNav v-if="store.isLoggedIn" class="bottom-nav-container" />
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.main-content {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 90%;
  min-height: 0;
  overflow-y: auto;
}
.bottom-nav-container {
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: 10%;
}
</style>
