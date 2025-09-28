<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { PlayCircleIcon, MicrophoneIcon } from '@heroicons/vue/24/solid';
import * as speechService from '@/services/speechService';
import { diffWords } from 'diff';
import { supabase } from '@/supabase';

// <--- 从这里开始是新的录音逻辑 --->
let audioContext;
let stream;
let processor;
let audioData = [];
const sampleRate = 16000; // 使用16kHz采样率，这是语音识别的黄金标准

function startAudioRecording() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  return navigator.mediaDevices.getUserMedia({ audio: { sampleRate, channelCount: 1 } })
    .then(micStream => {
      stream = micStream;
      const source = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        audioData.push(...e.inputBuffer.getChannelData(0));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      isListening.value = true;
    });
}

function stopAudioRecording() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  if (processor) {
    processor.disconnect();
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
  }
  isListening.value = false;

  // 将捕获的原始Float32数据编码为WAV格式的Blob
  const wavBlob = encodeWAV(audioData, sampleRate);
  return wavBlob;
}

// 辅助函数：将PCM Float32数据编码为WAV格式
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}

// <--- 到这里结束是新的录音逻辑 --->


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

onMounted(() => {
  handlePlay();
});

function handlePlay() {
    const text = props.sentence.spanish_text;
    const options = {
        onStart: () => activeReader.value = 'play',
        onEnd: () => activeReader.value = null,
    };
    speechService.speak(text, options);
}

// 【核心修改】替换 toggleListening 逻辑
async function toggleListening() {
  if (isListening.value) {
    // 停止录音并处理
    const audioBlob = stopAudioRecording();
    isProcessing.value = true;

    const formData = new FormData();
    // 现在我们发送的是一个wav文件
    formData.append('audio', audioBlob, 'recording.wav');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("用户未认证");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
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
    }
    return;
  }

  // 开始录音
  try {
    transcript.value = '';
    diffResult.value = [];
    error.value = '';
    result.value = null;
    audioData = []; // 重置音频数据
    await startAudioRecording();
  } catch (err) {
    error.value = '请允许使用麦克风权限。';
    console.error('Mic permission error:', err);
  }
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

watch(() => props.sentence, (newSentence, oldSentence) => {
    transcript.value = '';
    diffResult.value = [];
    isListening.value = false;
    isProcessing.value = false;
    error.value = '';
    result.value = null;
    if (isListening.value) {
        stopAudioRecording();
    }
    if (oldSentence) {
        handlePlay();
    }
}, { immediate: false });

onUnmounted(() => {
    if (isListening.value) {
        stopAudioRecording();
    }
});
</script>

<template>
  <div class="test-container speaking-test">
    <p class="instruction">请听并复述你听到的句子：</p>
    <div class="controls">
        <button @click="handlePlay" class="play-btn" :class="{ 'is-playing': activeReader === 'play' }">
            <PlayCircleIcon />
            <span>重听</span>
        </button>
        <button
          @click="toggleListening"
          class="mic-btn"
          :class="{ 'is-listening': isListening, 'is-processing': isProcessing }"
          :disabled="isProcessing"
        >
          <MicrophoneIcon v-if="!isProcessing" />
          <div v-else class="spinner"></div>
        </button>
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
/* 样式部分无需修改 */
.test-container { display: flex; flex-direction: column; gap: 15px; padding: 10px; background-color: #f0f2f5; border-radius: 12px;}
.instruction { text-align: center; color: #555; font-size: 16px; margin: 0; }
.controls { display: flex; justify-content: center; align-items: center; gap: 20px; margin: 10px 0; }
.play-btn { display: flex; align-items: center; gap: 5px; background: none; border: 1px solid #ccc; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 14px; }
.play-btn.is-playing { color: #4A90E2; }
.play-btn svg { width: 20px; height: 20px; }
.mic-btn {
  width: 50px; height: 50px; border-radius: 50%; border: none;
  background-color: #4A90E2; color: white;
  display: flex; justify-content: center; align-items: center;
  cursor: pointer; transition: background-color 0.3s;
}
.mic-btn svg { width: 24px; height: 24px; }
.mic-btn.is-listening { background-color: #dc3545; }
.mic-btn.is-processing { background-color: #6c757d; cursor: not-allowed; }
.spinner {
  width: 24px; height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
