<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { RouterLink } from 'vue-router'
import AuthLayout from '@/components/AuthLayout.vue'

const store = useUserStore()
const email = ref('')
const password = ref('')

async function handleLogin() {
  try {
    await store.signIn(email.value, password.value)
  } catch (error) {
    alert(error.message)
  }
}
</script>

<template>
  <AuthLayout>
    <div class="auth-container">
      <h2>Iniciar sesión</h2>
      <form @submit.prevent="handleLogin" class="auth-form">
        <input type="email" v-model="email" placeholder="Correo electrónico" required />
        <input type="password" v-model="password" placeholder="Contraseña" required />
        <button type="submit">Iniciar sesión</button>
      </form>
      <p class="auth-switch">
        没有账号？<RouterLink to="/register">立即注册</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<style scoped>
/* 样式保持不变 */
.auth-container { padding: 20px 0; }
.auth-form { display: flex; flex-direction: column; gap: 15px; }
.auth-form input { padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; }
.auth-form button { padding: 12px; border-radius: 8px; border: none; background-color: var(--accent-blue); color: white; font-weight: bold; font-size: 16px; cursor: pointer; }
.auth-switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--secondary-text); }
.auth-switch a { color: var(--accent-blue); text-decoration: none; font-weight: 600; }
.auth-switch a:hover { text-decoration: underline; }
</style>
