<script setup>
import AppHeader from './AppHeader.vue'
</script>

<template>
  <div class="auth-layout-padding">
    <AppHeader />
    <slot></slot> </div>
</template>

<style scoped>
.auth-layout-padding {
  padding: 0 15px;
}
</style>
