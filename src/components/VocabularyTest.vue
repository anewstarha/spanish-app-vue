<script setup>
import { ref, watch } from 'vue';
import { getCoreWordsFromSentence } from '@/utils/textUtils';
import * as speechService from '@/services/speechService';


const props = defineProps({
  sentence: { type: Object, required: true },
  allWords: { type: Array, required: true }
});
const emit = defineEmits(['answered']);

const keyword = ref(null);
const correctAnswer = ref('');
const options = ref([]);
const result = ref(null);

async function setupTest(sentence) {
  if (!sentence) return;
  result.value = null;
  const coreWords = getCoreWordsFromSentence(sentence.spanish_text);
  if (coreWords.length === 0) { emit('answered', { isCorrect: true, skipped: true }); return; }

  const randomKeyword = coreWords[Math.floor(Math.random() * coreWords.length)];
  const correctWordObj = props.allWords.find(w => w.spanish_word.toLowerCase() === randomKeyword.toLowerCase());

  if (!correctWordObj || !correctWordObj.chinese_translation) { emit('answered', { isCorrect: true, skipped: true }); return; }

  keyword.value = correctWordObj.spanish_word;
  correctAnswer.value = correctWordObj.chinese_translation;

  const distractors = props.allWords
    .filter(w => w.spanish_word.toLowerCase() !== keyword.value.toLowerCase() && w.chinese_translation)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .map(w => w.chinese_translation);
  options.value = [correctAnswer.value, ...distractors].sort(() => 0.5 - Math.random());

  await speechService.speak(keyword.value);
}

function checkAnswer(selectedOption) {
  const isCorrect = selectedOption === correctAnswer.value;
  result.value = { isCorrect, selected: selectedOption };
  emit('answered', { isCorrect });
}

watch(() => props.sentence, setupTest, { immediate: true });
</script>

<template>
  <div class="test-container" v-if="keyword">
    <p class="instruction">选择您听到的单词的意思。</p>
    <div class="mcq-options">
      <button v-for="opt in options" :key="opt" @click="checkAnswer(opt)"
              :disabled="!!result"
              :class="{
                correct: result && opt === correctAnswer,
                incorrect: result && !result.isCorrect && result.selected === opt,
              }"
              class="option-btn">
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.test-container { display: flex; flex-direction: column; gap: 20px; padding: 10px; background-color: #f0f2f5; border-radius: 12px;}
.instruction { text-align: center; color: #555; font-size: 16px; line-height: 1.5; }
.mcq-options { display: grid; grid-template-columns: 1fr; gap: 10px; }
.option-btn { padding: 12px; border-radius: 8px; border: 1px solid #ccc; background-color: white; cursor: pointer; font-size: 15px; text-align: center; transition: all 0.2s ease; }
.option-btn:disabled { cursor: not-allowed; opacity: 0.8; }
.option-btn.correct { background-color: #d4edda; border-color: #c3e6cb; color: #155724; font-weight: bold; }
.option-btn.incorrect { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
</style>
