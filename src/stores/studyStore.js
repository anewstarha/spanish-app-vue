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

    // --- DEBUG CHECK ---
    if (userStore.user.email === 'debug@example.com') {
        const mockSentences = ids.map(id => ({
            id,
            spanish_text: `Debug Sentence ${id}`,
            chinese_translation: `测试句子 ${id} 的中文翻译`,
            tags: ['debug'],
            is_studied: false,
            is_mastered: false
        }));
        allSentencesInSession.value = mockSentences;
        allWords.value = []; // empty words for debug
        isLoading.value = false;
        return;
    }

    // --- DEMO DATA CHECK ---
    // 如果ID是我们在 dataService 中生成的演示ID (>= 10000)，直接使用演示数据，不查库
    if (ids.some(id => id >= 10000)) {
       console.log('🐞 [StudyStore] Detected demo IDs, using static data');
       const demoSentences = ids.map(id => {
          // 这里简单重建演示数据，实际项目中最好共享一个数据源常量
          const i = id - 10000;
          return {
              id,
              spanish_text: [
                'Hola, ¿cómo estás?', 'Me gustaría pedir una cerveza, por favor.', '¿Dónde está la biblioteca?',
                'Hace mucho calor hoy.', 'No entiendo lo que dices.', '¿Puedes repetir eso, por favor?',
                'Me llamo Juan y soy de España.', 'Mañana voy a viajar a Madrid.', 'Este libro es muy interesante.',
                'Gracias por tu ayuda.'
              ][i] || `Oración de ejemplo`,
              chinese_translation: ['你好，你好吗？', '我想点一杯啤酒，谢谢。', '图书馆在哪里？', '今天天气很热。', '我不明白你在说什么。', '请你重复一遍好吗？', '我叫胡安，来自西班牙。', '明天我要去马德里旅行。', '这本书很有趣。', '谢谢你的帮助。'][i] || `示例句子`,
              tags: ['Demo'],
              is_studied: false, is_mastered: false
          };
       });
       allSentencesInSession.value = demoSentences;
       allWords.value = [];
       isLoading.value = false;
       // 也就是不保存到数据库了，因为是演示数据
       return;
    }

    try {
      // 1. 获取句子数据
      // 现在 RLS 策略已允许访问公共句子，直接查询即可，数据更完整 (包含 ai_notes)
      const { data: sentencesData, error: sentencesError } = await supabase
          .from('sentences')
          .select('*')
          .in('id', ids);

      if (sentencesError) throw sentencesError;

      // 2. 从句子中提取核心词汇（假设是西语单词列表）
      // ... (保留原有注释) ...

      // 为了支持公共内容的单词显示，我们可能需要更复杂的逻辑 ...
      // 但为了不破坏现有逻辑，我们至少应该保留 user_id 查询。

      // 2. 从句子中提取核心词汇
      // 关键修复：除了获取数据库中已有的单词，还需要解析当前句子中包含的单词
      // 因为新用户对于公共内容，可能数据库里还没有任何单词记录，导致无法高亮和点击

      // 2. 从句子中提取核心词汇
      // update: 同时也获取管理员创建的公共单词
      // 我们的 RLS 策略是"看自己+看admin"，直接 select * 让 RLS 发挥作用即可
       const { data: dbWordsData, error: wordsError } = await supabase
          .from('high_frequency_words')
          .select('*');
          // 这里的 user_id 过滤交给数据库 RLS 处理 (User's words OR Admin's words)

      if (wordsError) throw wordsError;

      const dbWordsMap = new Map(dbWordsData.map(w => [w.spanish_word.toLowerCase(), w]));
      const allExtractedWords = [];

      // 遍历所有加载的句子，提取单词
      // 注意：这里需要引入 getCoreWordsFromSentence 工具函数，或者简单正则提取
      // 为了避免循环依赖引用 utils，这里使用简单的正则提取
      // 更好的做法是把 utils 里的逻辑搬过来或者确保它是纯函数可以安全引用
      // 这里我们在 store 内部实现一个简单的提取器
      const extractWords = (text) => {
          if (!text) return [];
          // 匹配至少3个字母的西语单词
          const matches = text.match(/\b[a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]{3,}\b/g) || [];
          return [...new Set(matches)]; // 去重
      };

      sentencesData.forEach(sentence => {
          const words = extractWords(sentence.spanish_text);
          words.forEach(wordStr => {
              const lowerWord = wordStr.toLowerCase();
              if (dbWordsMap.has(lowerWord)) {
                  // 数据库里有，直接用数据库的（包含 explanations 等）
                  // 不需要重复添加，最后统一合并 dbWordsData
              } else {
                  // 数据库里没有，构造一个临时的单词对象
                  // 这样前端就能高亮它，并且点击时可以发音/查词
                  allExtractedWords.push({
                      id: `temp-${Math.random()}`, // 临时ID
                      spanish_word: wordStr,
                      chinese_translation: '', // 暂时没翻译
                      is_temp: true, // 标记为临时
                      user_id: userStore.user.id
                  });
              }
          });
      });

      // 合并：数据库单词 + 提取出的新单词(去重)
      // 注意 allExtractedWords 里可能有重复（不同句子包含相同词），需要再次去重
      const uniqueExtractedWords = [];
      const seenExtracted = new Set();
      allExtractedWords.forEach(w => {
          const lower = w.spanish_word.toLowerCase();
          if (!dbWordsMap.has(lower) && !seenExtracted.has(lower)) {
              seenExtracted.add(lower);
              uniqueExtractedWords.push(w);
          }
      });

      const finalWords = [...dbWordsData, ...uniqueExtractedWords];

      // 3. 获取学习进度 (由于不再使用 RPC，我们需要单独获取进度并合并)
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
      allWords.value = finalWords

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

    // --- DEBUG CHECK ---
    if (userStore.user.email === 'debug@example.com') {
        console.log('🐞 [StudyStore] resumeSession with debug user, inputs:', {ids, progress});
        const mockSentences = ids.map(id => ({
            id,
            spanish_text: `Debug Sentence ${id}`,
            chinese_translation: `测试句子 ${id} 的中文翻译`,
            tags: ['debug'],
            is_studied: false,
            is_mastered: false
        }));
        console.log('🐞 [StudyStore] Generated mock sentences:', mockSentences.length);
        allSentencesInSession.value = mockSentences;
        allWords.value = []; // empty words for debug
        currentSentenceIndex.value = progress;
        isLoading.value = false;
        return;
    }

    // --- DEMO DATA CHECK ---
    if (ids.some(id => id >= 10000)) {
       console.log('🐞 [StudyStore] Detected demo IDs in resumeSession, using static data');
       const demoSentences = ids.map(id => {
          const i = id - 10000;
          return {
              id,
              spanish_text: [
                'Hola, ¿cómo estás?', 'Me gustaría pedir una cerveza, por favor.', '¿Dónde está la biblioteca?',
                'Hace mucho calor hoy.', 'No entiendo lo que dices.', '¿Puedes repetir eso, por favor?',
                'Me llamo Juan y soy de España.', 'Mañana voy a viajar a Madrid.', 'Este libro es muy interesante.',
                'Gracias por tu ayuda.'
              ][i] || `Oración de ejemplo`,
              chinese_translation: ['你好，你好吗？', '我想点一杯啤酒，谢谢。', '图书馆在哪里？', '今天天气很热。', '我不明白你在说什么。', '请你重复一遍好吗？', '我叫胡安，来自西班牙。', '明天我要去马德里旅行。', '这本书很有趣。', '谢谢你的帮助。'][i] || `示例句子`,
              tags: ['Demo'],
              is_studied: false, is_mastered: false
          };
       });
       allSentencesInSession.value = demoSentences;
       allWords.value = [];
       currentSentenceIndex.value = progress;
       isLoading.value = false;
       return;
    }

    try {
      console.log('🔄 [StudyStore] 正在从数据库恢复会话, IDs:', ids);

      // 1. 获取句子数据
      const { data: sentencesData, error: sentencesError } = await supabase
          .from('sentences')
          .select('*')
          .in('id', ids);

      if (sentencesError) {
          console.error('❌ [StudyStore] 查询句子失败:', sentencesError);
          throw sentencesError;
      }

      console.log(`✅ [StudyStore] 成功查询到 ${sentencesData?.length || 0} 个句子 (期望 ${ids.length} 个)`);

      // 2. 从句子中提取核心词汇
      const { data: dbWordsData, error: wordsError } = await supabase
          .from('high_frequency_words')
          .select('*')
          // .eq('user_id', userStore.user.id); // 移除限制，让 RLS 策略 (Admin or Self) 生效


      if (wordsError) throw wordsError;

      const dbWordsMap = new Map(dbWordsData.map(w => [w.spanish_word.toLowerCase(), w]));
      const allExtractedWords = [];

      const extractWords = (text) => {
          if (!text) return [];
          return [...new Set(text.match(/\b[a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]{3,}\b/g) || [])];
      };

      sentencesData.forEach(sentence => {
          const words = extractWords(sentence.spanish_text);
          words.forEach(wordStr => {
              const lowerWord = wordStr.toLowerCase();
              if (!dbWordsMap.has(lowerWord)) {
                  allExtractedWords.push({
                      id: `temp-${Math.random()}`,
                      spanish_word: wordStr,
                      chinese_translation: '',
                      is_temp: true,
                      user_id: userStore.user.id
                  });
              }
          });
      });

      const uniqueExtractedWords = [];
      const seenExtracted = new Set();
      allExtractedWords.forEach(w => {
          const lower = w.spanish_word.toLowerCase();
          if (!seenExtracted.has(lower)) {
              seenExtracted.add(lower);
              uniqueExtractedWords.push(w);
          }
      });

      const finalWords = [...dbWordsData, ...uniqueExtractedWords];

      // 3. 获取学习进度 (由于不再使用 RPC，我们需要单独获取进度并合并)
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
      const finalSentences = ids.map(id => sentenceMap.get(id)).filter(Boolean);

      if (finalSentences.length === 0) {
          console.warn('⚠️ [StudyStore] 会话ID对应的句子均不存在，可能是脏数据。正在清理用户配置...');
          await userStore.updateUserProfile({
              current_session_ids: null,
              current_session_progress: null
          });
      }

      allSentencesInSession.value = finalSentences;
      allWords.value = finalWords
      currentSentenceIndex.value = progress;

    } catch (error) {
      console.error('恢复学习会话失败:', error)
      // 出错时也清理，防止死循环
      // await userStore.updateUserProfile({ current_session_ids: null, current_session_progress: null });
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
