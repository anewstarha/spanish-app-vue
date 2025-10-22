<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as dataService from '@/services/dataService';
import { useStudyStore } from '@/stores/studyStore';
import { useUserStore } from '@/stores/userStore';
import { useRouter } from 'vue-router';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/solid';

const allSentences = ref([]);
const allTags = ref([]);
const isLoading = ref(true);
const studyStore = useStudyStore();
const userStore = useUserStore();
const router = useRouter();

const filters = ref({
  mastery: 'unmastered',
  studied: 'unstudied',
  tags: [],
});
const areTagsExpanded = ref(false);
const screenHeight = ref(window.innerHeight);

const selectionCount = ref(10);
const isRandomSelection = ref(false);

const isSearchMode = ref(false);
const searchQuery = ref('');
const selectedSentenceIds = ref(new Set());
const showResumeDialog = ref(false);

function watchUntil(condition) {
  return new Promise(resolve => {
    if (condition()) resolve();
    else {
      const unwatch = watch(condition, (newValue) => {
        if (newValue) { unwatch(); resolve(); }
      });
    }
  });
}

// 智能高度检测相关
const showExpandButton = ref(false);
const hasOverflow = ref(false); // 新增：明确跟踪是否溢出
const displayStrategy = ref('normal-expand'); // 新增：当前显示策略
const tagListRef = ref(null);
const tagsSectionRef = ref(null); // 新增：测量整个标签区域
const contentWrapperRef = ref(null);

// 监听窗口大小变化
const handleResize = () => {
    const oldHeight = screenHeight.value;
    screenHeight.value = window.innerHeight;
    console.log('📐 [StudyView] 窗口大小变化:', {
        oldHeight,
        newHeight: screenHeight.value
    });
    checkExpandButton();
};

