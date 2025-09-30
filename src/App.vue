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

    <div v-if="showIosInstallPrompt" class="ios-install-prompt">
      <div class="prompt-content">
        <p>Para la mejor experiencia, añade esta app a tu pantalla de inicio.</p>
        <p class="prompt-instructions">
          Toca el icono de <span class="share-icon"></span> y luego selecciona "Añadir a pantalla de inicio".
        </p>
      </div>
      <button @click="showIosInstallPrompt = false" class="close-btn" aria-label="Cerrar">&times;</button>
    </div>
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

/* --- 新增的 PWA 安装提示样式 --- */
.ios-install-prompt {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #f8f9fa;
  color: #333;
  padding: 16px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1000;
  border-top: 1px solid #e0e0e0;
  animation: slide-up 0.5s ease-out;
  /* 适配底部导航栏，如果有的话 */
  /* 如果您的底部导航栏是固定的，可能需要调整这个 bottom 值 */
  /* 例如: bottom: 60px; (假设您的BottomNav高度是60px) */
  margin-bottom: env(safe-area-inset-bottom);
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.prompt-content {
  font-size: 14px;
}

.prompt-content p {
  margin: 0 0 5px 0;
}

.prompt-instructions {
  font-size: 13px;
  color: #555;
  display: flex;
  align-items: center;
}

.share-icon {
  display: inline-block;
  width: 18px;
  height: 18px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M30.3 13.7L25 8.4l-5.3 5.3M25 9v22.2"/><path d="M38.6 23.2c0 7.2-5.9 13-13 13s-13-5.8-13-13"/><path d="M12.7 32.8V42h25.2V32.8"/></svg>');
  background-repeat: no-repeat;
  background-size: contain;
  vertical-align: middle;
  margin: 0 4px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  font-weight: 300;
  color: #999;
  cursor: pointer;
  padding: 0 10px;
}
</style>
