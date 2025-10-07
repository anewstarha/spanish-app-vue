<script setup>
import { useUserStore } from '@/stores/userStore';

const userStore = useUserStore();

// 接收来自父组件的 streak 数据
defineProps({
  streak: {
    type: Number,
    default: 0
  }
});
</script>

<template>
  <div class="greeting-card">
    <div class="greeting-text">
      <h2>你好，{{ userStore.profile?.nickname || '朋友' }}！</h2>
      <p>准备好今天学习新内容了吗？</p>
    </div>
    <div v-if="streak > 0" class="streak-counter" title="连续学习天数">
      <span class="streak-icon">🔥</span>
      <span class="streak-number">{{ streak }}</span>
      <span class="streak-label">Días</span>
    </div>
  </div>
</template>

<style scoped>
.greeting-card {
  background: linear-gradient(135deg, #4A90E2 0%, #63A4FF 100%);
  color: white;
  padding: 20px;
  border-radius: 18px;
  margin: 20px 0;
  box-shadow: 0 8px 25px rgba(74, 144, 226, 0.3);
  display: flex; /* 改为 flex 布局 */
  justify-content: space-between; /* 两端对齐 */
  align-items: center; /* 垂直居中 */
}
.greeting-text h2 {
  margin: 0 0 5px 0;
  font-size: 24px;
  font-weight: 700;
}
.greeting-text p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}
.streak-counter {
  display: flex;
  align-items: baseline; /* 图标和数字底部对齐 */
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.15);
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 600;
}
.streak-icon {
  font-size: 20px;
}
.streak-number {
  font-size: 24px;
  line-height: 1;
}
.streak-label {
    font-size: 12px;
    opacity: 0.8;
}
</style>
