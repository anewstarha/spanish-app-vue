<script setup>
import { ref } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { UserCircleIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/solid';
import ProfileModal from './ProfileModal.vue';
import appLogo from '@/assets/app-logo.png';
// 1. 导入我们的 PWA 安装逻辑
import { usePWAInstall } from '@/composables/usePWAInstall';

const store = useUserStore();
const isMenuOpen = ref(false);
const isModalOpen = ref(false);

// 2. 获取安装状态和触发函数
const { canInstall, promptInstall } = usePWAInstall();

function handleLogout() {
  isMenuOpen.value = false;
  store.signOut();
}
function openProfileModal() {
  isMenuOpen.value = false;
  isModalOpen.value = true;
}
</script>

<template>
  <header class="app-header">
    <div class="logo">
      <img :src="appLogo" alt="App Logo" class="logo-icon" />
      <span>APRENDE ESPAÑOL</span>
    </div>

    <div class="header-actions">
      <button v-if="canInstall" @click="promptInstall" class="install-btn" title="Instalar Aplicación">
        <ArrowDownTrayIcon />
      </button>

      <div v-if="store.isLoggedIn" class="user-menu-container">
        <UserCircleIcon class="user-avatar active-avatar" @click="isMenuOpen = !isMenuOpen" />
        <div v-if="isMenuOpen" class="dropdown-menu">
          <a href="#" @click.prevent="openProfileModal">Cambiar apodo</a>
          <a href="#" @click.prevent="handleLogout">Cerrar sesión</a>
        </div>
      </div>
      <div v-else class="auth-links-placeholder"></div>
    </div>
  </header>

  <ProfileModal :show="isModalOpen" @close="isModalOpen = false" />
</template>

<style scoped>
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; }
.logo { display: flex; align-items: center; font-weight: 700; font-size: 16px; }
.logo-icon { width: 32px; height: 32px; margin-right: 8px; }
.header-actions { display: flex; align-items: center; gap: 16px; } /* 新增容器 */

.install-btn {
  background: none;
  border: none;
  color: var(--accent-blue);
  cursor: pointer;
  padding: 5px;
}
.install-btn svg {
  width: 24px;
  height: 24px;
}

.auth-links-placeholder { width: 36px; }
.user-menu-container { position: relative; }
.user-avatar { width: 36px; height: 36px; color: var(--secondary-text); cursor: pointer; }
.active-avatar { color: var(--accent-blue); }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 8px; background-color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 140px; width: max-content; padding: 8px 0; z-index: 100; }
.dropdown-menu a { display: block; padding: 8px 16px; color: var(--primary-text); text-decoration: none; font-size: 14px; }
.dropdown-menu a:hover { background-color: #f0f0f0; }
</style>
