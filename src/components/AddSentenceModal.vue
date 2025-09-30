<script setup>
import { ref, watch } from 'vue';
import { supabase } from '@/supabase';
import { useUserStore } from '@/stores/userStore';

// 假设您的项目中有一个 wordUtils.js 文件导出了这个函数
// import { generateAndUpdateHighFrequencyWords } from '@/utils/wordUtils';

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

watch(() => props.show, (newValue) => {
  if (newValue) {
    spanishText.value = '';
    tagsInput.value = '';
    errorMessage.value = '';
    statusMessage.value = '';
    isProcessing.value = false;
  }
});

async function handleSubmit() {
  if (!spanishText.value.trim() || isProcessing.value) return;

  isProcessing.value = true;
  errorMessage.value = '';
  statusMessage.value = '启动处理流程...';

  try {
    const lines = spanishText.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("输入内容不能为空。");

    statusMessage.value = `识别到 ${lines.length} 条句子，开始去重...`;

    const { data: existing } = await supabase.from('sentences').select('spanish_text').eq('user_id', store.user.id);
    const existingSet = new Set((existing || []).map(s => s.spanish_text));
    const toAdd = lines.map(line => ({ spanish_text: line.trim() })).filter(s => !existingSet.has(s.spanish_text));

    const duplicateCount = lines.length - toAdd.length;
    if (toAdd.length === 0) {
      throw new Error(`没有新的句子可添加。${duplicateCount > 0 ? `忽略了 ${duplicateCount} 个重复项。` : ''}`);
    }

    statusMessage.value = `去重完毕，${toAdd.length} 条新句子正在获取翻译...`;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("用户未登录或会话已过期。");

    const payload = { sentences: toAdd, getTranslation: true };
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-sentence`;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`AI 翻译服务出错 (${response.status}): ${errorBody}`);
    }

    const { translatedSentences } = await response.json();
    if (!translatedSentences) throw new Error("AI服务返回的数据格式不正确。");

    statusMessage.value = '翻译成功，正在存入数据库...';

    const finalTags = tagsInput.value.trim() ? tagsInput.value.split(/[,，\s]+/).filter(t => t) : [];
    const sentencesToInsert = translatedSentences.map(s => ({
      ...s,
      user_id: store.user.id,
      tags: finalTags.length > 0 ? finalTags : null
    }));

    const { error: insertError } = await supabase.from('sentences').insert(sentencesToInsert);
    if (insertError) throw insertError;

    statusMessage.value = '正在更新个人词库...';
    // await generateAndUpdateHighFrequencyWords(store.user.id);
    console.log("（占位）高频词更新逻辑需要在此处被调用。");

    statusMessage.value = `成功添加 ${sentencesToInsert.length} 条新句子！`;
    if (duplicateCount > 0) {
        statusMessage.value += ` 忽略了 ${duplicateCount} 个重复项。`;
    }

    setTimeout(() => {
        emit('sentences-added');
        emit('close');
    }, 1500);

  } catch (error) {
    console.error('批量添加失败:', error);
    errorMessage.value = error.message;
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="!isProcessing && emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>添加新句子</h3>
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
/* 样式部分保持不变 */
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
