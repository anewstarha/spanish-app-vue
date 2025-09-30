<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { PlayCircleIcon, MicrophoneIcon } from '@heroicons/vue/24/solid';
import * as speechService from '@/services/speechService';
import { diffWords } from 'diff';
import { supabase } from '@/supabase';

// <--- 最终版录音逻辑 --->
let mediaRecorder;
let audioChunks = [];
let audioContext;
const TARGET_SAMPLE_RATE = 16000;

async function startAudioRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    processAndSendAudio();
    stream.getTracks().forEach(track => track.stop());
  };
  mediaRecorder.start();
  isListening.value = true;
}

function stopAudioRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isListening.value = false;
}

async function processAndSendAudio() {
  isProcessing.value = true;
  const rawBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await rawBlob.arrayBuffer();
  const originalAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const resampledAudioBuffer = await resampleAudioBuffer(originalAudioBuffer, TARGET_SAMPLE_RATE);
  const wavBlob = encodeWAV(resampledAudioBuffer);

  await sendAudioToServer(wavBlob);
}

async function sendAudioToServer(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("用户未认证");

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        // 添加 apikey 用于 Supabase 网关验证
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
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
}

async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const oldSampleRate = audioBuffer.sampleRate;
    if (oldSampleRate === targetSampleRate) return audioBuffer;
    const oldLength = audioBuffer.length;
    const newLength = Math.round(oldLength * targetSampleRate / oldSampleRate);
    const offlineContext = new OfflineAudioContext(numberOfChannels, newLength, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    return await offlineContext.startRendering();
}

function encodeWAV(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels, length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length), view = new DataView(buffer);
    const channels = []; let i, sample, offset = 0, pos = 0;
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1);
    setUint16(numOfChan); setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2);
    setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < numOfChan; i++) channels.push(audioBuffer.getChannelData(i));
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
    }
    return new Blob([view], { type: 'audio/wav' });
}
// <--- 录音逻辑结束 --->

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

async function toggleListening() {
  if (isListening.value) {
    stopAudioRecording();
    return;
  }
  try {
    transcript.value = '';
    diffResult.value = [];
    error.value = '';
    result.value = null;
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
