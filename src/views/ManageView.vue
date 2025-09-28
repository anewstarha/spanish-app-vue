<script setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/supabase';

// 导入所有需要的图标和组件
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  TagIcon,
  TrashIcon,
  PencilIcon
} from '@heroicons/vue/24/solid';
import AddSentenceModal from '../components/AddSentenceModal.vue';
import EditSentenceModal from '../components/EditSentenceModal.vue';
import BatchEditTagsModal from '../components/BatchEditTagsModal.vue';

// === 响应式状态 ===
const store = useUserStore();
const allSentences = ref([]);
const isLoading = ref(true);
const searchQuery = ref('');
const selectedSentenceIds = ref(new Set());
const isDropdownOpen = ref(false);

// 模态框控制
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const sentenceToEdit = ref(null);
const isBatchTagModalVisible = ref(false);

// === 数据逻辑 ===
async function fetchSentences() {
  isLoading.value = true;
  selectedSentenceIds.value.clear();
  if (!store.user) {
    isLoading.value = false;
    return;
  }

  const { data, error } = await supabase
    .from('sentences')
    .select('*')
    .eq('user_id', store.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取个人句子失败:', error);
    allSentences.value = [];
  } else {
    allSentences.value = data;
  }
  isLoading.value = false;
}

const filteredSentences = computed(() => {
  if (!searchQuery.value) return allSentences.value;
  const query = searchQuery.value.toLowerCase();
  return allSentences.value.filter(s =>
    s.spanish_text.toLowerCase().includes(query) ||
    (s.chinese_translation && s.chinese_translation.toLowerCase().includes(query)) ||
    (s.tags && s.tags.some(tag => tag.toLowerCase().includes(query)))
  );
});

// === 多选逻辑 ===
const isAllSelected = computed(() => {
  const visibleIds = filteredSentences.value.map(s => s.id);
  if (visibleIds.length === 0) return false;
  return visibleIds.every(id => selectedSentenceIds.value.has(id));
});

function toggleAllSelection() {
  const visibleIds = new Set(filteredSentences.value.map(s => s.id));
  if (isAllSelected.value) {
    visibleIds.forEach(id => selectedSentenceIds.value.delete(id));
  } else {
    visibleIds.forEach(id => selectedSentenceIds.value.add(id));
  }
}

function toggleSelection(sentenceId) {
  if (selectedSentenceIds.value.has(sentenceId)) {
    selectedSentenceIds.value.delete(sentenceId);
  } else {
    selectedSentenceIds.value.add(sentenceId);
  }
}

// === 操作函数 ===
function handleAdd() {
  isAddModalVisible.value = true;
}

function openEditModal(sentence) {
  sentenceToEdit.value = sentence;
  isEditModalVisible.value = true;
}

async function handleDelete(sentenceId) {
  if (confirm('您确定要删除这条句子吗？此操作无法撤销。')) {
    const { error } = await supabase.from('sentences').delete().match({ id: sentenceId, user_id: store.user.id });
    if (error) {
      alert('删除失败: ' + error.message);
    } else {
      await fetchSentences();
    }
  }
}

function handleDropdownAction(action) {
  isDropdownOpen.value = false;
  if (selectedSentenceIds.value.size === 0) {
    alert('请至少选择一条句子。');
    return;
  }

  if (action === 'editTags') {
    isBatchTagModalVisible.value = true;
  } else if (action === 'delete') {
    if (confirm(`您确定要删除选中的 ${selectedSentenceIds.value.size} 条句子吗？`)) {
      handleBatchDelete();
    }
  }
}

async function handleBatchDelete() {
  const idsToDelete = Array.from(selectedSentenceIds.value);
  const { error } = await supabase.from('sentences').delete().in('id', idsToDelete).eq('user_id', store.user.id);

  if (error) {
    alert('批量删除失败: ' + error.message);
  } else {
    await fetchSentences();
  }
}

async function handleRefreshData() {
    await fetchSentences();
}

onMounted(() => {
  fetchSentences();
});
</script>

