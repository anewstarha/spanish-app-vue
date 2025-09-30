<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as dataService from '@/services/dataService';
import { useUserStore } from '@/stores/userStore';
import { useUiStore } from '@/stores/uiStore'; // 【新增】
import { useRouter } from 'vue-router';
import { supabase } from '@/supabase';
import AppHeader from '@/components/AppHeader.vue';
import SentenceScrambleTest from '@/components/SentenceScrambleTest.vue';
import VocabularyTest from '@/components/VocabularyTest.vue';
import DictationTest from '@/components/DictationTest.vue';
import ReadAloudTest from '@/components/ReadAloudTest.vue';
import RepeatAloudTest from '@/components/RepeatAloudTest.vue';
import { PlayCircleIcon, ArrowLeftCircleIcon, ArrowRightCircleIcon } from '@heroicons/vue/24/solid';
import * as speechService from '@/services/speechService';
import { getCoreWordsFromSentence } from '@/utils/textUtils';

const allSentences = ref([]);
const allWords = ref([]);
const allTags = ref([]);
const isLoading = ref(true);
const router = useRouter();
const userStore = useUserStore();
const uiStore = useUiStore(); // 【新增】
const pageState = ref('filtering');
const activeReader = ref(null);
const filters = ref({
  mastery: 'unmastered',
  studied: 'studied',
  tags: [],
});
const quizQuestions = ref([]);
const currentQuestionIndex = ref(0);
const isAnswered = ref(false);
const areTagsExpanded = ref(false);
const contentWrapperRef = ref(null);

const TEST_COMPONENTS = {
  scramble: SentenceScrambleTest,
  vocabulary: VocabularyTest,
  dictation: DictationTest,
  read_aloud: ReadAloudTest,
  repeat_aloud: RepeatAloudTest,
};
const testKeys = Object.keys(TEST_COMPONENTS);

// 【修改】监听 pageState 来控制导航栏可见性
watch(pageState, (newState) => {
  if (newState === 'quizzing' || newState === 'finished') {
    uiStore.setNavVisibility(false); // 测试开始或结束后，隐藏主导航
  } else {
    uiStore.setNavVisibility(true); // 在筛选页面，显示主导航
  }
}, { immediate: true });

// 【新增】组件卸载时，确保恢复主导航的可见性
onUnmounted(() => {
  uiStore.setNavVisibility(true);
});

onMounted(async () => {
  if (!userStore.user) {
    isLoading.value = false;
    return;
  }

  // 【修改】恢复测试的逻辑
  const unfinishedQuiz = userStore.profile?.current_quiz_questions;
  const shouldAutoResume = history.state?.autoResume === true;

  if (unfinishedQuiz && unfinishedQuiz.length > 0) {
    if (shouldAutoResume || confirm("Se encontró un test no finalizado. ¿Deseas continuar?")) {
        const progress = userStore.profile.current_quiz_progress || 0;
        quizQuestions.value = unfinishedQuiz;
        currentQuestionIndex.value = progress;
        isAnswered.value = false;
        pageState.value = 'quizzing';
        isLoading.value = false;
        return;
    } else {
        await userStore.updateUserProfile({ current_quiz_questions: null, current_quiz_progress: null });
    }
  }

  try {
    const data = await dataService.getStudyData();
    allSentences.value = data.sentences;
    allTags.value = data.allTags;
    const wordsResponse = await supabase.from('high_frequency_words').select('*').eq('user_id', userStore.user.id);
    if(wordsResponse.data) allWords.value = wordsResponse.data;
  } catch (error) {
    console.error('加载数据时出错:', error);
  } finally {
    isLoading.value = false;
  }
});

const filteredSentences = computed(() => {
  if (!allSentences.value) return [];
  return allSentences.value.filter(sentence => {
    if (filters.value.mastery !== 'all' && (sentence.is_mastered || false) !== (filters.value.mastery === 'mastered')) return false;
    if (filters.value.studied !== 'all' && (sentence.is_studied || false) !== (filters.value.studied === 'studied')) return false;
    const sentenceTags = sentence.tags || [];
    if (filters.value.tags.length > 0 && !filters.value.tags.includes('Todos')) {
        let matchesTag = false;
        if (filters.value.tags.includes('Sin etiqueta') && sentenceTags.length === 0) matchesTag = true;
        if (sentenceTags.some(tag => filters.value.tags.includes(tag))) matchesTag = true;
        if (!matchesTag) return false;
    }
    return true;
  });
});

