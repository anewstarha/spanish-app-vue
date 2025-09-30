<script setup>
import { RouterView } from 'vue-router';
import BottomNav from './components/BottomNav.vue';
import { useUserStore } from './stores/userStore';
import { useUiStore } from './stores/uiStore'; // 【新增】导入 uiStore

const userStore = useUserStore();
const uiStore = useUiStore(); // 【新增】获取 uiStore 实例
</script>

<template>
  <div class="mobile-container">
    <main class="main-content">
      <RouterView />
    </main>
    <BottomNav v-if="userStore.isLoggedIn && uiStore.isNavVisible" class="bottom-nav-container" />
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.main-content {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 100%; /* 占满全部高度 */
  min-height: 0;
  overflow-y: auto;
}
.bottom-nav-container {
  flex-shrink: 0;
}
</style>
