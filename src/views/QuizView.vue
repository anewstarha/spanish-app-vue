<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as dataService from '@/services/dataService';
import { useUserStore } from '@/stores/userStore';
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

// ... 其他 ref 和常量定义保持不变 ...
const allSentences = ref([]);
const allWords = ref([]);
const allTags = ref([]);
const isLoading = ref(true);
const router = useRouter();
const userStore = useUserStore();
const pageState = ref('filtering');
const activeReader = ref(null);
const filters = ref({
  mastery: 'unmastered',
  studied: 'studied',
  tags: [],
});
const showResumeQuizDialog = ref(false);
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


onMounted(async () => {
  if (!userStore.user) {
    isLoading.value = false;
    return;
  }

  // --- 【核心修改】 ---
  const unfinishedQuiz = userStore.profile?.current_quiz_questions;
  // 检查导航状态，看是否是从主页的“快速测试”按钮跳转过来的
  const shouldAutoResume = history.state?.autoResume === true;

  if (unfinishedQuiz && unfinishedQuiz.length > 0) {
    // 如果是自动恢复，直接恢复会话
    if (shouldAutoResume) {
        const progress = userStore.profile.current_quiz_progress || 0;
        quizQuestions.value = unfinishedQuiz;
        currentQuestionIndex.value = progress;
        isAnswered.value = false;
        pageState.value = 'quizzing';
        isLoading.value = false;
        return; // 直接进入测试，跳过后续数据加载
    } else {
        // 显示自定义弹窗
        showResumeQuizDialog.value = true;
        isLoading.value = false;
        return;
    }
  }
  // --- 【修改结束】 ---

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

// ... 其他所有函数 (filteredSentences, tagsWithCounts, etc.) 保持不变 ...
const filteredSentences = computed(() => {
  if (!allSentences.value) return [];
  return allSentences.value.filter(sentence => {
    if (filters.value.mastery !== 'all' && (sentence.is_mastered || false) !== (filters.value.mastery === 'mastered')) return false;
    if (filters.value.studied !== 'all' && (sentence.is_studied || false) !== (filters.value.studied === 'studied')) return false;
    const sentenceTags = sentence.tags || [];
    if (filters.value.tags.length > 0 && !filters.value.tags.includes('全部')) {
        let matchesTag = false;
        if (filters.value.tags.includes('无标签') && sentenceTags.length === 0) matchesTag = true;
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
    tagList.unshift({ name: '无标签', count: untaggedCount });
    tagList.unshift({ name: '全部', count: preFiltered.length });
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
const screenHeight = ref(window.innerHeight);

// 监听窗口大小变化
const handleResize = () => {
    screenHeight.value = window.innerHeight;
    checkExpandButton();
};

// 精细的DOM测量逻辑 - 检查标签内容是否实际溢出
const checkExpandButton = () => {
    nextTick(() => {
        if (!tagListRef.value) {
            showExpandButton.value = false;
            return;
        }

        // 获取标签容器的实际尺寸
        const containerRect = tagListRef.value.getBoundingClientRect();
        const containerHeight = containerRect.height;
        const scrollHeight = tagListRef.value.scrollHeight;

        // 精确检测：当内容高度超过容器高度时显示展开按钮
        const isOverflowing = scrollHeight > containerHeight + 5; // 5px 容错

        // 额外检查：确保有足够的标签数量才启用展开功能
        const hasEnoughTags = tagsWithCounts.value.length > 3;

        showExpandButton.value = isOverflowing && hasEnoughTags;

        // 如果内容不再溢出，自动收起展开状态
        if (!isOverflowing && areTagsExpanded.value) {
            areTagsExpanded.value = false;
        }
    });
};

watch(tagsWithCounts, checkExpandButton, { deep: true, immediate: true });

watch(tagsWithCounts, checkExpandButton, { deep: true, immediate: true });

onMounted(() => {
    window.addEventListener('resize', handleResize);
    checkExpandButton();
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
});
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
function handleAnswered() {
  isAnswered.value = true;
}
async function resetQuiz() {
    await userStore.updateUserProfile({ current_quiz_questions: null, current_quiz_progress: null });
    pageState.value = 'filtering';
}

async function handleContinueQuiz() {
    // 继续未完成的测试
    showResumeQuizDialog.value = false;
    const unfinishedQuiz = userStore.profile?.current_quiz_questions;
    const progress = userStore.profile.current_quiz_progress || 0;
    quizQuestions.value = unfinishedQuiz;
    currentQuestionIndex.value = progress;
    isAnswered.value = false;
    pageState.value = 'quizzing';
}

async function handleReselectQuiz() {
    // 重新选择，清除未完成的测试
    showResumeQuizDialog.value = false;
    await userStore.updateUserProfile({ current_quiz_questions: null, current_quiz_progress: null });
    // 继续加载数据以便重新选择
    try {
        const data = await dataService.getStudyData();
        allSentences.value = data.sentences;
        allTags.value = data.allTags;
    } catch (error) {
        console.error('加载测试数据时出错:', error);
    } finally {
        isLoading.value = false;
    }
}
function toggleTag(tag) {
  if (tag === '全部') {
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
    <!-- 继续测试弹窗 -->
    <div v-if="showResumeQuizDialog" class="dialog-overlay">
      <div class="dialog-content">
        <h3>发现未完成的测试</h3>
        <p>您有一个进行中的测试，是否要继续？</p>
        <div class="dialog-buttons">
          <button @click="handleContinueQuiz" class="btn btn-primary">继续测试</button>
          <button @click="handleReselectQuiz" class="btn btn-secondary">重新选择</button>
        </div>
      </div>
    </div>

    <div class="page-container">
        <div v-if="pageState === 'filtering'" class="filter-wrapper">
            <AppHeader />
            <div v-if="isLoading" class="loading-indicator">正在加载...</div>
            <div v-else class="content-wrapper" ref="contentWrapperRef">
                <div class="main-card">
                    <div class="filter-section">
                        <div class="filter-group">
                            <label>学习状态</label>
                            <div class="pill-switch">
                                <button @click="filters.studied = 'studied'" :class="{active: filters.studied === 'studied'}">是</button>
                                <button @click="filters.studied = 'unstudied'" :class="{active: filters.studied === 'unstudied'}">否</button>
                                <button @click="filters.studied = 'all'" :class="{active: filters.studied === 'all'}">全部</button>
                            </div>
                        </div>
                        <div class="filter-group">
                            <label>掌握程度</label>
                            <div class="pill-switch">
                                <button @click="filters.mastery = 'unmastered'" :class="{active: filters.mastery === 'unmastered'}">否</button>
                                <button @click="filters.mastery = 'mastered'" :class="{active: filters.mastery === 'mastered'}">是</button>
                                <button @click="filters.mastery = 'all'" :class="{active: filters.mastery === 'all'}">全部</button>
                            </div>
                        </div>
                    </div>
                    <div class="tags-section" :class="{
                        'has-overflow': showExpandButton,
                        'expanded': areTagsExpanded && showExpandButton
                    }">
                        <label class="section-title">
                            标签
                        </label>
                        <div class="tag-list" ref="tagListRef">
                            <button v-for="tag in tagsWithCounts" :key="tag.name" @click="toggleTag(tag.name)" class="tag"
                                    :class="{ 'active': (tag.name === '全部' && filters.tags.length === 0) || filters.tags.includes(tag.name) }">
                            {{ tag.name }} <span>{{ tag.count }}</span>
                            </button>
                        </div>
                         <button v-if="showExpandButton && !areTagsExpanded" @click="areTagsExpanded = true" class="expand-btn">
                            更多...
                        </button>
                        <button v-if="areTagsExpanded" @click="collapseTags" class="expand-btn">
                            显示更少
                        </button>
                    </div>
                    <div class="action-section">
                        <button @click="startQuiz" class="btn btn-primary">
                            开始练习 ({{ filteredSentences.length * 5 }})
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div v-else-if="pageState === 'quizzing' && currentQuestion" class="quiz-container">
            <header class="quiz-header">
                <div class="progress-text">
                    {{ currentQuestionIndex + 1 }} / {{ quizQuestions.length }}
                </div>
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
                    <span class="footer-label">重复</span>
                </div>
                <div class="footer-nav-item" @click="advanceToNextQuestion" :class="{ disabled: !isAnswered }">
                    <ArrowRightCircleIcon class="footer-icon" />
                    <span class="footer-label">{{ currentQuestionIndex < quizQuestions.length - 1 ? '下一题' : '完成' }}</span>
                </div>
            </footer>
        </div>
        <div v-else-if="pageState === 'finished'" class="finished-container">
            <h2>恭喜！</h2>
            <p>Has completado {{ quizQuestions.length }} ejercicios.</p>
            <button @click="resetQuiz" class="btn btn-primary">再次练习</button>
            <button @click="router.push('/')" class="secondary-button">回到首页</button>
        </div>
    </div>
</template>

<style scoped>
/* Estilos existentes de QuizView... */
.page-container {
    padding: 0 var(--spacing-md);
    padding-bottom: 10px; /* 减少到10px，让按钮更靠近底部导航 */
    display: flex;
    flex-direction: column;
    height: 100%; /* 占满可用空间 */
    background-color: #f2f2f7;
    box-sizing: border-box;
}

/* 响应式页面padding */
@media (min-width: 431px) {
    .page-container {
        padding: 0 var(--spacing-lg);
    }
}

@media (min-width: 769px) {
    .page-container {
        padding: 0 calc(var(--spacing-lg) * 2);
    }
}
.filter-wrapper { height: 100%; display: flex; flex-direction: column; }
.loading-indicator { margin: auto; }
.content-wrapper {
  flex-grow: 1;
  display: flex;
  min-height: 0;
  /* 移除固定高度，让内容自然流动 */
  overflow: visible; /* 允许bottom padding显示 */
}
.main-card {
    background: white;
    border-radius: var(--spacing-lg);
    padding: var(--spacing-lg);
    box-shadow: 0 8px 30px rgba(0,0,0,0.1);
    width: 100%;
    margin: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    flex: 1; /* 占用剩余空间 */
    min-height: 0; /* 允许内容收缩 */
    overflow: hidden; /* 防止内容溢出 */
}

/* 小屏幕展开状态：允许卡片内容滚动 */
@media (max-height: 699px) {
  .is-expanded .main-card {
    overflow-y: auto;
    /* 为底部导航留出空间 */
    padding-bottom: 100px !important;
  }
}

/* 响应式最大宽度 - 根据屏幕大小调整 */
@media (max-width: 430px) {
    .main-card {
        max-width: 100%;
    }
}

@media (min-width: 431px) and (max-width: 768px) {
    .main-card {
        max-width: 600px;
    }
}

@media (min-width: 769px) {
    .main-card {
        max-width: 700px;
    }
}
.filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    flex: 1;
    min-height: 0;
    overflow-y: auto; /* 允许滚动 */
}
.filter-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
}
.filter-group label {
    font-weight: 600; color: var(--primary-text); font-size: var(--font-size-md);
    margin-right: var(--spacing-sm); flex-shrink: 0;
}
@media (min-width: 480px) {
    .filter-group {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
}
.tags-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex-grow: 1;
    min-height: 0;
}

/* 高屏幕优化：适当增加间距 */
@media (min-height: 800px) {
  .tags-section {
    gap: var(--spacing-md);
  }
}
.section-title {
    font-weight: 600;
    color: var(--primary-text);
    font-size: var(--font-size-md);
    flex-shrink: 0;
}

/* Enhanced section titles for tall screens */
@media (min-height: 800px) {
  .section-title {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-xs);
  }
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  transition: max-height 0.3s ease;
}

/* 默认状态：小屏幕限制高度 */
/* 精细的内容响应样式 - 基于实际溢出状态 */
.tag-list {
  max-height: 240px; /* 默认限制高度 */
  overflow: hidden;
  transition: max-height 0.3s ease;
}

/* 当内容溢出且展开时 */
.tags-section.expanded .tag-list {
  max-height: 60vh;
  overflow-y: auto;
}

/* 当内容未溢出时，无需限制高度 */
.tags-section:not(.has-overflow) .tag-list {
  max-height: none;
  overflow: visible;
}

/* 展开时让tags-section占据更多空间 */
.tags-section.expanded {
  flex-grow: 2;
}

/* 当没有溢出时隐藏展开按钮 */
.tags-section:not(.has-overflow) .expand-btn {
  display: none;
}
.expand-btn {
    border: none; background: none; color: var(--accent-blue);
    font-weight: 600; cursor: pointer; text-align: left;
    padding: var(--spacing-xs) 0;
    display: none; /* 默认隐藏 */
}

/* Enhanced expand button for tall screens */
@media (min-height: 800px) {
  .expand-btn {
    padding: var(--spacing-sm) 0;
    font-size: var(--font-size-base);
  }
}
.action-section {
    border-top: 1px solid #f0f0f0;
    padding-top: var(--spacing-lg);
    flex-shrink: 0; /* 防止被压缩 */
    margin-top: auto; /* 推到main-card底部，靠近底部导航 */
}

/* 高屏幕优化：适当增加间距 */
@media (min-height: 800px) {
  .content-wrapper {
    padding: var(--spacing-xl);
  }

  .filter-section {
    gap: var(--spacing-lg);
  }

  .action-section {
    padding-top: var(--spacing-xl);
  }

  /* 高屏幕设备：增加底部间距 */
  .quiz-main {
    padding-bottom: calc(var(--spacing-xl) + 140px); /* 更多空间给双层导航 */
  }
}

/* 小屏幕设备：确保足够的底部间距 */
@media (max-height: 600px) {
  .quiz-main {
    padding-bottom: calc(var(--spacing-lg) + 100px); /* 小屏幕也要为双层导航留空间 */
  }
}
.quiz-container { display: flex; flex-direction: column; height: 100%; background-color: #f2f2f7; }
.quiz-header { text-align: center; padding: 8px; padding-top: calc(8px + env(safe-area-inset-top)); background-color: transparent; border-bottom: none; flex-shrink: 0; }
.progress-text { font-weight: 600; font-size: var(--font-size-base); display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(60,60,67,0.06); color: var(--primary-text); }
.quiz-main {
  flex-grow: 1;
  padding: var(--spacing-lg) var(--spacing-md);
  padding-bottom: calc(var(--spacing-lg) + 120px); /* 为页面导航(60px) + 全局导航(60px)预留空间 */
  overflow-y: auto;
}
.quiz-footer {
  display: flex;
  justify-content: space-around;
  align-items: center; /* 改为center，与BottomNav保持一致 */
  background-color: white;
  border-top: 1px solid #eee; /* 统一边框色 */
  padding: 10px 0; /* 统一padding */
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  flex-shrink: 0;
  min-height: 60px; /* 确保最小高度 */
}
.footer-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: pointer;
  color: #8A94A6;
  transition: color 0.12s;
  text-decoration: none;
}
.footer-nav-item.disabled { color: #e0e0e0; pointer-events: none; }
.footer-nav-item:hover { color: #4A90E2; }
.footer-icon {
  width: 28px;
  height: 28px;
  margin-bottom: 6px; /* Increased spacing */
  background: rgba(60,60,67,0.06);
  padding: 6px;
  border-radius: 999px;
}
.footer-label {
  font-size: 11px;
  font-weight: 500;
}
.finished-container { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: var(--spacing-lg); padding: var(--spacing-lg); flex-grow: 1; }
.secondary-button { background: none; border: none; color: var(--accent-blue); font-weight: 600; cursor: pointer; }
.pill-switch { display: flex; background-color: #f0f2f5; border-radius: 8px; padding: var(--spacing-xs); }
.pill-switch button {
    padding: var(--spacing-xs) var(--spacing-md); font-size: var(--font-size-md);
    border: none; background-color: transparent; border-radius: 6px;
    font-weight: 500; cursor: pointer; color: #888;
}
.pill-switch button.active { background-color: white; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.tag {
  font-size: var(--font-size-md); font-weight: 500; border: 1px solid #e0e0e0;
  background-color: #f7f7f7; color: var(--primary-text);
  cursor: pointer; border-radius: 999px;
  padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md);
  display: inline-flex; align-items: center;
  gap: var(--spacing-xs); transition: all 0.2s ease;
}
.tag.active { color: white; background-color: #4A90E2; border-color: #4A90E2; }
.tag span {
  font-size: var(--font-size-sm); font-weight: 600; color: var(--primary-text);
  background-color: #e0e0e0; min-width: 1.5em; height: 1.5em;
  border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.tag.active span { color: #4A90E2; background-color: white; }
.action-section .btn {
  width: 100%;
  box-sizing: border-box; /* 这是一个好习惯，确保 padding 不会导致宽度溢出容器 */
}

/* 弹窗样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.dialog-content h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.dialog-content p {
  margin: 0 0 24px 0;
  color: #666;
  line-height: 1.5;
  text-align: center;
}

.dialog-buttons {
  display: flex;
  gap: 12px;
}

.dialog-buttons .btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #4A90E2;
  color: white;
}

.btn-primary:hover {
  background-color: #357ABD;
}

.btn-secondary {
  background-color: #f5f5f5;
  color: #666;
}

.btn-secondary:hover {
  background-color: #e5e5e5;
}
</style>