const tagsWithCounts = computed(() => {
    const counts = {};
    let untaggedCount = 0;
    const preFiltered = allSentences.value.filter(s => {
        if (filters.value.mastery !== 'all' && (s.is_mastered || false) !== (filters.value.mastery === 'mastered')) return false;
        if (filters.value.studied !== 'all' && (s.is_studied || false) !== (filters.value.studied === 'studied')) return false;
        return true;
    });
    preFiltered.forEach(s => {
        if (s.tags && s.tags.length > 0) s.tags.forEach(tag => counts[tag] = (counts[tag] || 0) + 1);
        else untaggedCount++;
    });
    const tagList = allTags.value.map(tag => ({ name: tag, count: counts[tag] || 0 }));
    tagList.unshift({ name: 'Sin etiqueta', count: untaggedCount });
    tagList.unshift({ name: 'Todos', count: preFiltered.length });
    return tagList.filter(t => t.count > 0);
});

const currentQuestion = computed(() => quizQuestions.value[currentQuestionIndex.value]);
const currentTestComponent = computed(() => {
    if(currentQuestion.value) {
        return TEST_COMPONENTS[currentQuestion.value.testKey];
    }
    return null;
});

const showExpandButton = ref(false);
const tagListRef = ref(null);
watch(tagsWithCounts, () => {
    nextTick(() => {
        if (tagListRef.value) {
            showExpandButton.value = tagListRef.value.scrollHeight > tagListRef.value.clientHeight;
        }
    });
}, { deep: true, immediate: true });

