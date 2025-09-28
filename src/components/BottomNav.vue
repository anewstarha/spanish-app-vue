<script setup>
import { RouterLink } from 'vue-router'
// 从 Heroicons 的 solid (实心) 版本中导入图标
import {
  HomeIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon
} from '@heroicons/vue/24/solid'
</script>

<template>
  <nav class="bottom-nav">
    <RouterLink to="/" class="nav-item">
      <HomeIcon class="icon" />
      <div class="label">Inicio</div>
    </RouterLink>
    <RouterLink to="/study" class="nav-item">
      <BookOpenIcon class="icon" />
      <div class="label">Aprender</div>
    </RouterLink>
    <RouterLink to="/quiz" class="nav-item">
      <ChatBubbleLeftRightIcon class="icon" />
      <div class="label">Practicar</div>
    </RouterLink>
    <RouterLink to="/manage" class="nav-item">
      <PencilSquareIcon class="icon" />
      <div class="label">Mi Contenido</div>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #fff;
  border-top: 1px solid #eee;
  padding: 10px 0;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  color: #8A94A6; /* var(--secondary-text) */
  transition: color 0.2s;
  text-decoration: none;
  flex: 1;
}

.nav-item:hover {
  color: #4A90E2; /* var(--accent-blue) */
}

.nav-item .icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
}

.nav-item .label {
  font-size: 11px;
  font-weight: 500;
}

/* --- 核心改动：从 .router-link-exact-active 改为 .router-link-active --- */
.nav-item.router-link-active {
  color: #4A90E2; /* var(--accent-blue) */
  font-weight: 600;
}
</style>