<template>
  <div class="manage-view">
    <div class="sticky-header-container">
      <header class="page-header">
        <h1 class="page-title">我的内容管理</h1>
        <div class="header-actions">
          <div class="search-bar">
            <MagnifyingGlassIcon class="search-icon" />
            <input type="text" v-model="searchQuery" placeholder="搜索我的句子..." />
          </div>
        </div>
      </header>

      <div class="list-toolbar">
        <div class="select-all-container">
          <input type="checkbox" id="select-all" :checked="isAllSelected" @change="toggleAllSelection" />
          <label for="select-all">全选 ({{selectedSentenceIds.size}} / {{filteredSentences.length}})</label>
        </div>
        <div class="dropdown-container">
          <button @click="isDropdownOpen = !isDropdownOpen" :disabled="selectedSentenceIds.size === 0" class="btn btn-secondary btn-dropdown">
            <span>批量操作</span>
            <ChevronDownIcon />
          </button>
          <div v-if="isDropdownOpen" class="dropdown-menu">
            <a href="#" @click.prevent="handleDropdownAction('editTags')"><TagIcon /> 修改标签</a>
            <a href="#" @click.prevent="handleDropdownAction('delete')"><TrashIcon /> 删除句子</a>
          </div>
        </div>
      </div>
    </div>

    <main class="content-area">
      <div v-if="isLoading" class="loading-indicator">正在加载内容...</div>
      <div v-else-if="filteredSentences.length === 0" class="empty-state">
         <p>这里空空如也。</p>
        <p v-if="searchQuery">请尝试更换搜索词。</p>
        <p v-else>点击右下角的“+”按钮，创建你的专属句库吧！</p>
      </div>

      <ul v-else class="sentence-list">
        <li
          v-for="sentence in filteredSentences"
          :key="sentence.id"
          class="sentence-item"
          :class="{ 'is-selected': selectedSentenceIds.has(sentence.id) }"
          @click="toggleSelection(sentence.id)"
        >
          <div class="selection-and-content">
              <div class="checkbox-container">
                <input type="checkbox" :checked="selectedSentenceIds.has(sentence.id)" readonly />
              </div>
              <div class="sentence-content">
                <p class="spanish-text">{{ sentence.spanish_text }}</p>
                <p class="chinese-text">{{ sentence.chinese_translation }}</p>
                <div class="tags-container" v-if="sentence.tags && sentence.tags.length > 0">
                  <span v-for="tag in sentence.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
                  <span v-if="sentence.tags.length > 3" class="tag more-tags">+{{ sentence.tags.length - 3 }}</span>
                </div>
              </div>
          </div>
          <div class="actions">
              <button @click.stop="openEditModal(sentence)" class="icon-btn" title="编辑句子">
                <PencilIcon />
              </button>
              <button @click.stop="handleDelete(sentence.id)" class="icon-btn delete" title="删除句子">
                <TrashIcon />
              </button>
          </div>
        </li>
      </ul>
    </main>

    <button @click="handleAdd" class="fab" title="添加新句子">
      <PlusIcon />
    </button>

    <AddSentenceModal
      :show="isAddModalVisible"
      @close="isAddModalVisible = false"
      @sentences-added="handleRefreshData"
    />
    <EditSentenceModal
      v-if="sentenceToEdit"
      :show="isEditModalVisible"
      :sentence="sentenceToEdit"
      @close="isEditModalVisible = false"
      @sentence-updated="handleRefreshData"
    />
    <BatchEditTagsModal
      v-if="isBatchTagModalVisible"
      :show="isBatchTagModalVisible"
      :selected-ids="Array.from(selectedSentenceIds)"
      :all-sentences="allSentences"
      @close="isBatchTagModalVisible = false"
      @tags-updated="handleRefreshData"
    />
  </div>
</template>

<style scoped>
.manage-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f8f9fa;
}

/* --- Core Fix Starts Here --- */
.sticky-header-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #f8f9fa; /* Match the view's background */
}

.page-header {
  padding: 16px 20px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
}
/* No longer needs to be sticky by itself */

.list-toolbar {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 8px;
  background-color: #f8f9fa; /* Essential for sticky behavior */
}
/* No longer needs to be sticky by itself */
/* --- Core Fix Ends Here --- */


.page-title { font-size: 24px; font-weight: 700; margin: 0 0 16px 0; }
.header-actions { display: flex; align-items: center; gap: 16px; }
.search-bar { flex-grow: 1; display: flex; align-items: center; background-color: #f1f3f5; border-radius: 8px; padding: 0 12px; }
.search-icon { width: 20px; height: 20px; color: #888; }
.search-bar input { width: 100%; border: none; background: none; padding: 10px; font-size: 16px; outline: none; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; transition: all 0.2s ease; }
.btn svg { width: 18px; height: 18px; }
.btn-primary { background-color: #4A90E2; color: white; }
.btn-secondary { background-color: white; color: #333; border-color: #ccc; }
.btn-secondary:disabled { background-color: #f8f9fa; color: #aaa; cursor: not-allowed; }
.content-area { flex-grow: 1; overflow-y: auto; }
.select-all-container { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.select-all-container input { width: 18px; height: 18px; }
.dropdown-container { position: relative; margin-left: auto; }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background-color: white; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: max-content; z-index: 10; }
.dropdown-menu a { display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: #333; text-decoration: none; font-size: 14px; }
.dropdown-menu a:hover { background-color: #f1f3f5; }
.dropdown-menu a svg { width: 18px; height: 18px; }
.loading-indicator, .empty-state { text-align: center; margin-top: 50px; color: #888; }
.sentence-list { list-style: none; padding: 0 10px 80px 10px; margin: 0; }
.sentence-item { display: flex; align-items: center; justify-content: space-between; background-color: white; margin-bottom: 8px; padding: 12px 10px; cursor: pointer; border-radius: 8px; transition: background-color 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.sentence-item.is-selected { background-color: #e6f3ff; }
.selection-and-content { display: flex; align-items: center; min-width: 0; flex-grow: 1; }
.checkbox-container { margin-right: 15px; }
.checkbox-container input { width: 18px; height: 18px; pointer-events: none; }
.sentence-content { flex-grow: 1; min-width: 0; }
.spanish-text { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
.chinese-text { font-size: 14px; color: #666; margin-bottom: 8px; }
.tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { background-color: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; color: #555; }
.actions { display: flex; align-items: center; margin-left: 10px; flex-shrink: 0; gap: 8px; }
.icon-btn { background: none; border: none; cursor: pointer; padding: 5px; color: #888; width: 24px; height: 24px; }
.icon-btn:hover { color: #4A90E2; }
.icon-btn.delete:hover { color: #dc3545; }
.fab { position: fixed; bottom: 80px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background-color: #4A90E2; color: white; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); cursor: pointer; z-index: 100; }
.fab svg { width: 28px; height: 28px; }
</style>