function collapseTags() {
    areTagsExpanded.value = false;
    if (contentWrapperRef.value) {
        contentWrapperRef.value.scrollTop = 0;
    }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function startQuiz() {
  if (filteredSentences.value.length === 0) {
    alert('没有符合条件的句子可供练习。');
    return;
  }

  await userStore.updateUserProfile({ last_quiz_filters: filters.value });

  let allPossibleQuestions = [];
  filteredSentences.value.forEach(sentence => {
    testKeys.forEach(key => {
        allPossibleQuestions.push({
            sentence: sentence,
            testKey: key
        });
    });
  });
  quizQuestions.value = shuffleArray(allPossibleQuestions);
  currentQuestionIndex.value = 0;
  isAnswered.value = false;

  await userStore.updateUserProfile({
      current_quiz_questions: quizQuestions.value,
      current_quiz_progress: 0
  });

  pageState.value = 'quizzing';
}

async function advanceToNextQuestion() {
  if (isAnswered.value && currentQuestionIndex.value < quizQuestions.value.length - 1) {
    currentQuestionIndex.value++;
    isAnswered.value = false;
    await userStore.updateUserProfile({ current_quiz_progress: currentQuestionIndex.value });
  } else if(isAnswered.value) {
    await userStore.updateUserProfile({ current_quiz_questions: null, current_quiz_progress: null });
    pageState.value = 'finished';
  }
}

async function goBack() {
    if(currentQuestionIndex.value > 0) {
        currentQuestionIndex.value--;
        isAnswered.value = false;
        await userStore.updateUserProfile({ current_quiz_progress: currentQuestionIndex.value });
    }
}

function handleAnswered(result) {
  isAnswered.value = true;
}

async function resetQuiz() {
    await userStore.updateUserProfile({ current_quiz_questions: null, current_quiz_progress: null });
    pageState.value = 'filtering';
    quizQuestions.value = [];
    currentQuestionIndex.value = 0;
}

function toggleTag(tag) {
  if (tag === 'Todos') {
    filters.value.tags = [];
    return;
  }
  const index = filters.value.tags.indexOf(tag);
  if (index > -1) filters.value.tags.splice(index, 1);
  else filters.value.tags.push(tag);
}

function replayTestAudio() {
  if (pageState.value !== 'quizzing' || !currentQuestion.value) return;
  const options = { onStart: () => activeReader.value = 'replay', onEnd: () => activeReader.value = null };
  const { sentence, testKey } = currentQuestion.value;
  if (testKey === 'vocabulary') {
    const coreWords = getCoreWordsFromSentence(sentence.spanish_text);
    if (coreWords.length > 0) {
        const wordObj = allWords.value.find(w => w.spanish_word.toLowerCase() === coreWords[0]?.toLowerCase());
        if(wordObj) speechService.speak(wordObj.spanish_word, options);
    }
  } else if (testKey !== 'read_aloud') {
    speechService.speak(sentence.spanish_text, options);
  }
}
</script>

<template>
    <div class="page-container" :class="{ 'is-expanded': areTagsExpanded }">
        <div v-if="pageState === 'filtering'" class="filter-wrapper">
            <AppHeader />
            <div v-if="isLoading" class="loading-indicator">Cargando...</div>
            <div v-else class="content-wrapper" ref="contentWrapperRef">
                <div class="main-card">
                    <div class="filter-section">
                        <div class="filter-group">
                            <label>Estudio</label>
                            <div class="pill-switch">
                                <button @click="filters.studied = 'studied'" :class="{active: filters.studied === 'studied'}">Sí</button>
                                <button @click="filters.studied = 'unstudied'" :class="{active: filters.studied === 'unstudied'}">No</button>
                                <button @click="filters.studied = 'all'" :class="{active: filters.studied === 'all'}">Todos</button>
                            </div>
                        </div>
                        <div class="filter-group">
                            <label>Dominio</label>
                            <div class="pill-switch">
                                <button @click="filters.mastery = 'unmastered'" :class="{active: filters.mastery === 'unmastered'}">No</button>
                                <button @click="filters.mastery = 'mastered'" :class="{active: filters.mastery === 'mastered'}">Sí</button>
                                <button @click="filters.mastery = 'all'" :class="{active: filters.mastery === 'all'}">Todos</button>
                            </div>
                        </div>
                    </div>
                    <div class="tags-section">
                        <label class="section-title">Etiquetas</label>
                        <div class="tag-list" ref="tagListRef">
                            <button v-for="tag in tagsWithCounts" :key="tag.name" @click="toggleTag(tag.name)" class="tag"
                                    :class="{ 'active': (tag.name === 'Todos' && filters.tags.length === 0) || filters.tags.includes(tag.name) }">
                            {{ tag.name }} <span>{{ tag.count }}</span>
                            </button>
                        </div>
                         <button v-if="showExpandButton && !areTagsExpanded" @click="areTagsExpanded = true" class="expand-btn">
                            Más...
                        </button>
                        <button v-if="areTagsExpanded" @click="collapseTags" class="expand-btn">
                            Mostrar menos
                        </button>
                    </div>
                    <div class="action-section">
                        <button @click="startQuiz" class="btn btn-primary">
                            Practicar ({{ filteredSentences.length * 5 }})
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="pageState === 'quizzing' && currentQuestion" class="quiz-container">
            <header class="quiz-header">
                <button @click="resetQuiz" class="back-btn" title="Salir de la prueba">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
                        <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div class="progress-text">
                    {{ currentQuestionIndex + 1 }} / {{ quizQuestions.length }}
                </div>
                <div class="placeholder"></div>
            </header>
            <main class="quiz-main">
                <component
                    :is="currentTestComponent"
                    :sentence="currentQuestion.sentence"
                    :all-words="allWords"
                    @answered="handleAnswered"
                />
            </main>
            <footer class="quiz-footer">
                <div class="footer-nav-item" @click="goBack" :class="{ disabled: currentQuestionIndex === 0 }">
                    <ArrowLeftCircleIcon class="footer-icon" />
                    <span class="footer-label">Anterior</span>
                </div>
                <div class="footer-nav-item" @click="replayTestAudio" :class="{ active: activeReader === 'replay' }">
                    <PlayCircleIcon class="footer-icon" />
                    <span class="footer-label">Repetir</span>
                </div>
                <div class="footer-nav-item" @click="advanceToNextQuestion" :class="{ disabled: !isAnswered }">
                    <ArrowRightCircleIcon class="footer-icon" />
                    <span class="footer-label">{{ currentQuestionIndex < quizQuestions.length - 1 ? 'Siguiente' : 'Finalizar' }}</span>
                </div>
            </footer>
        </div>
        <div v-else-if="pageState === 'finished'" class="finished-container">
            <h2>¡Felicidades!</h2>
            <p>Has completado {{ quizQuestions.length }} ejercicios.</p>
            <button @click="resetQuiz" class="btn btn-primary">Practicar de nuevo</button>
            <button @click="router.push('/')" class="secondary-button">Volver al inicio</button>
        </div>
    </div>
</template>

<style scoped>
/* 大部分样式保持不变 */
.page-container { padding: 0 var(--spacing-md); display: flex; flex-direction: column; height: 100%; background-color: #f2f2f7; }
.filter-wrapper { height: 100%; display: flex; flex-direction: column; }
.loading-indicator { margin: auto; }
.content-wrapper { flex-grow: 1; display: flex; min-height: 0; overflow: hidden; }
.main-card { background: white; border-radius: var(--spacing-lg); padding: var(--spacing-lg); box-shadow: 0 8px 30px rgba(0,0,0,0.1); width: 100%; max-width: 500px; margin: auto; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--spacing-lg); }
.filter-section { display: flex; flex-direction: column; gap: var(--spacing-md); }
.filter-group { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); }
.filter-group label { font-weight: 600; color: var(--primary-text); font-size: var(--font-size-md); margin-right: var(--spacing-sm); flex-shrink: 0; }
@media (min-width: 480px) { .filter-group { flex-direction: row; align-items: center; justify-content: space-between; } }
.tags-section { display: flex; flex-direction: column; gap: var(--spacing-sm); flex-grow: 1; min-height: 0; }
.section-title { font-weight: 600; color: var(--primary-text); font-size: var(--font-size-md); flex-shrink: 0; }
.tag-list { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); max-height: 7.5rem; overflow-y: auto; }
.is-expanded .tag-list { max-height: none; overflow: visible; }
.expand-btn { border: none; background: none; color: var(--accent-blue); font-weight: 600; cursor: pointer; text-align: left; padding: var(--spacing-xs) 0; }
.action-section { border-top: 1px solid #f0f0f0; padding-top: var(--spacing-lg); }
.quiz-container { display: flex; flex-direction: column; height: 100%; background-color: #f2f2f7; }
.quiz-header {
    /* 【修改】 */
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    padding-top: calc(10px + env(safe-area-inset-top));
    background-color: white;
    border-bottom: 1px solid #e5e5e5;
    flex-shrink: 0;
}
.progress-text { font-weight: 600; font-size: var(--font-size-base); }
.quiz-main { flex-grow: 1; padding: var(--spacing-lg) var(--spacing-md); overflow-y: auto; }
.quiz-footer { display: flex; justify-content: space-around; align-items: stretch; background-color: white; border-top: 1px solid #e5e5e5; padding-bottom: env(safe-area-inset-bottom); flex-shrink: 0; }
.footer-nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 8px 0; cursor: pointer; color: #8A94A6; transition: color 0.2s; }
.footer-nav-item.disabled { color: #e0e0e0; pointer-events: none; }
.footer-nav-item:hover { color: #4A90E2; }
.footer-icon { width: 28px; height: 28px; margin-bottom: 2px; }
.footer-label { font-size: 11px; font-weight: 500; }
.finished-container { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: var(--spacing-lg); padding: var(--spacing-lg); flex-grow: 1; }
.secondary-button { background: none; border: none; color: var(--accent-blue); font-weight: 600; cursor: pointer; }
.pill-switch { display: flex; background-color: #f0f2f5; border-radius: 8px; padding: var(--spacing-xs); }
.pill-switch button { padding: var(--spacing-xs) var(--spacing-md); font-size: var(--font-size-md); border: none; background-color: transparent; border-radius: 6px; font-weight: 500; cursor: pointer; color: #888; }
.pill-switch button.active { background-color: white; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.tag { font-size: var(--font-size-md); font-weight: 500; border: 1px solid #e0e0e0; background-color: #f7f7f7; color: var(--primary-text); cursor: pointer; border-radius: 999px; padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md); display: inline-flex; align-items: center; gap: var(--spacing-xs); transition: all 0.2s ease; }
.tag.active { color: white; background-color: #4A90E2; border-color: #4A90E2; }
.tag span { font-size: var(--font-size-sm); font-weight: 600; color: var(--primary-text); background-color: #e0e0e0; min-width: 1.5em; height: 1.5em; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.tag.active span { color: #4A90E2; background-color: white; }
/* 【新增】返回按钮和占位符样式 */
.back-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 5px;
    color: var(--primary-text);
    display: flex;
    align-items: center;
    justify-content: center;
}
.placeholder {
    width: 34px; /* 与按钮宽度大致相等，以保证标题居中 */
    height: 34px;
}
</style>
