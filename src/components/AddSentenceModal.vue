<script setup>
import { ref, watch } from 'vue';
import { supabase } from '@/supabase';
import { useUserStore } from '@/stores/userStore';

const props = defineProps({
  show: Boolean
});
const emit = defineEmits(['close', 'sentences-added']);

const store = useUserStore();
const spanishText = ref('');
const tagsInput = ref('');
const isProcessing = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');

// 当模态框显示时，重置所有状态
watch(() => props.show, (newValue) => {
  if (newValue) {
    spanishText.value = '';
    tagsInput.value = '';
    errorMessage.value = '';
    statusMessage.value = '';
    isProcessing.value = false;
  }
});

/**
 * 经过重构的 handleSubmit 函数
 * 职责：只负责将用户输入的原始句子和标签提交给后端入口云函数。
 */
async function handleSubmit() {
  if (!spanishText.value.trim() || isProcessing.value) return;

  isProcessing.value = true;
  errorMessage.value = '';
  statusMessage.value = '正在提交您的句子...';

  try {
    // 1. 准备最基础的数据
    const lines = spanishText.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("输入内容不能为空。");

    const tags = tagsInput.value.trim() ? tagsInput.value.split(/[,，\s]+/).filter(t => t) : [];

    const payload = {
      sentences: lines,
      tags: tags
    };

    // 2. 发起单一、轻量的请求到新的入口函数
    const { error } = await supabase.functions.invoke('add-sentences-minimal', {
      body: payload
    });

    if (error) {
      // 如果云函数返回错误，则抛出以便被 catch 块捕获
      throw new Error(error.message);
    }

    // 3. 立即获得成功反馈
    statusMessage.value = `成功提交 ${lines.length} 条句子！后台正在处理翻译、解释和词库...`;

    // 短暂延迟后关闭窗口，并通知父组件刷新数据
    setTimeout(() => {
        emit('sentences-added');
        emit('close');
    }, 1500);

  } catch (error) {
    console.error('提交失败:', error);
    errorMessage.value = `提交失败: ${error.message}`;
    // 发生错误后，允许用户重新提交
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="!isProcessing && emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>批量添加新句子</h3>
        <button @click="emit('close')" class="close-btn" :disabled="isProcessing">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="spanish-text">西班牙语句子 (一行一句)</label>
          <textarea id="spanish-text" v-model="spanishText" rows="8" placeholder="在此处粘贴一句或多句西班牙语..." :disabled="isProcessing"></textarea>
        </div>
        <div class="form-group">
          <label for="tags-input">统一添加标签 (用逗号分隔)</label>
          <input type="text" id="tags-input" v-model="tagsInput" placeholder="例如：日常, 工作, B1" :disabled="isProcessing" />
        </div>
        <div v-if="isProcessing" class="status-indicator">
          <div class="spinner"></div>
          <span>{{ statusMessage || '正在处理中...' }}</span>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </div>
      <div class="modal-footer">
        <button @click="emit('close')" class="btn btn-secondary" :disabled="isProcessing">取消</button>
        <button @click="handleSubmit" class="btn btn-primary" :disabled="isProcessing || !spanishText.trim()">
          {{ isProcessing ? '处理中...' : '确认添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式部分无需改动，保持原样即可 */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
  background: white; border-radius: 12px; width: 90%; max-width: 500px;
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
}
.modal-header h3 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #888; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.form-group label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.form-group textarea, .form-group input {
  width: 100%; padding: 10px; border-radius: 8px;
  border: 1px solid #ccc; font-size: 16px; box-sizing: border-box;
}
.form-group textarea:disabled, .form-group input:disabled { background-color: #f1f3f5; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  padding: 16px 20px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;
}
.btn {
  padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
  font-weight: 600; cursor: pointer;
}
.btn-primary { background-color: #4A90E2; color: white; }
.btn-primary:disabled { background-color: #a0c7ff; cursor: not-allowed; }
.btn-secondary { background-color: white; color: #333; border-color: #ccc; }
.status-indicator { display: flex; align-items: center; gap: 10px; color: #555; font-size: 14px; }
.spinner {
  width: 20px; height: 20px; border: 3px solid #f3f3f3;
  border-top: 3px solid #4A90E2; border-radius: 50%;
  animation: spin 1s linear infinite;
}
.error-message { color: #dc3545; font-size: 14px; margin: 0; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
