<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

defineProps({
  show: Boolean
})
const emit = defineEmits(['close'])

const store = useUserStore()
const newNickname = ref(store.profile?.nickname || '')

async function handleUpdateNickname() {
  if (!newNickname.value || newNickname.value.length < 2) {
    alert('昵称长度至少为2个字符。')
    return
  }
  try {
    await store.updateNickname(newNickname.value)
    emit('close') // 关闭模态框
  } catch (error) {
    alert(`更新失败: ${error.message}`)
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h3>修改昵称</h3>
      <form @submit.prevent="handleUpdateNickname">
        <input type="text" v-model="newNickname" placeholder="输入新昵称" />
        <div class="modal-actions">
          <button type="button" @click="emit('close')">取消</button>
          <button type="submit">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  width: 90%;
  max-width: 300px;
}
.modal-content h3 {
  margin-top: 0;
}
.modal-content input {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  margin-bottom: 20px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid #ccc;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.modal-actions button[type="submit"] {
  background-color: var(--accent-blue);
  color: white;
}
</style>
