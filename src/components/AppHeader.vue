<script setup>
// ... (script 部分保持不变)
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { GlobeEuropeAfricaIcon, UserCircleIcon } from '@heroicons/vue/24/solid'
import ProfileModal from './ProfileModal.vue'

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
      <GlobeEuropeAfricaIcon class="logo-icon" />
      <span>APRENDE ESPAÑOL</span>
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
.logo-icon { width: 28px; height: 28px; margin-right: 8px; color: var(--accent-blue); }

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
  /* --- 核心改动在这里 --- */
  min-width: 140px; /* 我们可以保留一个最小宽度，防止内容过短时太窄 */
  width: max-content; /* 关键：让宽度由最长的内容自动撑开 */
  /* --- 核心改动结束 --- */
  padding: 8px 0;
  z-index: 100;
}
.dropdown-menu a { display: block; padding: 8px 16px; color: var(--primary-text); text-decoration: none; font-size: 14px; }
.dropdown-menu a:hover { background-color: #f0f0f0; }
</style>