// 两阶段精细检测逻辑 - 先强制限制再测量
const checkExpandButton = () => {
    console.log('🔍 [StudyView] checkExpandButton 被调用');
    nextTick(() => {
        if (!tagListRef.value) {
            console.log('❌ [StudyView] tagListRef 不存在');
            showExpandButton.value = false;
            return;
        }

        console.log('🎬 [StudyView] 开始两阶段检测');

        // 第一阶段：强制应用限制来测量原始内容
        tagListRef.value.classList.add('force-limit');

        // 给CSS应用时间
        setTimeout(() => {
            const containerRect = tagListRef.value.getBoundingClientRect();
            const containerHeight = containerRect.height;
            const scrollHeight = tagListRef.value.scrollHeight;
            const computedStyle = window.getComputedStyle(tagListRef.value);

            // 预估展开按钮的高度 (按钮 + margin)
            const estimatedButtonHeight = 40; // 8px padding * 2 + 10px margin + 按钮高度

            console.log('📏 [StudyView] 第一阶段测量结果:', {
                containerHeight,
                scrollHeight,
                estimatedButtonHeight,
                tagsCount: tagsWithCounts.value.length,
                computedMaxHeight: computedStyle.maxHeight,
                computedOverflow: computedStyle.overflow,
                elementClasses: tagListRef.value.className
            });

            // 检测是否真的有溢出
            const isOverflowing = scrollHeight > containerHeight + 5;
            const hasEnoughTags = tagsWithCounts.value.length > 3;

            // 检查可用空间 - 更智能的空间计算
            let availableSpace = 200; // 默认值
            let spaceCalculationMethod = 'default';

            if (tagsSectionRef.value && contentWrapperRef.value) {
                // 方法1: 计算父容器的剩余空间
                const parentRect = contentWrapperRef.value.getBoundingClientRect();
                const sectionRect = tagsSectionRef.value.getBoundingClientRect();
                const sectionTop = sectionRect.top - parentRect.top;
                const remainingSpace = parentRect.height - sectionTop;

                availableSpace = Math.max(remainingSpace, 120); // 最小120px
                spaceCalculationMethod = 'parent-remaining';
            } else if (tagsSectionRef.value) {
                // 方法2: 基于视口高度的估算
                const viewportHeight = window.innerHeight;
                const sectionRect = tagsSectionRef.value.getBoundingClientRect();
                const sectionTopInViewport = sectionRect.top;
                const remainingViewport = viewportHeight - sectionTopInViewport - 100; // 预留100px底部空间

                availableSpace = Math.max(remainingViewport, 120);
                spaceCalculationMethod = 'viewport-based';
            }

            const needsButton = isOverflowing && hasEnoughTags;
            let finalStrategy = 'none';
            let finalButtonShow = false;
            let finalTagHeight = 80; // 默认折叠高度

            // 智能降级策略
            if (needsButton) {
                if (availableSpace > (containerHeight + estimatedButtonHeight)) {
                    // 策略1: 空间充足，正常显示展开按钮
                    finalStrategy = 'normal-expand';
                    finalButtonShow = true;
                } else if (availableSpace > containerHeight + 25) {
                    // 策略2: 空间紧张，显示紧凑按钮
                    finalStrategy = 'compact-expand';
                    finalButtonShow = true;
                } else if (availableSpace > 60) {
                    // 策略3: 空间非常紧张，进一步压缩标签高度
                    finalTagHeight = Math.max(40, availableSpace - 30); // 预留30px给按钮
                    finalStrategy = 'ultra-compact';
                    finalButtonShow = true;
                } else {
                    // 策略4: 空间不足，隐藏按钮，但显示提示
                    finalStrategy = 'no-space-hint';
                    finalButtonShow = false;
                }
            }

            console.log('✨ [StudyView] 智能降级策略:', {
                isOverflowing,
                hasEnoughTags,
                availableSpace,
                spaceCalculationMethod,
                estimatedButtonHeight,
                finalStrategy,
                finalButtonShow,
                finalTagHeight,
                shouldShow: finalButtonShow
            });

            // 移除强制限制class
            tagListRef.value.classList.remove('force-limit');

            // 应用动态高度
            if (finalStrategy === 'ultra-compact') {
                tagListRef.value.style.maxHeight = `${finalTagHeight}px`;
            } else {
                tagListRef.value.style.maxHeight = ''; // 清除内联样式，使用CSS
            }

            // 更新状态
            hasOverflow.value = isOverflowing;
            showExpandButton.value = finalButtonShow;
            displayStrategy.value = finalStrategy;

            // 如果内容不再溢出，自动收起展开状态
            if (!isOverflowing && areTagsExpanded.value) {
                console.log('🔄 [StudyView] 内容不再溢出，自动收起');
                areTagsExpanded.value = false;
            }

            console.log('🎯 [StudyView] 最终状态:', {
                hasOverflow: hasOverflow.value,
                showExpandButton: showExpandButton.value,
                areTagsExpanded: areTagsExpanded.value
            });
        }, 10); // 10ms延迟确保CSS生效
    });
};onMounted(async () => {
  console.log('🚀 [StudyView] onMounted 开始执行');
  window.addEventListener('resize', handleResize);

  // 初始检测
  console.log('🎬 [StudyView] 执行初始 checkExpandButton');
  checkExpandButton();

  await watchUntil(() => userStore.profile !== null);
  const unfinishedSession = userStore.profile?.current_session_ids;
  if (unfinishedSession && unfinishedSession.length > 0) {
    showResumeDialog.value = true;
  }
  try {
    const data = await dataService.getStudyData();
    allSentences.value = data.sentences;
    allTags.value = data.allTags;
    console.log('📊 [StudyView] 数据加载完成:', {
      sentencesCount: data.sentences?.length || 0,
      tagsCount: data.allTags?.length || 0
    });
    // 数据加载完成后再次检测
    setTimeout(() => {
      console.log('🔄 [StudyView] 数据加载完成后重新检测');
      checkExpandButton();
    }, 100);
  } catch (error) {
    console.error('加载学习数据时出错:', error);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
});

const filteredSentences = computed(() => {
  if (!allSentences.value || !Array.isArray(allSentences.value)) return [];
  return allSentences.value.filter(sentence => {
    if (filters.value.mastery !== 'all' && (sentence.is_mastered || false) !== (filters.value.mastery === 'mastered')) return false;
    if (filters.value.studied !== 'all' && (sentence.is_studied || false) !== (filters.value.studied === 'studied')) return false;

    const sentenceTags = sentence.tags || [];
    if (filters.value.tags.length > 0 && !filters.value.tags.includes('全部')) {
        let matchesTag = false;
        if (filters.value.tags.includes('无标签') && sentenceTags.length === 0) {
            matchesTag = true;
        }
        if (sentenceTags.some(tag => filters.value.tags.includes(tag))) {
            matchesTag = true;
        }
        if (!matchesTag) return false;
    }
    return true;
  });
});

const searchedSentences = computed(() => {
    if (!searchQuery.value) return filteredSentences.value;
    const query = searchQuery.value.toLowerCase();
    return filteredSentences.value.filter(s =>
        s.spanish_text.toLowerCase().includes(query) ||
        (s.chinese_translation && s.chinese_translation.toLowerCase().includes(query))
    );
});

const tagsWithCounts = computed(() => {
  if (!allSentences.value || !Array.isArray(allSentences.value) || !allTags.value || !Array.isArray(allTags.value)) {
    return [{ name: '全部', count: 0 }];
  }

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
  return tagList;
});

// 监听标签变化，重新检测展开按钮需要
watch(tagsWithCounts, (newVal, oldVal) => {
    console.log('👀 [StudyView] tagsWithCounts 变化:', {
        newCount: newVal.length,
        oldCount: oldVal?.length || 0,
        tags: newVal.map(t => `${t.name}(${t.count})`)
    });
    checkExpandButton();
}, { deep: true, immediate: true });

const visibleTags = computed(() => {
    // 精细逻辑：始终显示所有标签，由CSS和DOM测量控制溢出
    return tagsWithCounts.value;
});

// 收起标签函数 - 参考QuizView
function collapseTags() {
    areTagsExpanded.value = false;
    // 滚动到顶部
    if (contentWrapperRef.value) {
        contentWrapperRef.value.scrollTop = 0;
    }
}

// showExpandButton 现在由 ref 和 checkExpandButton 函数管理

function toggleTag(tag) {
  if (tag === '全部') {
    filters.value.tags = [];
    return;
  }
  const index = filters.value.tags.indexOf(tag);
  if (index > -1) {
    filters.value.tags.splice(index, 1);
  } else {
    filters.value.tags.push(tag);
  }
}

function activateSearchMode() {
    isSearchMode.value = true;
    nextTick(() => {
        document.getElementById('custom-search-input')?.focus();
    });
}

function toggleSentenceSelection(sentenceId) {
    const newSet = new Set(selectedSentenceIds.value);
    if (newSet.has(sentenceId)) {
        newSet.delete(sentenceId);
    } else {
        newSet.add(sentenceId);
    }
    selectedSentenceIds.value = newSet;
}

// --- MODIFIED ---
async function startQuickStudy() {
    const count = Math.min(selectionCount.value, filteredSentences.value.length);
    if (count === 0) { alert('没有符合当前筛选条件的句子。'); return; }

    // --- NEW ---
    // 保存当前筛选设置为用户的“上次学习设置”
    const filtersToSave = {
        mastery: filters.value.mastery,
        studied: filters.value.studied,
        tags: filters.value.tags,
        count: selectionCount.value,
        isRandom: isRandomSelection.value
    };
    await userStore.updateUserProfile({ last_study_filters: filtersToSave });
    // --- END NEW ---

    let source = [...filteredSentences.value];
    if (isRandomSelection.value) {
        source.sort(() => 0.5 - Math.random());
    }
    const idsToStudy = source.slice(0, count).map(s => s.id);
    await studyStore.startSession(idsToStudy);
    router.push({ name: 'studySession' });
}

async function startCustomStudy() {
    if (selectedSentenceIds.value.size === 0) { alert('请至少选择一个句子。'); return; }
    const idsToStudy = Array.from(selectedSentenceIds.value);
    await studyStore.startSession(idsToStudy);
    router.push({ name: 'studySession' });
}

async function handleContinueStudy() {
    // 继续未完成的学习会话
    showResumeDialog.value = false;
    const sessionIds = userStore.profile?.current_session_ids || [];
    if (sessionIds.length > 0) {
        // 使用 startSession 方法来正确初始化学习会话
        await studyStore.startSession(sessionIds);
        // 恢复学习进度
        if (userStore.profile?.current_session_progress) {
            studyStore.currentSentenceIndex = userStore.profile.current_session_progress;
        }
        router.push({ name: 'studySession' });
    }
}

async function handleReselect() {
    // 重新选择，清除未完成的会话
    showResumeDialog.value = false;
    await userStore.updateUserProfile({ current_session_ids: null, current_session_progress: null });
}
</script>

<template>
  <div class="study-view-page">
    <!-- 继续学习弹窗 -->
    <div v-if="showResumeDialog" class="dialog-overlay">
      <div class="dialog-content">
        <h3>发现未完成的学习会话</h3>
        <p>您有一个进行中的学习会话，是否要继续？</p>
        <div class="dialog-buttons">
          <button @click="handleContinueStudy" class="btn btn-primary">继续学习</button>
          <button @click="handleReselect" class="btn btn-secondary">重新选择</button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-indicator">加载中...</div>

    <div v-else-if="isSearchMode" class="search-view">
      <div class="search-bar-container">
        <div class="search-input-wrapper active">
          <MagnifyingGlassIcon />
          <input type="text" v-model="searchQuery" id="custom-search-input" placeholder="按关键词搜索..." class="search-input">
        </div>
        <button @click="isSearchMode = false" class="cancel-btn">取消</button>
      </div>
      <div class="sentence-list">
        <div v-if="searchedSentences && searchedSentences.length > 0">
          <div v-for="sentence in searchedSentences" :key="sentence.id"
               @click="toggleSentenceSelection(sentence.id)"
               class="sentence-item"
               :class="{ selected: selectedSentenceIds.has(sentence.id) }">
            <p class="spanish-text">{{ sentence.spanish_text }}</p>
            <p class="chinese-text">{{ sentence.chinese_translation }}</p>
          </div>
        </div>
        <p v-else class="empty-list-message">未找到句子。</p>
      </div>
      <div v-if="selectedSentenceIds.size > 0" class="floating-start-button">
        <button @click="startCustomStudy" class="btn btn-primary">
          开始学习 ({{ selectedSentenceIds.size }})
        </button>
      </div>
    </div>

    <div v-else class="default-view">
      <div ref="contentWrapperRef" class="main-card">
        <div class="filter-section">
          <div class="filter-group">
            <label>掌握程度</label>
            <div class="pill-switch large">
              <button @click="filters.mastery = 'unmastered'" :class="{active: filters.mastery === 'unmastered'}">否</button>
              <button @click="filters.mastery = 'mastered'" :class="{active: filters.mastery === 'mastered'}">是</button>
              <button @click="filters.mastery = 'all'" :class="{active: filters.mastery === 'all'}">全部</button>
            </div>
          </div>
          <div class="filter-group">
            <label>学习状态</label>
            <div class="pill-switch large">
              <button @click="filters.studied = 'unstudied'" :class="{active: filters.studied === 'unstudied'}">否</button>
              <button @click="filters.studied = 'studied'" :class="{active: filters.studied === 'studied'}">是</button>
              <button @click="filters.studied = 'all'" :class="{active: filters.studied === 'all'}">全部</button>
            </div>
          </div>
        </div>

        <div ref="tagsSectionRef" class="tags-section" :class="{
          'confirmed-overflow': hasOverflow,
          'confirmed-no-overflow': !hasOverflow,
          'expanded': areTagsExpanded && hasOverflow
        }">
          <label class="section-title">
            标签
          </label>
          <div
            ref="tagListRef"
            class="tag-list"
            :class="{
              'expanded': areTagsExpanded,
              'collapsed': !areTagsExpanded && showExpandButton,
              'small-screen': screenHeight < 700,
              'large-screen': screenHeight >= 700
            }"
          >
            <button v-for="tag in visibleTags" :key="tag.name" @click="toggleTag(tag.name)" class="tag large"
                    :class="{ 'active': (tag.name === '全部' && filters.tags.length === 0) || filters.tags.includes(tag.name) }">
              {{ tag.name }} <span>{{ tag.count }}</span>
            </button>
          </div>

          <div v-if="showExpandButton" class="expand-controls" :class="{
            'compact': displayStrategy === 'compact-expand' || displayStrategy === 'ultra-compact'
          }">
            <button v-if="!areTagsExpanded" @click="areTagsExpanded = true" class="expand-btn">
              {{ displayStrategy === 'ultra-compact' ? '更多↓' : '查看更多标签 ↓' }}
            </button>
            <button v-else @click="collapseTags" class="collapse-btn">
              {{ displayStrategy === 'ultra-compact' ? '收起↑' : '收起标签 ↑' }}
            </button>
          </div>

          <!-- 空间不足提示 -->
          <div v-if="displayStrategy === 'no-space-hint'" class="space-hint">
            <small style="color: #666; font-size: 11px;">
              屏幕空间不足，显示前{{ Math.min(6, tagsWithCounts.length) }}个标签
            </small>
          </div>
        </div>

        <div class="action-section">
          <div class="setting-row">
            <label>句子数量</label>
            <input type="number" v-model="selectionCount" min="1" :max="filteredSentences?.length || 0" class="count-input">
          </div>
          <div class="setting-row">
            <label>随机选择</label>
            <label class="switch"><input type="checkbox" v-model="isRandomSelection"><span class="slider round"></span></label>
          </div>
          <button @click="startQuickStudy" class="btn btn-primary">开始学习</button>
          <div class="search-input-wrapper" @click="activateSearchMode">
            <MagnifyingGlassIcon />
            <input type="text" placeholder="搜索自定义学习内容" readonly class="search-input">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilos existentes de StudyView... */
