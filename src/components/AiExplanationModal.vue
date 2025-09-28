<script setup>
defineProps({
  word: Object,
  explanation: Object,
  isLoading: Boolean,
});
const emit = defineEmits(['close']);
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h3 class="modal-title">“{{ word?.spanish_word }}”</h3>

      <div v-if="isLoading" class="loading-spinner"></div>

      <div v-else-if="explanation" class="explanation-content">
        <div v-if="explanation.ipa" class="ai-section">
          <div class="ai-section-title">发音</div>
          <div class="ipa-container">
            <span class="ipa-text">{{ explanation.ipa }}</span>
          </div>
          <p v-if="explanation.pronunciationTip" class="pronunciation-tip">{{ explanation.pronunciationTip }}</p>
        </div>

        <div class="ai-section">
          <div class="ai-section-title">核心信息</div>
          <p><strong>词性:</strong> {{ explanation.partOfSpeech || 'N/A' }}</p>
          <p v-if="explanation.gender"><strong>阴阳性:</strong> {{ explanation.gender }}</p>
          <p><strong>核心含义:</strong> {{ explanation.coreMeaning || 'N/A' }}</p>
        </div>

        <div v-if="explanation.usageNotes" class="ai-section">
          <div class="ai-section-title">用法与搭配</div>
          <p v-html="explanation.usageNotes.replace(/\n/g, '<br>')"></p>
        </div>

        <div v-if="explanation.mnemonic" class="ai-section">
          <div class="ai-section-title">联想记忆</div>
          <p v-html="explanation.mnemonic.replace(/\n/g, '<br>')"></p>
        </div>

        <div v-if="explanation.synonyms?.length || explanation.antonyms?.length" class="ai-section">
          <div class="ai-section-title">相关词汇</div>
          <p v-if="explanation.synonyms?.length"><strong>近义词:</strong> {{ explanation.synonyms.join(', ') }}</p>
          <p v-if="explanation.antonyms?.length"><strong>反义词:</strong> {{ explanation.antonyms.join(', ') }}</p>
        </div>
      </div>

      <p v-else class="error-text">未能获取 AI 解释。</p>

      <button @click="emit('close')" class="close-button">关闭</button>
    </div>
  </div>
</template>

<style scoped>
/* 样式与 StudySessionView 的 playlist-modal 类似，但为内容优化 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background-color: #fff;
  border-radius: 20px;
  max-height: 80vh;
  width: calc(100% - 30px);
  max-width: 500px;
  display: flex;
  flex-direction: column;
  padding: 20px;
  animation: scale-up 0.3s ease;
  overflow-y: auto;
}
.modal-title {
  text-align: center;
  font-size: 20px;
  margin: 0 0 15px 0;
  color: #333;
}
.loading-spinner { /* 省略 spinner 样式，你可以复用项目已有的 */
  border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%;
  width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto;
}
.explanation-content { display: flex; flex-direction: column; gap: 15px; }
.ai-section { border-top: 1px solid #eee; padding-top: 10px; }
.ai-section-title { font-weight: 600; color: #333; margin-bottom: 5px; }
.ipa-container { display: flex; align-items: center; gap: 10px; }
.ipa-text { font-size: 16px; color: #555; }
.pronunciation-tip, .ai-section p { font-size: 14px; color: #555; margin: 0; line-height: 1.6; }
.close-button {
  margin-top: 20px;
  padding: 10px;
  border: none;
  background-color: #f0f2f5;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}
@keyframes scale-up { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
