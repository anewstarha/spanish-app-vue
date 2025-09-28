<script setup>
import { useUserStore } from '@/stores/userStore'
const store = useUserStore()
</script>

<template>
  <section class="greeting">
    <h1>¡Hola, {{ store.profile?.nickname || 'amigo' }}!</h1>
    <p>Buenos tardes</p>
  </section>
</template>

<style scoped>
.greeting h1 { font-size: 24px; font-weight: 600; margin: 20px 0 5px 0; }
.greeting p { font-size: 16px; color: var(--secondary-text); margin: 0; }
</style>
