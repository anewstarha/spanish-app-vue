<script setup>
// 所有 import 保持不变
import { ref, computed, watch } from 'vue'
import { useStudyStore } from '@/stores/studyStore'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import * as speechService from '@/services/speechService'
import AiExplanationModal from '@/components/AiExplanationModal.vue'
import { getCoreWordsFromSentence } from '@/utils/textUtils'
import {
  PlayCircleIcon,
  SpeakerWaveIcon,
  ViewColumnsIcon,
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from '@heroicons/vue/24/solid'
import SentenceScrambleTest from '@/components/SentenceScrambleTest.vue'
import VocabularyTest from '@/components/VocabularyTest.vue'
import DictationTest from '@/components/DictationTest.vue'
import ReadAloudTest from '@/components/ReadAloudTest.vue'
import RepeatAloudTest from '@/components/RepeatAloudTest.vue'

// 所有状态和函数定义保持不变
const store = useStudyStore()
const userStore = useUserStore()
const router = useRouter()
const isPlaylistVisible = ref(false)
const activeReader = ref(null)
const isModalVisible = ref(false)
const selectedWord = ref(null)
const wordExplanation = ref(null)
const isExplanationLoading = ref(false)
const mode = ref('studying')
const testResults = ref([])
const TEST_COMPONENTS = {
  scramble: SentenceScrambleTest,
  vocabulary: VocabularyTest,
  dictation: DictationTest,
  read_aloud: ReadAloudTest,
  repeat_aloud: RepeatAloudTest,
}
const testOrder = ref([])
const currentTestIndex = ref(0)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}
const currentTestComponent = computed(() => {
  if (mode.value === 'quizzing' && 
      Array.isArray(testOrder.value) && 
      testOrder.value.length > 0 && 
      currentTestIndex.value < testOrder.value.length) {
    const testKey = testOrder.value[currentTestIndex.value]
    return TEST_COMPONENTS[testKey] || null
  }
  return null
})
// 生成带高亮单词的句子HTML
const highlightedSentence = computed(() => {
  if (!store.currentSentence?.spanish_text) {
    return ''
  }
  
  // 安全检查：确保 allWords 是一个数组
  if (!Array.isArray(store.allWords) || store.allWords.length === 0) {
    return store.currentSentence.spanish_text
  }

  const coreWords = getCoreWordsFromSentence(store.currentSentence.spanish_text)
  const sentenceWords = store.allWords.filter(word =>
    word && word.spanish_word && 
    coreWords.some(cw => cw.toLowerCase() === word.spanish_word.toLowerCase())
  )

  let highlightedText = store.currentSentence.spanish_text

  // 按单词长度降序排序，避免短词被长词包含的问题
  sentenceWords.sort((a, b) => b.spanish_word.length - a.spanish_word.length)

  sentenceWords.forEach(word => {
    const regex = new RegExp(`\\b${word.spanish_word}\\b`, 'gi')
    highlightedText = highlightedText.replace(regex, (match) =>
      `<span class="highlighted-word" data-word-id="${word.id}" data-word="${word.spanish_word}" data-translation="${word.chinese_translation}">${match}</span>`
    )
  })

  return highlightedText
})

