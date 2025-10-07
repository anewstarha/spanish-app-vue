<script setup>
import { RouterView } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import { useUserStore } from './stores/userStore'
// 不再需要 onMounted 和 supabase 了

const store = useUserStore()

// onMounted 钩子里的 onAuthStateChange 监听器已被移除
// 因为这个逻辑已经前置到了 main.js 中
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
/* 您原有的样式，保持不变 */
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
