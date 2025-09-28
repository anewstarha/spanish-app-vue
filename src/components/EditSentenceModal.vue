<script setup>
import { ref, watch, computed } from 'vue';
import { supabase } from '@/supabase';

// 假设此函数在您的项目中可用
// import { syncWordBankForSentenceChange } from '@/utils/wordUtils';

const props = defineProps({
  show: Boolean,
  sentence: Object // 接收需要编辑的整个句子对象
});
const emit = defineEmits(['close', 'sentence-updated']);

// 状态管理
const editableSentence = ref(null);
const tagsInput = ref('');
const isProcessing = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');

// 使用计算属性判断西班牙语原文是否被修改
const hasSpanishTextChanged = computed(() => {
  if (!props.sentence || !editableSentence.value) return false;
  return props.sentence.spanish_text !== editableSentence.value.spanish_text.trim();
});

// 当模态框显示时，用传入的句子数据初始化表单
watch(() => props.show, (newValue) => {
  if (newValue && props.sentence) {
    // 创建一个可编辑的副本，避免直接修改prop
    editableSentence.value = { ...props.sentence };
    tagsInput.value = (props.sentence.tags || []).join(', ');
    errorMessage.value = '';
    statusMessage.value = '';
    isProcessing.value = false;
  }
});

async function handleSave() {
  if (!editableSentence.value.spanish_text.trim() || isProcessing.value) {
    alert('西班牙语原文不能为空。');
    return;
  }

  isProcessing.value = true;
  errorMessage.value = '';
  const finalTags = tagsInput.value.trim() ? tagsInput.value.split(/[,，\s]+/).filter(t => t) : [];

  try {
    if (!hasSpanishTextChanged.value) {
      // --- 情况一：只修改了标签 ---
      statusMessage.value = '正在更新标签...';
      const { error } = await supabase
        .from('sentences')
        .update({ tags: finalTags })
        .eq('id', props.sentence.id);
      if (error) throw error;

    } else {
      // --- 情况二：修改了西班牙语原文，触发完整AI更新流程 ---
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("用户未登录或会话已过期。");
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-sentence`;

      const newSpanishText = editableSentence.value.spanish_text.trim();
      const oldSpanishText = props.sentence.spanish_text; // 保存旧文本用于对比

      // 1. 获取新翻译
      statusMessage.value = '正在获取新翻译...';
      const transResponse = await fetch(functionUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ sentences: [{ spanish_text: newSpanishText }], getTranslation: true })
      });
      if (!transResponse.ok) throw new Error('AI翻译服务失败');
      const { translatedSentences } = await transResponse.json();
      const newChineseText = translatedSentences[0]?.chinese_translation;
      if (!newChineseText) throw new Error('未能获取有效的翻译结果');

      // 2. 获取新AI解释
      statusMessage.value = '正在生成新AI解释...';
      const explainResponse = await fetch(functionUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ sentence: newSpanishText, getExplanation: true })
      });
      const { explanation: newAiNotes } = await explainResponse.json();

      // 3. 更新数据库
      statusMessage.value = '正在更新数据库...';
      const { error } = await supabase
        .from('sentences')
        .update({
          spanish_text: newSpanishText,
          chinese_translation: newChineseText,
          ai_notes: newAiNotes,
          tags: finalTags
        })
        .eq('id', props.sentence.id);
      if (error) throw error;

      // 4. 【核心修正】更新高频词库
      statusMessage.value = '正在更新个人词库...';
      // 【注意】请确保您在项目中实现了此函数或等效逻辑
      // await syncWordBankForSentenceChange({ oldSentenceText: oldSpanishText, newSentenceText: newSpanishText });
      console.log("（占位）高频词更新逻辑需要在此处被调用，对比旧句：", oldSpanishText, "和新句：", newSpanishText);
    }

    statusMessage.value = '更新成功！';
    setTimeout(() => {
      emit('sentence-updated');
      emit('close');
    }, 1000);

  } catch (error) {
    console.error('更新句子失败:', error);
    errorMessage.value = error.message;
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="!isProcessing && emit('close')">
    <div class="modal-content" v-if="editableSentence">
      <div class="modal-header">
        <h3>编辑句子</h3>
        <button @click="emit('close')" class="close-btn" :disabled="isProcessing">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="edit-spanish-text">西班牙语原文</label>
          <textarea id="edit-spanish-text" v-model="editableSentence.spanish_text" rows="4" :disabled="isProcessing"></textarea>
        </div>
        <div class="form-group">
          <label>中文翻译 (由AI生成)</label>
          <p class="readonly-field">{{ editableSentence.chinese_translation }}</p>
          <p v-if="hasSpanishTextChanged" class="field-note">原文修改后，将自动重新生成翻译和AI解释。</p>
        </div>
        <div class="form-group">
          <label for="edit-tags-input">标签 (用逗号分隔)</label>
          <input type="text" id="edit-tags-input" v-model="tagsInput" :disabled="isProcessing" />
        </div>
        <div v-if="isProcessing" class="status-indicator">
          <div class="spinner"></div>
          <span>{{ statusMessage || '正在处理中...' }}</span>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </div>
      <div class="modal-footer">
        <button @click="emit('close')" class="btn btn-secondary" :disabled="isProcessing">取消</button>
        <button @click="handleSave" class="btn btn-primary" :disabled="isProcessing">
          {{ isProcessing ? '保存中...' : '确认保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式与AddSentenceModal类似，可复用 */
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
.readonly-field {
  width: 100%; padding: 10px; border-radius: 8px;
  background-color: #f1f3f5; font-size: 16px; box-sizing: border-box;
  color: #555; margin: 0;
}
.field-note {
  font-size: 12px; color: #888; margin: 4px 0 0 0;
}
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