// 当前句子中的单词映射，用于点击处理
const sentenceWordsMap = computed(() => {
  if (!store.currentSentence?.spanish_text) return new Map()
  
  // 安全检查：确保 allWords 是一个数组
  if (!Array.isArray(store.allWords) || store.allWords.length === 0) {
    return new Map()
  }

  const coreWords = getCoreWordsFromSentence(store.currentSentence.spanish_text)
  const sentenceWords = store.allWords.filter(word =>
    word && word.spanish_word && 
    coreWords.some(cw => cw.toLowerCase() === word.spanish_word.toLowerCase())
  )

  const map = new Map()
  sentenceWords.forEach(word => {
    map.set(word.id, word)
  })
  return map
})
watch(
  () => store.currentSentence,
  (newSentence) => {
    if (newSentence) {
      mode.value = 'studying'
      currentTestIndex.value = 0
      testResults.value = []
      testOrder.value = shuffleArray(Object.keys(TEST_COMPONENTS))
    }
  },
  { immediate: true },
)
if (import.meta.env.PROD) {
  if (store.allSentencesInSession.length === 0 && !store.isLoading) {
    router.replace({ name: 'study' })
  }
}
function handleJumpTo(index) {
  store.jumpTo(index)
  isPlaylistVisible.value = false
}
function handlePlay(type) {
  if (!store.currentSentence) return
  if (activeReader.value === type) {
    speechService.cancel()
    activeReader.value = null
    return
  }
  const text = store.currentSentence.spanish_text
  const options = {
    isSlow: type === 'slow',
    onStart: () => (activeReader.value = type),
    onEnd: () => (activeReader.value = null),
  }
  if (type === 'word') {
    speechService.speakWordByWord(text, options)
  } else {
    speechService.speak(text, options)
  }
}
// 处理句子中高亮单词点击 - 仅发声
function handleWordClick(event) {
  try {
    const span = event.target.closest('.highlighted-word')
    if (!span) return

    const wordText = span.dataset.word
    if (!wordText) return

    // 仅播放发音
    speechService.speak(wordText)
  } catch (error) {
    console.error('处理单词点击时出错:', error)
  }
}

// 处理AI解释内容，高亮句子中出现的单词
const highlightWordsInAiContent = computed(() => {
  return (text) => {
    if (!text || !store.currentSentence?.spanish_text) return text
    
    // 安全检查：确保 allWords 是一个数组
    if (!Array.isArray(store.allWords) || store.allWords.length === 0) return text

    const coreWords = getCoreWordsFromSentence(store.currentSentence.spanish_text)
    const sentenceWords = store.allWords.filter(word =>
      word && word.spanish_word && 
      coreWords.some(cw => cw.toLowerCase() === word.spanish_word.toLowerCase())
    )

    let highlightedText = text

    // 按单词长度降序排序，避免短词被长词包含
    sentenceWords.sort((a, b) => b.spanish_word.length - a.spanish_word.length)

    sentenceWords.forEach(word => {
      const regex = new RegExp(`\\b${word.spanish_word}\\b`, 'gi')
      highlightedText = highlightedText.replace(regex, (match) =>
        `<span class="ai-word-pill" data-word-id="${word.id}" data-word="${word.spanish_word}">${match}</span>`
      )
    })

    return highlightedText
  }
})

// 处理AI解释中单词点击 - 显示单词解释
function handleAiWordClick(event) {
  try {
    const span = event.target.closest('.ai-word-pill')
    if (!span) return

    const wordId = parseInt(span.dataset.wordId)
    if (isNaN(wordId)) return

    const word = sentenceWordsMap.value.get(wordId)
    if (!word) return

    showWordExplanation(word)
  } catch (error) {
    console.error('处理AI单词点击时出错:', error)
  }
}

