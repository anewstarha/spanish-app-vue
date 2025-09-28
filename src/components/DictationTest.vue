<script setup>
import { ref, watch } from 'vue';
import * as speechService from '@/services/speechService';
import { getCoreWordsFromSentence, splitSentenceForTts } from '@/utils/textUtils';

const props = defineProps({
  sentence: { type: Object, required: true }
});
const emit = defineEmits(['answered']);

const sentenceParts = ref([]);
const userInput = ref('');
const blankWord = ref('');
const result = ref(null);

function setupTest(sentence) {
  if (!sentence) return;
  speechService.speak(sentence.spanish_text);

  const coreWords = getCoreWordsFromSentence(sentence.spanish_text);
  if (coreWords.length > 0) {
    blankWord.value = coreWords[Math.floor(Math.random() * coreWords.length)];
  } else {
    const allWordsInSentence = splitSentenceForTts(sentence.spanish_text);
    blankWord.value = allWordsInSentence[Math.floor(Math.random() * allWordsInSentence.length)] || '';
  }

  const parts = [];
  const regex = new RegExp(`(\\b${blankWord.value}\\b)`, 'i');
  const splitParts = sentence.spanish_text.split(regex);

  parts.push({ type: 'text', value: splitParts[0] });
  if (splitParts.length > 1) {
    parts.push({ type: 'input' });
    parts.push({ type: 'text', value: splitParts[2] || '' });
  }
  sentenceParts.value = parts;
  userInput.value = '';
  result.value = null;
}

function checkAnswer() {
  const isCorrect = userInput.value.trim().toLowerCase() === blankWord.value.toLowerCase();
  result.value = isCorrect ? 'correct' : 'incorrect';
  emit('answered', { isCorrect });
}

watch(() => props.sentence, setupTest, { immediate: true });
</script>

<template>
  <div class="test-container">
    <p class="instruction">Escucha la frase y rellena la palabra que falta.</p>
    <div class="dictation-sentence">
      <template v-for="(part, index) in sentenceParts" :key="index">
        <span v-if="part.type === 'text'">{{ part.value }}</span>
        <input v-if="part.type === 'input'" type="text" v-model="userInput"
               :placeholder="'.'.repeat(blankWord.length)"
               :style="{ width: `${blankWord.length + 2}ch` }"
               class="blank-input"
               @keyup.enter="checkAnswer"
               :disabled="!!result"
               autofocus>
      </template>
    </div>
     <div class="feedback-area">
      <button v-if="result === null" @click="checkAnswer" class="check-btn">Comprobar</button>
      <div v-if="result === 'correct'" class="feedback correct">✓ ¡Correcto!</div>
      <div v-if="result === 'incorrect'" class="feedback incorrect">
        ✗ Incorrecto, la respuesta correcta es: <strong>{{ blankWord }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-container { display: flex; flex-direction: column; gap: 20px; padding: 10px; background-color: #f0f2f5; border-radius: 12px;}
.instruction { text-align: center; color: #555; font-weight: 500; }
.dictation-sentence { text-align: center; font-size: 20px; line-height: 1.6; }
.blank-input {
  border: none; border-bottom: 2px solid #333; background: transparent;
  text-align: center; font-size: 20px; min-width: 60px; margin: 0 5px;
}
.blank-input:focus { outline: none; border-bottom-color: #4A90E2; }
.feedback-area { text-align: center; min-height: 40px; }
.check-btn { padding: 10px 20px; border-radius: 8px; border: none; background-color: #4A90E2; color: white; font-weight: bold; cursor: pointer; }
.feedback { font-weight: bold; font-size: 16px; }
.feedback.correct { color: #28a745; }
.feedback.incorrect { color: #dc3545; }
</style>
