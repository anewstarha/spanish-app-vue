<script setup>
// --- 脚本部分与您之前能正常工作的版本完全一致 ---
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { PlayCircleIcon, MicrophoneIcon } from '@heroicons/vue/24/solid';
import * as speechService from '@/services/speechService';
import { diffWords } from 'diff';
import { supabase } from '@/supabase';

const props = defineProps({
  sentence: { type: Object, required: true }
});
const emit = defineEmits(['answered']);

const transcript = ref('');
const diffResult = ref([]);
const error = ref('');
const result = ref(null);
const activeReader = ref(null);
const isListening = ref(false);
const isProcessing = ref(false);
const mediaRecorder = ref(null);
const audioChunks = ref([]);

function toggleListening() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    error.value = '浏览器不支持麦克风功能。';
    return;
  }
  if (isListening.value) {
    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
      mediaRecorder.value.stop();
    }
    isListening.value = false;
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      audioChunks.value = [];
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
      mediaRecorder.value = new MediaRecorder(stream, options);
      mediaRecorder.value.ondataavailable = event => {
        audioChunks.value.push(event.data);
      };
      mediaRecorder.value.onstop = async () => {
        isProcessing.value = true;
        const audioBlob = new Blob(audioChunks.value, { type: mediaRecorder.value.mimeType });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("用户未认证");
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
            method: 'POST',
            // 注意：您之前的版本可能缺少 apikey，我已经帮您加上以确保万无一失
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: formData,
          });
          if (!response.ok) {
              const errorBody = await response.json();
              throw new Error(errorBody.error || `请求失败，状态码: ${response.status}`);
          }
          const responseData = await response.json();
          if (responseData.RecognitionStatus === 'Success') {
              transcript.value = responseData.DisplayText;
          } else {
              transcript.value = `[识别失败: ${responseData.RecognitionStatus || 'Unknown'}]`;
          }
          checkAnswer();
        } catch (e) {
          error.value = `语音识别失败: ${e.message}`;
          emit('answered', { isCorrect: false });
        } finally {
          isProcessing.value = false;
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorder.value.start();
      isListening.value = true;
    })
    .catch((err) => {
      error.value = `麦克风权限错误: ${err.message}`;
    });
}

function normalizeString(str) {
  return str.toLowerCase().replace(/[.,;!?¿¡]/g, '').trim();
}

function checkAnswer() {
  const cleanOriginal = normalizeString(props.sentence.spanish_text);
  const cleanUser = normalizeString(transcript.value || '');
  const diffs = diffWords(cleanOriginal, cleanUser, { ignoreCase: true });
  diffResult.value = diffs;
  const commonLength = diffs.filter(d => !d.added && !d.removed).reduce((sum, d) => sum + d.value.length, 0);
  const similarity = commonLength / cleanOriginal.length;
  const isCorrect = similarity > 0.85;
  result.value = isCorrect ? 'correct' : 'incorrect';
  emit('answered', { isCorrect });
}

function handlePlay() {
    const text = props.sentence.spanish_text;
    const options = {
        onStart: () => activeReader.value = 'play',
        onEnd: () => activeReader.value = null,
    };
    speechService.speak(text, options);
}

onMounted(() => {
  handlePlay();
});

watch(() => props.sentence, (newSentence, oldSentence) => {
    transcript.value = '';
    diffResult.value = [];
    isListening.value = false;
    isProcessing.value = false;
    error.value = '';
    result.value = null;
    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
        mediaRecorder.value.stop();
    }
    if (oldSentence) {
        handlePlay();
    }
}, { immediate: false });

onUnmounted(() => {
    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
        mediaRecorder.value.stop();
    }
});
</script>

<template>
  <div class="test-container speaking-test">
    <p class="instruction">请听并复述你听到的句子：</p>

    <div class="mic-button-container">
        <button
          @click="toggleListening"
          class="mic-btn"
          :class="{ 'is-listening': isListening, 'is-processing': isProcessing }"
          :disabled="isProcessing"
        >
          <MicrophoneIcon v-if="!isProcessing" />
          <div v-else class="spinner"></div>
        </button>
        <div v-if="isListening" class="listening-indicator"></div>
    </div>

     <p v-if="isProcessing" class="processing-text">正在识别中...</p>
    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="diffResult.length > 0" class="feedback-area">
      <div class="feedback-title">你的回答:</div>
      <p class="user-transcript">{{ transcript }}</p>
      <div class="feedback-title">对比:</div>
      <div class="diff-display">
        <span
          v-for="(part, index) in diffResult"
          :key="index"
          :class="{
            'common-word': !part.added && !part.removed,
            'removed-word': part.removed,
            'added-word': part.added
          }"
        >
          {{ part.value }}
        </span>
      </div>
      <div v-if="result === 'correct'" class="feedback correct">✓ ¡非常棒!</div>
      <div v-if="result === 'incorrect'" class="feedback incorrect">
          ✗ 有待提高，正确句子是: <strong>{{ sentence.spanish_text }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式部分有较大修改 */
.test-container { display: flex; flex-direction: column; gap: 15px; padding: 10px; background-color: #f0f2f5; border-radius: 12px;}
.instruction { text-align: center; color: #555; font-size: 16px; margin: 0; }

/* 【新增】统一的麦克风按钮容器样式 */
.mic-button-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 10px 0;
    position: relative; /* 为脉冲圈定位 */
}

/* 【修改】麦克风按钮样式调整得更大一些以匹配 ReadAloudTest */
.mic-btn {
  width: 60px; height: 60px; border-radius: 50%; border: none;
  background-color: #4A90E2; color: white;
  display: flex; justify-content: center; align-items: center;
  cursor: pointer; transition: background-color 0.3s;
}
.mic-btn svg { width: 30px; height: 30px; }
.mic-btn.is-listening { background-color: #dc3545; }
.mic-btn.is-processing { background-color: #6c757d; cursor: not-allowed; }

/* spinner 样式微调 */
.spinner {
  width: 30px; height: 30px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* 【新增】脉冲圈动画样式 */
.listening-indicator {
  position: absolute; width: 60px; height: 60px;
  border: 2px solid #dc3545; border-radius: 50%;
  animation: pulse 1.5s infinite;
  pointer-events: none; /* 确保它不会干扰按钮点击 */
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* 其他样式保持不变 */
.processing-text { text-align: center; color: #555; }
.error-text { text-align: center; color: #dc3545; }
.feedback-area { margin-top: 10px; border-top: 1px solid #e0e0e0; padding-top: 10px; }
.feedback-title { font-weight: 600; margin-bottom: 5px; text-align: center; }
.user-transcript { text-align: center; font-style: italic; color: #555; }
.diff-display { text-align: center; line-height: 1.6; font-size: 16px; padding: 5px; border-radius: 8px; background: #fff; }
.removed-word { color: #dc3545; text-decoration: line-through; background-color: #f8d7da; }
.added-word { color: #155724; background-color: #d4edda; }
.common-word { color: #6c757d; }
.feedback { font-weight: bold; text-align: center; margin-top: 10px; }
.feedback.correct { color: #28a745; }
.feedback.incorrect { color: #dc3545; line-height: 1.5; }
</style>