async function showWordExplanation(word) {
  selectedWord.value = word
  isModalVisible.value = true
  wordExplanation.value = null
  isExplanationLoading.value = false
  if (word.ai_explanation && Object.keys(word.ai_explanation).length > 0) {
    wordExplanation.value = word.ai_explanation
    return
  }
  isExplanationLoading.value = true
  const newExplanation = await speechService.getWordExplanation(word)
  wordExplanation.value = newExplanation
  isExplanationLoading.value = false
  if (newExplanation) {
    store.cacheWordExplanation({ wordId: word.id, explanation: newExplanation })
  }
}
async function advance() {
  if (mode.value === 'studying') {
    mode.value = 'quizzing'
    currentTestIndex.value = 0
  } else if (mode.value === 'quizzing') {
    if (currentTestIndex.value < testOrder.value.length - 1) {
      currentTestIndex.value++
    } else {
      await store.updateSentenceStatus(store.currentSentence.id, testResults.value)
      if (store.progress.current < store.progress.total) {
        store.goToNext()
      } else {
        await userStore.updateUserProfile({
          current_session_ids: null,
          current_session_progress: null,
        })
        alert('恭喜！您已完成本轮所有学习和测试。')
        router.push({ name: 'study' })
      }
    }
  }
}
function goBack() {
  if (mode.value === 'quizzing') {
    if (currentTestIndex.value > 0) {
      currentTestIndex.value--
    } else {
      mode.value = 'studying'
    }
  } else {
    if (store.progress.current > 1) {
      store.goToPrev()
    }
  }
}
function handleTestAnswered(result) {
  const newResults = [...testResults.value]
  newResults[currentTestIndex.value] = result
  testResults.value = newResults
}
function replayTestAudio() {
  if (mode.value !== 'quizzing' || !store.currentSentence) return
  const options = {
    onStart: () => (activeReader.value = 'replay'),
    onEnd: () => (activeReader.value = null),
  }
  const currentTestKey = testOrder.value[currentTestIndex.value]
  if (currentTestKey === 'vocabulary') {
    const coreWords = getCoreWordsFromSentence(store.currentSentence.spanish_text)
    const wordObj = store.allWords.find(
      (w) => w.spanish_word.toLowerCase() === coreWords[0]?.toLowerCase(),
    )
    if (wordObj) speechService.speak(wordObj.spanish_word, options)
  } else {
    speechService.speak(store.currentSentence.spanish_text, options)
  }
}

function handleContentClick(event) {
  if (event.target && event.target.matches('.clickable-word')) {
    const word = event.target.dataset.word;
    if (word) {
      try {
        speechService.speak(word).catch(err => {
          console.error(`播放单词 "${word}" 失败:`, err);
        });
      } catch (e) {
        console.error("调用 speechService.speak 时发生意外错误:", e);
      }
    }
  }
}
</script>