.study-view-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f2f2f7;
  padding: 0 20px; /* 增加左右边距 */
  box-sizing: border-box;
}
.default-view {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  flex-grow: 1;
}
.main-card {
  background-color: white;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 25px;
  width: 100%;
  max-width: 500px;
  margin: 20px auto; /* 水平居中 */
  box-sizing: border-box;
}
.loading-indicator { margin: auto; }
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.filter-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.filter-group label {
  font-weight: 600;
  color: var(--primary-text);
  font-size: 14px;
}
.pill-switch.large button { padding: 8px 16px; font-size: 14px; }
.tags-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 精细的内容响应样式 - 两阶段检测法 */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
  transition: max-height 0.3s ease;
  /* 不设置默认max-height，让JavaScript控制 */
}

/* 强制检测模式：用于第一阶段测量 */
.tag-list.force-limit {
  max-height: 80px !important;
  overflow: hidden !important;
}

/* 确认有溢出且未展开：保持限制 */
.tags-section.confirmed-overflow:not(.expanded) .tag-list {
  max-height: 80px;
  overflow: hidden;
}

/* 确认有溢出且展开：允许滚动 */
.tags-section.confirmed-overflow.expanded .tag-list {
  max-height: 60vh;
  overflow-y: auto;
}

/* 确认无溢出：完全展开 */
.tags-section.confirmed-no-overflow .tag-list {
  max-height: none;
  overflow: visible;
}

