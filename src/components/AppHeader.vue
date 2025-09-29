<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { UserCircleIcon } from '@heroicons/vue/24/solid'
import ProfileModal from './ProfileModal.vue'
// 1. 导入您的新 Logo 图片
import appLogo from '@/assets/app-logo.png';

const store = useUserStore()
const isMenuOpen = ref(false)
const isModalOpen = ref(false)

function handleLogout() {
  isMenuOpen.value = false
  store.signOut()
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
      <span>APRENDE ESPAÑOL v2</span>
    </div>

    <div v-if="store.isLoggedIn" class="user-menu-container">
      <UserCircleIcon class="user-avatar active-avatar" @click="isMenuOpen = !isMenuOpen" />
      <div v-if="isMenuOpen" class="dropdown-menu">
        <a href="#" @click.prevent="openProfileModal">Cambiar apodo</a>
        <a href="#" @click.prevent="handleLogout">Cerrar sesión</a>
      </div>
    </div>

    <div v-else class="auth-links-placeholder"></div>

  </header>

  <ProfileModal :show="isModalOpen" @close="isModalOpen = false" />
</template>

<style scoped>
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; }
.logo { display: flex; align-items: center; font-weight: 700; font-size: 16px; }
.logo-icon {
  width: 36px;
  height: 36px;
  margin-right: 8px;
  /* 移除了 color 属性，因为图片自带颜色 */
}

.auth-links-placeholder {
    width: 36px;
}

/* --- 用户菜单 --- */
.user-menu-container { position: relative; }
.user-avatar { width: 36px; height: 36px; color: var(--secondary-text); cursor: pointer; }
.active-avatar { color: var(--accent-blue); }
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 140px;
  width: max-content;
  padding: 8px 0;
  z-index: 100;
}
.dropdown-menu a { display: block; padding: 8px 16px; color: var(--primary-text); text-decoration: none; font-size: 14px; }
.dropdown-menu a:hover { background-color: #f0f0f0; }
</style>