<template>
  <div class="session-view-container">
    <header class="session-header">
      <button @click="router.back()" class="icon-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="progress-text">{{ store.progress.current }} / {{ store.progress.total }}</div>
      <button @click="isPlaylistVisible = true" class="icon-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      </button>
    </header>

    <main class="session-main">
      <div v-if="store.isLoading" class="loading-indicator">正在加载会话...</div>
      <template v-else-if="store.currentSentence">
        <div v-if="mode === 'studying'">
          <div class="study-card">
            <div class="card-content">
              <p class="spanish-text" @click="handleWordClick" v-html="highlightedSentence"></p>
              <p class="chinese-text">{{ store.currentSentence.chinese_translation }}</p>
            </div>
          </div>
          <div class="collapsible-area">
            <!-- 词汇列表已移除，改为句子内高亮显示 -->
            <details class="collapsible-item">
              <summary>AI 解释</summary>
              <div class="collapsible-content" @click="handleContentClick">
                <div
                  v-if="
                    store.currentSentence.ai_notes &&
                    typeof store.currentSentence.ai_notes === 'object'
                  "
                  class="ai-notes-container"
                  @click="handleAiWordClick"
                >
                  <div class="ai-section" v-if="store.currentSentence.ai_notes.grammar_analysis">
                    <h4 class="ai-section-title">语法解析</h4>
                    <p
                      v-html="highlightWordsInAiContent(store.currentSentence.ai_notes.grammar_analysis)"
                    ></p>
                  </div>

                  <div
                    class="ai-section"
                    v-if="store.currentSentence.ai_notes.translation_analysis"
                  >
                    <h4 class="ai-section-title">翻译解析</h4>
                    <p
                      v-html="highlightWordsInAiContent(store.currentSentence.ai_notes.translation_analysis)"
                    ></p>
                  </div>

                  <div class="ai-section" v-if="store.currentSentence.ai_notes.extended_sentences">
                    <h4 class="ai-section-title">举一反三</h4>

                    <div
                      v-if="typeof store.currentSentence.ai_notes.extended_sentences === 'object'"
                    >
                      <p
                        class="example-spanish"
                        v-html="highlightWordsInAiContent(store.currentSentence.ai_notes.extended_sentences.spanish)"
                      ></p>
                      <p class="example-chinese">
                        {{ store.currentSentence.ai_notes.extended_sentences.chinese }}
                      </p>
                    </div>
                    <p
                      v-else
                      v-html="highlightWordsInAiContent(store.currentSentence.ai_notes.extended_sentences)"
                    ></p>
                  </div>
                </div>
                <p v-else-if="store.currentSentence.ai_notes">正在获取AI解释...</p>
                <p v-else>此句子暂无AI解释。</p>
              </div>
            </details>
          </div>
        </div>

        <div v-else-if="mode === 'quizzing'" class="quiz-area">
          <div class="quiz-progress-header">
            第 {{ currentTestIndex + 1 }} / {{ testOrder.length }} 题
          </div>
          <component
            :is="currentTestComponent"
            :sentence="store.currentSentence"
            :all-words="store.allWords"
            @answered="handleTestAnswered"
          />
        </div>
      </template>
    </main>

    <footer class="session-footer">
      <template v-if="mode === 'studying'">
        <div
          class="footer-nav-item"
          @click="goBack"
          :class="{ disabled: store.progress.current <= 1 }"
        >
          <ArrowLeftCircleIcon class="footer-icon" />
          <span class="footer-label">Anterior</span>
        </div>
        <div
          class="footer-nav-item"
          @click="handlePlay('slow')"
          :class="{ active: activeReader === 'slow' }"
        >
          <SpeakerWaveIcon class="footer-icon" />
          <span class="footer-label">Lento</span>
        </div>
        <div
          class="footer-nav-item"
          @click="handlePlay('normal')"
          :class="{ active: activeReader === 'normal' }"
        >
          <PlayCircleIcon class="footer-icon" />
          <span class="footer-label">朗读</span>
        </div>
        <div
          class="footer-nav-item"
          @click="handlePlay('word')"
          :class="{ active: activeReader === 'word' }"
        >
          <ViewColumnsIcon class="footer-icon" />
          <span class="footer-label">词汇</span>
        </div>
        <div class="footer-nav-item" @click="mode = 'quizzing'">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="footer-icon"
          >
            <path
              d="M21.722 8.65362V6.23999H19.3084V8.65362H21.722ZM18.0947 17.76V10.453H15.6811V17.76H18.0947ZM14.4674 17.76V2.24H12.0537V17.76H14.4674ZM10.84 17.76V6.23999H8.42633V17.76H10.84ZM7.21264 17.76V10.453H4.79899V17.76H7.21264ZM3.58529 8.65362V6.23999H1.17163V8.65362H3.58529Z"
            ></path>
          </svg>
          <span class="footer-label">Prueba</span>
        </div>
      </template>

      <template v-else-if="mode === 'quizzing'">
        <div class="footer-nav-item" @click="goBack">
          <ArrowLeftCircleIcon class="footer-icon" />
          <span class="footer-label">Anterior</span>
        </div>
        <div
          class="footer-nav-item"
          @click="replayTestAudio"
          :class="{ active: activeReader === 'replay' }"
        >
          <PlayCircleIcon class="footer-icon" />
          <span class="footer-label">重复</span>
        </div>
        <div
          class="footer-nav-item"
          @click="advance"
          :class="{ disabled: !testResults[currentTestIndex] }"
        >
          <ArrowRightCircleIcon class="footer-icon" />
          <span class="footer-label">{{
            currentTestIndex < testOrder.length - 1 ? '下一个' : '下一句'
          }}</span>
        </div>
      </template>
    </footer>

    <div v-if="isPlaylistVisible" class="playlist-overlay" @click="isPlaylistVisible = false">
      <div class="playlist-modal" @click.stop>
        <h3>句子列表 ({{ store.progress.total }})</h3>
        <ul class="playlist-content">
          <li
            v-for="(sentence, index) in store.allSentencesInSession"
            :key="sentence.id"
            :class="{ active: index === store.currentSentenceIndex }"
            @click="handleJumpTo(index)"
          >
            <div class="playlist-sentence">
              <span class="playlist-spanish">{{ sentence.spanish_text }}</span>
              <span class="playlist-chinese">{{ sentence.chinese_translation }}</span>
            </div>
            <span v-if="index === store.currentSentenceIndex" class="current-indicator">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              </svg>
            </span>
          </li>
        </ul>
      </div>
    </div>

    <AiExplanationModal
      v-if="isModalVisible"
      :word="selectedWord"
      :explanation="wordExplanation"
      :is-loading="isExplanationLoading"
      @close="isModalVisible = false"
    />
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.session-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f2f2f7;
}
.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  flex-shrink: 0;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 10;
}
.progress-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: #333;
}
.session-main {
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px 15px;
  padding-bottom: 100px;
}
.loading-indicator {
  text-align: center;
  color: #888;
  padding: 40px;
}
.study-card {
  background-color: #ffffff;
  border-radius: 18px;
  padding: 24px 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  text-align: center;
}
.card-content {
  margin-bottom: 10px;
}
.spanish-text {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0 0 15px 0;
  line-height: 1.4;
  cursor: text;
}

