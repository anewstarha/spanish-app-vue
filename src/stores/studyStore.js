// src/stores/studyStore.js

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/supabase'
import { useUserStore } from './userStore'

export const useStudyStore = defineStore('study', () => {
  const sentenceIds = ref([])
  const allSentencesInSession = ref([])
  const allWords = ref([])
  const currentSentenceIndex = ref(0)
  const isLoading = ref(false)

  const currentSentence = computed(() => {
    if (allSentencesInSession.value.length > 0) {
      return allSentencesInSession.value[currentSentenceIndex.value]
    }
    return null
  })

  const progress = computed(() => ({
    current: currentSentenceIndex.value + 1,
    total: allSentencesInSession.value.length
  }))

  async function startSession(ids) {
    sentenceIds.value = ids
    currentSentenceIndex.value = 0
    isLoading.value = true
    allSentencesInSession.value = []
    allWords.value = []

    const userStore = useUserStore()
    if (!userStore.user) {
      isLoading.value = false
      return
    }

    try {
      const [sentencesResponse, wordsResponse] = await Promise.all([
        supabase
          .from('sentences')
          .select('*')
          .in('id', ids),
        supabase
          .from('high_frequency_words')
          .select('*')
          .eq('user_id', userStore.user.id)
      ]);

      if (sentencesResponse.error) throw sentencesResponse.error;
      if (wordsResponse.error) throw wordsResponse.error;

      const sentencesData = sentencesResponse.data;
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('sentence_id, is_studied, is_mastered')
        .in('sentence_id', ids)
        .eq('user_id', userStore.user.id);

      if (progressError) throw progressError;

      const progressMap = new Map((progressData || []).map(p => [p.sentence_id, p]));
      const sentencesWithProgress = sentencesData.map(sentence => {
        const progress = progressMap.get(sentence.id) || {};
        return { ...sentence, is_studied: progress.is_studied || false, is_mastered: progress.is_mastered || false }
      });

      const sentenceMap = new Map(sentencesWithProgress.map(s => [s.id, s]))
      allSentencesInSession.value = ids.map(id => sentenceMap.get(id)).filter(Boolean)
      allWords.value = wordsResponse.data

      // --- 【核心修改 1】 ---
      // 会话开始时，保存会话列表到数据库
      userStore.updateUserProfile({
          current_session_ids: ids,
          current_session_progress: 0
      });

    } catch (error) {
      console.error('获取学习会话数据失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 用于恢复会话的函数 (保持不变)
  async function resumeSession(ids, progress) {
    sentenceIds.value = ids
    currentSentenceIndex.value = 0
    isLoading.value = true
    allSentencesInSession.value = []
    allWords.value = []
    const userStore = useUserStore();
    if (!userStore.user) {
      isLoading.value = false
      return
    }
    try {
      const [sentencesResponse, wordsResponse] = await Promise.all([
        supabase.from('sentences').select('*').in('id', ids),
        supabase.from('high_frequency_words').select('*').eq('user_id', userStore.user.id)
      ]);
      if (sentencesResponse.error) throw sentencesResponse.error;
      if (wordsResponse.error) throw wordsResponse.error;
      const sentencesData = sentencesResponse.data;
      const { data: progressData, error: progressError } = await supabase.from('user_progress').select('sentence_id, is_studied, is_mastered').in('sentence_id', ids).eq('user_id', userStore.user.id);
      if (progressError) throw progressError;
      const progressMap = new Map((progressData || []).map(p => [p.sentence_id, p]));
      const sentencesWithProgress = sentencesData.map(sentence => {
        const progress = progressMap.get(sentence.id) || {};
        return { ...sentence, is_studied: progress.is_studied || false, is_mastered: progress.is_mastered || false }
      });
      const sentenceMap = new Map(sentencesWithProgress.map(s => [s.id, s]))
      allSentencesInSession.value = ids.map(id => sentenceMap.get(id)).filter(Boolean)
      allWords.value = wordsResponse.data
      currentSentenceIndex.value = progress;
    } catch (error) {
      console.error('恢复学习会话失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  function cacheWordExplanation({ wordId, explanation }) {
    const word = allWords.value.find(w => w.id === wordId);
    if (word) {
      word.ai_explanation = explanation;
    }
  }

  async function updateSentenceStatus(sentenceId, testResults) {
    const userStore = useUserStore();
    if (!userStore.user) return;
    const isMastered = testResults.every(result => result.isCorrect);
    const progressData = {
      user_id: userStore.user.id,
      sentence_id: sentenceId,
      is_studied: true,
      is_mastered: isMastered,
    };
    const { error } = await supabase
      .from('user_progress')
      .upsert(progressData, { onConflict: 'user_id, sentence_id' });
    if (error) {
      console.error('更新或插入用户进度失败:', error);
    }
  }

  function saveProgress() {
    const userStore = useUserStore();
    // --- 【核心修改 2】 ---
    userStore.updateUserProfile({
        current_session_progress: currentSentenceIndex.value
    });
  }

  function goToNext() {
    if (currentSentenceIndex.value < allSentencesInSession.value.length - 1) {
      currentSentenceIndex.value++;
      saveProgress();
    }
  }

  function goToPrev() {
    if (currentSentenceIndex.value > 0) {
      currentSentenceIndex.value--;
      saveProgress();
    }
  }

  function jumpTo(index) {
    if (index >= 0 && index < allSentencesInSession.value.length) {
      currentSentenceIndex.value = index;
      saveProgress();
    }
  }

  return {
    isLoading, currentSentence, progress, allSentencesInSession, allWords,
    currentSentenceIndex, startSession, goToNext, goToPrev, jumpTo,
    cacheWordExplanation, updateSentenceStatus, resumeSession
  }
})
