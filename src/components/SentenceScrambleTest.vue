<script setup>
import { ref, watch } from 'vue';
import { splitSentenceForTts } from '@/utils/textUtils';
import * as speechService from '@/services/speechService';

const props = defineProps({
  sentence: { type: Object, required: true }
});
const emit = defineEmits(['answered']);

const originalWords = ref([]);
const shuffledWords = ref([]);
const userAnswer = ref([]);
const result = ref(null);

function setupTest(sentence) {
  if (!sentence) return;
  originalWords.value = splitSentenceForTts(sentence.spanish_text);
  shuffledWords.value = originalWords.value
    .map((word, index) => ({ word, id: index }))
    .sort(() => Math.random() - 0.5);
  userAnswer.value = [];
  result.value = null;
}

function selectWord(wordObject) {
  if (result.value !== null) return;
  speechService.speak(wordObject.word);
  userAnswer.value.push(wordObject);
  shuffledWords.value = shuffledWords.value.filter(w => w.id !== wordObject.id);
}

function unselectWord(wordObject) {
  if (result.value !== null) return;
  speechService.speak(wordObject.word);
  shuffledWords.value.push(wordObject);
  shuffledWords.value.sort((a,b) => a.id - b.id);
  userAnswer.value = userAnswer.value.filter(w => w.id !== wordObject.id);
}

function checkAnswer() {
  const isCorrect = userAnswer.value.map(w => w.word).join(' ') === originalWords.value.join(' ');
  result.value = isCorrect ? 'correct' : 'incorrect';
  emit('answered', { isCorrect });
}

watch(() => props.sentence, setupTest, { immediate: true });
</script>

<template>
  <div class="test-container">
    <p class="instruction">按正确顺序点击单词重组句子。</p>
    <div class="answer-area">
      <button v-for="word in userAnswer" :key="word.id" @click="unselectWord(word)" class="word-chip answer">
        {{ word.word }}
      </button>
      <span v-if="userAnswer.length === 0" class="placeholder">...</span>
    </div>
    <div class="options-area">
      <button v-for="word in shuffledWords" :key="word.id" @click="selectWord(word)" class="word-chip option">
        {{ word.word }}
      </button>
    </div>
    <div class="feedback-area">
      <button v-if="result === null" @click="checkAnswer" class="check-btn">检查答案</button>
      <div v-if="result === 'correct'" class="feedback correct">✓ 正确！</div>
      <div v-if="result === 'incorrect'" class="feedback incorrect">
        ✗ 错误！正确顺序是:<br><strong>{{ originalWords.join(' ') }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-container { display: flex; flex-direction: column; gap: 20px; padding: 10px; background-color: #f0f2f5; border-radius: 12px;}
.instruction { text-align: center; color: #555; font-weight: 500; }
.answer-area { min-height: 50px; background: white; border-radius: 8px; padding: 10px; display: flex; flex-wrap: wrap; gap: 8px; border: 1px solid #ddd; }
.options-area { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.word-chip { padding: 8px 14px; border-radius: 16px; border: 1px solid #ccc; background-color: white; cursor: pointer; font-size: 16px; }
.feedback-area { text-align: center; min-height: 40px; }
.check-btn { padding: 10px 20px; border-radius: 8px; border: none; background-color: #4A90E2; color: white; font-weight: bold; cursor: pointer; }
.feedback { font-weight: bold; font-size: 16px; padding-top: 10px; }
.feedback.correct { color: #28a745; }
.feedback.incorrect { color: #dc3545; line-height: 1.5; }
</style>
