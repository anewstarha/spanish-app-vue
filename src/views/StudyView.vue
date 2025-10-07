<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
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

const selectionCount = ref(10);
const isRandomSelection = ref(false);

const isSearchMode = ref(false);
const searchQuery = ref('');
const selectedSentenceIds = ref(new Set());

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

onMounted(async () => {
  await watchUntil(() => userStore.profile !== null);
  const unfinishedSession = userStore.profile?.current_session_ids;
  if (unfinishedSession && unfinishedSession.length > 0) {
    if (studyStore.currentSessionIds.length > 0) {
      if (confirm("发现未完成的学习会话，是否继续？")) {
        await startStudySession();
      } else {
        await userStore.updateUserProfile({ current_session_ids: null, current_session_progress: null });
      }
    }
  }
  try {
    const data = await dataService.getStudyData();
    allSentences.value = data.sentences;
    allTags.value = data.allTags;
  } catch (error) {
    console.error('加载学习数据时出错:', error);
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

const visibleTags = computed(() => {
    if(areTagsExpanded.value) return tagsWithCounts.value;
    return tagsWithCounts.value.slice(0, 15);
});

const showExpandButton = computed(() => {
    return !areTagsExpanded.value && tagsWithCounts.value.length > 15;
});

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
</script>

<template>
  <div class="study-view-page">
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
        <div v-if="searchedSentences.length > 0">
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
      <div class="main-card">
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

        <div class="tags-section">
          <label class="section-title">标签</label>
          <div class="tag-list">
            <button v-for="tag in visibleTags" :key="tag.name" @click="toggleTag(tag.name)" class="tag large"
                    :class="{ 'active': (tag.name === '全部' && filters.tags.length === 0) || filters.tags.includes(tag.name) }">
              {{ tag.name }} <span>{{ tag.count }}</span>
            </button>
            <button v-if="showExpandButton" @click="areTagsExpanded = true" class="tag large expand-btn">...</button>
          </div>
        </div>

        <div class="action-section">
          <div class="setting-row">
            <label>句子数量</label>
            <input type="number" v-model="selectionCount" min="1" :max="filteredSentences.length" class="count-input">
          </div>
          <div class="setting-row">
            <label>Selección Aleatoria</label>
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
  padding: 0 16px;
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
  margin: 20px 0;
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
.tags-section { display: flex; flex-direction: column; gap: 10px; }
.section-title {
  font-weight: 600;
  color: var(--primary-text);
  font-size: 14px;
  text-align: left;
  width: 100%;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
}
.tag.large {
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #e0e0e0;
  background-color: #f7f7f7;
  color: var(--primary-text);
  cursor: pointer;
  border-radius: 999px;
  padding: 6px 8px 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}
.tag.large.active {
  color: white;
  background-color: #4A90E2;
  border-color: #4A90E2;
}
.tag.large span {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-text);
  background-color: #e0e0e0;
  min-width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.tag.large.active span {
  color: #4A90E2;
  background-color: white;
}
.action-section { border-top: 1px solid #f0f0f0; padding-top: 20px; display: flex; flex-direction: column; gap: 15px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; }
.setting-row label { font-size: 16px; color: #333; }
.count-input { width: 60px; text-align: center; font-size: 16px; border: 1px solid #ccc; border-radius: 8px; padding: 5px; }
.search-input-wrapper {
  display: flex; align-items: center; gap: 10px; background-color: #f0f2f5;
  border-radius: 999px; padding: 0 15px; border: 1px solid #e0e0e0; cursor: pointer;
}
.search-input-wrapper svg { width: 20px; height: 20px; color: #999; }
.search-input {
  width: 100%; border: none; background: none; padding: 10px 0;
  font-size: 16px; color: #555; pointer-events: none;
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
.pill-switch { display: flex; background-color: #f0f2f5; border-radius: 8px; padding: 4px; }
.pill-switch button { padding: 5px 10px; font-size: 13px; border: none; background-color: transparent; border-radius: 6px; font-weight: 500; cursor: pointer; color: #888; }
.pill-switch button.active { background-color: white; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #4A90E2; }
input:checked + .slider:before { transform: translateX(20px); }
</style>