/* 展开控制按钮 */
.expand-controls {
  margin-top: 10px;
  text-align: center;
}

/* 紧凑模式：减少按钮间距和高度 */
.expand-controls.compact {
  margin-top: 5px;
}

.expand-btn,
.collapse-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

/* 紧凑模式按钮 */
.expand-controls.compact .expand-btn,
.expand-controls.compact .collapse-btn {
  padding: 4px 12px;
  font-size: 12px;
}

.expand-btn:hover,
.collapse-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

/* 当没有溢出时隐藏展开按钮 */
.tags-section.confirmed-no-overflow .expand-controls {
  display: none;
}
.section-title {
  font-weight: 600;
  color: var(--primary-text);
  font-size: 14px;
  text-align: left;
  width: 100%;
}

/* 大屏幕优化：增大标题字体 */
.tags-section.large-screen .section-title {
  font-size: 16px;
}
/* 重复的.tag-list规则已合并到上面 */
.tag.large {
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #e6e9ee;
  background-color: rgba(60,60,67,0.03);
  color: var(--primary-text);
  cursor: pointer;
  border-radius: 999px;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.12s ease;
}
.tag.large.active {
  color: #0b3a66;
  background-color: #dff1ff; /* subtle blue tint */
  border-color: #bfe3ff;
}
.tag.large span {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-text);
  background-color: #eef2f6;
  min-width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}