.highlighted-word {
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.highlighted-word:hover {
  background-color: #bbdefb;
  color: #0d47a1;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.highlighted-word:active {
  transform: translateY(0);
  background-color: #90caf9;
}

.ai-word-pill {
  background-color: #e8f5e8;
  color: #2e7d2e;
  padding: 3px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  display: inline-block;
  margin: 0 2px;
}

.ai-word-pill:hover {
  background-color: #c8e6c9;
  color: #1b5e20;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ai-word-pill:active {
  transform: translateY(0);
  background-color: #a5d6a7;
}
.chinese-text {
  font-size: 16px;
  color: #8a94a6;
  margin: 0;
}
.collapsible-area {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.collapsible-item {
  background-color: #fff;
  border-radius: 12px;
  border: 1px solid #e5e5e5;
}
.collapsible-item summary {
  padding: 12px 15px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.collapsible-item summary::-webkit-details-marker {
  display: none;
}
.collapsible-content {
  padding: 0 15px 15px;
  color: #8a94a6;
  font-size: 14px;
  border-top: 1px solid #e5e5e5;
}
.collapsible-content p {
  margin: 0;
}
/* 词汇列表样式已删除 - 改为句子内高亮显示 */
.icon-btn-small:hover {
  color: #4a90e2;
}
.icon-btn-small svg {
  width: 18px;
  height: 18px;
}
.quiz-progress-header {
  text-align: center;
  color: #8a94a6;
  font-weight: 600;
  margin-bottom: 15px;
}
.quiz-area {
  margin-top: 20px;
}
.session-footer {
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  padding: 5px 0;
  padding-bottom: calc(5px + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1px solid #e5e5e5;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}
.footer-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 5px 0;
  cursor: pointer;
  color: #8a94a6;
  transition: color 0.2s ease;
}
.footer-nav-item:hover {
  color: #4a90e2;
}
.footer-nav-item.disabled {
  color: #e0e0e0;
  pointer-events: none;
}
.footer-nav-item.active {
  color: #4a90e2;
}
.footer-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 2px;
}
.footer-label {
  font-size: 11px;
  font-weight: 500;
}
.playlist-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 1000;
}
.playlist-modal {
  background-color: #fff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  max-height: 70%;
  display: flex;
  flex-direction: column;
  animation: slide-up 0.3s ease;
}
.playlist-modal h3 {
  padding: 15px;
  margin: 0;
  font-size: 16px;
  text-align: center;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
}
.playlist-content {
  overflow-y: auto;
  padding: 0;
  margin: 0;
  list-style: none;
}
.playlist-content li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.playlist-content li:last-child {
  border-bottom: none;
}
.playlist-content li.active {
  color: #4a90e2;
  font-weight: 600;
}
.playlist-sentence {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.playlist-spanish {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}
.playlist-chinese {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #8a94a6;
}
.current-indicator {
  color: #4a90e2;
  flex-shrink: 0;
  margin-left: 10px;
}
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
