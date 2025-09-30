<script setup>
import { ref, watch } from 'vue';
import { supabase } from '@/supabase';
import { useUserStore } from '@/stores/userStore';
import { syncWordBankForSentenceChange } from '@/services/wordService.js';

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

  const startTime = Date.now();
  console.log("[性能测试] 开始“一步到位”完整流程...");

  try {
    // 步骤 1: 准备并去重句子
    statusMessage.value = '正在检查重复句子...';
    const lines = spanishText.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("输入内容不能为空。");

    const { data: existing } = await supabase.from('sentences').select('spanish_text').eq('user_id', store.user.id);
    const existingSet = new Set((existing || []).map(s => s.spanish_text));
    const toAdd = lines.map(line => ({ spanish_text: line.trim() })).filter(s => !existingSet.has(s.spanish_text));
    const duplicateCount = lines.length - toAdd.length;

    if (toAdd.length === 0) {
      throw new Error(`没有新的句子可添加。${duplicateCount > 0 ? `忽略了 ${duplicateCount} 个重复项。` : ''}`);
    }

    // 步骤 2: 【核心测试点】调用 explain-sentence，同时获取翻译和AI解释
    statusMessage.value = `识别到 ${toAdd.length} 条新句子，正在获取翻译与AI解释... (请耐心等待)`;

    const { data: aiResult, error: functionError } = await supabase.functions.invoke('explain-sentence', {
        body: { sentences: toAdd, getTranslation: true, getExplanation: true } // getExplanation 设置为 true
    });

    if(functionError) throw functionError;
    if (!aiResult || !aiResult.translatedSentences) throw new Error("AI服务返回的数据格式不正确。");

    const { translatedSentences } = aiResult;
    console.log(`[性能测试] AI处理完成，耗时: ${Date.now() - startTime}ms`);

    // 步骤 3: 将带有翻译和AI解释的句子写入数据库
    statusMessage.value = 'AI处理成功，正在存入数据库...';
    const finalTags = tagsInput.value.trim() ? tagsInput.value.split(/[,，\s]+/).filter(t => t) : [];

    // translatedSentences 现在应该包含 spanish_text, chinese_translation, 和 ai_notes
    const sentencesToInsert = translatedSentences.map(s => ({
      ...s,
      user_id: store.user.id,
      tags: finalTags.length > 0 ? finalTags : null,
    }));

    const { error: insertError } = await supabase.from('sentences').insert(sentencesToInsert);
    if (insertError) throw insertError;
    console.log(`[性能测试] 句子存入数据库完成，耗时: ${Date.now() - startTime}ms`);

    // 步骤 4: 调用增量同步服务来更新词库
    statusMessage.value = '句子保存成功，正在同步个人词库...';
    const allNewSentencesText = sentencesToInsert.map(s => s.spanish_text).join('\n');
    await syncWordBankForSentenceChange({ newSentenceText: allNewSentencesText });
    console.log(`[性能测试] 词库同步完成，耗时: ${Date.now() - startTime}ms`);

    // 步骤 5: 完成并提示用户
    statusMessage.value = `成功添加 ${toAdd.length} 条新句子！所有处理已完成。`;
    if (duplicateCount > 0) {
        statusMessage.value += ` 忽略了 ${duplicateCount} 个重复项。`;
    }
    console.log(`[性能测试] 完整流程总耗时: ${Date.now() - startTime}ms`);

    setTimeout(() => {
        emit('sentences-added');
        emit('close');
    }, 1500);

  } catch (error) {
    console.error('批量添加失败:', error);
    errorMessage.value = `失败: ${error.message}`;
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