.tag.large.active span {
  color: #0b3a66;
  background-color: white;
}
.action-section { border-top: 1px solid #f0f0f0; padding-top: 20px; display: flex; flex-direction: column; gap: 15px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; }
.setting-row label { font-size: 16px; color: #333; }
.count-input { width: 60px; text-align: center; font-size: 16px; border: 1px solid #ccc; border-radius: 8px; padding: 5px; }
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 0 12px; /* reduce horizontal padding so icon looks contained */
  border: 2px solid #667eea;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.16); /* soften the shadow */
  transition: all 0.12s ease;
  margin-top: 8px;
}
.search-input-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}
.search-input-wrapper svg {
  width: 20px;
  height: 20px;
  color: white;
  filter: none;
  background: rgba(255,255,255,0.12); /* subtle circular background */
  padding: 6px;
  border-radius: 999px;
}
.search-input {
  width: 100%;
  border: none;
  background: none;
  padding: 14px 0;
  font-size: 16px;
  font-weight: 500;
  color: white;
  pointer-events: none;
}
.search-input::placeholder {
  color: rgba(255, 255, 255, 0.9);
}
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding-top: 15px;
}
.search-bar-container { display: flex; gap: 10px; margin-bottom: 15px; flex-shrink: 0; }
.search-bar-container .search-input { pointer-events: all; }
.cancel-btn { background: none; border: none; color: #4A90E2; font-weight: 600; cursor: pointer; font-size: 16px; }
.sentence-list {
  overflow-y: auto;
  flex-grow: 1;
  padding-bottom: 90px;
}
.sentence-item {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0; cursor: pointer;
  border-radius: 8px; margin: 0 5px 5px; background: white;
  transition: background-color 0.2s;
}
.sentence-item.selected { background-color: #eef5ff; border-left: 4px solid #4A90E2; padding-left: 8px; }
.spanish-text { font-weight: 500; color: #333; margin: 0; }
.chinese-text { font-size: 12px; color: #888; margin: 2px 0 0 0; }
.empty-list-message { text-align: center; color: #888; padding-top: 40px; }
.floating-start-button {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  z-index: 100;
}
/* Make floating button look like a clean pill/circle depending on width */
.floating-start-button .btn {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 999px;
  padding: 12px 18px;
  background: rgba(74,144,226,0.12);
  color: #0b3a66;
  font-weight: 700;
}
.floating-start-button .btn:hover {
  background: rgba(74,144,226,0.18);
}

/* Pill-switch small button circular tuning */
.pill-switch button {
  border-radius: 999px;
  background: transparent;
  padding: 8px 12px;
}
.pill-switch button.active {
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.pill-switch { display: flex; background-color: #f0f2f5; border-radius: 8px; padding: 4px; }
.pill-switch button { padding: 5px 10px; font-size: 13px; border: none; background-color: transparent; border-radius: 6px; font-weight: 500; cursor: pointer; color: #888; }
.pill-switch button.active { background-color: white; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #4A90E2; }
input:checked + .slider:before { transform: translateX(20px); }

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
