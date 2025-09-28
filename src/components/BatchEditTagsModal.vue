<script setup>
import { ref, watch, onMounted } from 'vue';
import { supabase } from '@/supabase';

const props = defineProps({
  show: Boolean,
  selectedIds: Array,
  allSentences: Array
});
const emit = defineEmits(['close', 'tags-updated']);

const tagsToAdd = ref('');
const tagsToRemove = ref(new Set());
const commonTags = ref([]);
const isProcessing = ref(false);
const errorMessage = ref('');

// 计算所有选中句子的共同标签
function calculateCommonTags() {
  if (!props.selectedIds || props.selectedIds.length === 0) {
    commonTags.value = [];
    return;
  }
  const selectedSentences = props.allSentences.filter(s => props.selectedIds.includes(s.id));
  if (selectedSentences.length === 0) {
    commonTags.value = [];
    return;
  }

  // 以第一个句子的标签为基础，找交集
  let intersection = new Set(selectedSentences[0].tags || []);
  for (let i = 1; i < selectedSentences.length; i++) {
    const currentTags = new Set(selectedSentences[i].tags || []);
    intersection.forEach(tag => {
      if (!currentTags.has(tag)) {
        intersection.delete(tag);
      }
    });
  }
  commonTags.value = Array.from(intersection);
}

watch(() => props.show, (newValue) => {
  if (newValue) {
    tagsToAdd.value = '';
    tagsToRemove.value.clear();
    errorMessage.value = '';
    isProcessing.value = false;
    calculateCommonTags();
  }
});

function toggleTagToRemove(tag) {
  if (tagsToRemove.value.has(tag)) {
    tagsToRemove.value.delete(tag);
  } else {
    tagsToRemove.value.add(tag);
  }
}

async function handleSave() {
  isProcessing.value = true;
  errorMessage.value = '';

  const newTags = tagsToAdd.value.trim() ? tagsToAdd.value.split(/[,，\s]+/).filter(t => t) : [];
  const toRemove = Array.from(tagsToRemove.value);

  if (newTags.length === 0 && toRemove.length === 0) {
    errorMessage.value = "没有要执行的操作。";
    isProcessing.value = false;
    return;
  }

  try {
    // 调用 Supabase RPC 函数执行高效的批量更新
    const { error } = await supabase.rpc('batch_update_tags', {
      p_sentence_ids: props.selectedIds,
      p_tags_to_add: newTags,
      p_tags_to_remove: toRemove
    });
    if (error) throw error;

    emit('tags-updated');
    emit('close');

  } catch (error) {
    console.error('批量更新标签失败:', error);
    errorMessage.value = '更新失败：' + error.message;
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="!isProcessing && emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>批量修改标签 ({{ selectedIds.length }} 项)</h3>
        <button @click="emit('close')" class="close-btn" :disabled="isProcessing">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="tags-to-add">添加标签 (用逗号分隔)</label>
          <input type="text" id="tags-to-add" v-model="tagsToAdd" placeholder="新标签将添加到所有选中项" :disabled="isProcessing" />
        </div>

        <div v-if="commonTags.length > 0" class="form-group">
          <label>从所有选中项中移除共同标签</label>
          <div class="common-tags-list">
            <button
              v-for="tag in commonTags"
              :key="tag"
              class="tag-btn"
              :class="{ 'is-selected': tagsToRemove.has(tag) }"
              @click="toggleTagToRemove(tag)"
              :disabled="isProcessing"
            >
              {{ tag }}
            </button>
          </div>
        </div>
        <p v-else class="field-note">选中的句子没有共同的标签可供移除。</p>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </div>
      <div class="modal-footer">
        <button @click="emit('close')" class="btn btn-secondary" :disabled="isProcessing">取消</button>
        <button @click="handleSave" class="btn btn-primary" :disabled="isProcessing">
          {{ isProcessing ? '更新中...' : '确认更新' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式与Add/Edit模态框类似 */
.modal-overlay { z-index: 1001; /* 比其他模态框高一级 */ }
.modal-content { background: white; border-radius: 12px; width: 90%; max-width: 500px; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e0e0e0; }
.modal-header h3 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #888; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.form-group label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.form-group input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; box-sizing: border-box; }
.field-note { font-size: 14px; color: #888; margin: 0; }
.common-tags-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-btn {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 16px;
  background-color: #f1f3f5;
  cursor: pointer;
  font-size: 14px;
}
.tag-btn.is-selected {
  background-color: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
  text-decoration: line-through;
}
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; }
.btn { padding: 8px 16px; border-radius: 8px; border: 1px solid transparent; font-weight: 600; cursor: pointer; }
.btn-primary { background-color: #4A90E2; color: white; }
.btn-primary:disabled { background-color: #a0c7ff; }
.btn-secondary { background-color: white; color: #333; border-color: #ccc; }
.error-message { color: #dc3545; font-size: 14px; margin: 0; }
</style>
