import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/userStore'

export async function getStudyData() {
  const store = useUserStore()
  if (!store.user) {
    console.error('获取学习数据失败：用户未登录')
    return { sentences: [], allTags: [] }
  }

  // --- DEBUG CHECK ---
  if (store.user.email === 'debug@example.com') {
    const mockSentences = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      spanish_text: `Debug Sentence ${i + 1}`,
      chinese_translation: `测试句子 ${i + 1} 的中文翻译`,
      tags: ['debug'],
      is_studied: i < 2,
      is_mastered: false,
      is_public: true
    }));
    return {
      sentences: mockSentences,
      allTags: ['debug']
    };
  }

  // 恢复使用你的高效 RPC 调用
  const { data: sentencesData, error } = await supabase.rpc('get_user_sentences_with_progress', {
    p_user_id: store.user.id
  })

  if (error) {
    console.error('调用 RPC 函数 get_user_sentences_with_progress 失败:', error)
    throw new Error('Failed to fetch study data via RPC.')
  }

  // --- FALLBACK / DEMO DATA ---
  // 如果数据库返回为空（通常是因为没有名为 chenlongfei@outlook.com 的管理员账号或其未创建内容）
  // 为了不让新用户看到空页面，我们注入一些演示数据。
  if (!sentencesData || sentencesData.length === 0) {
    console.warn('数据库未返回任何内容，使用默认演示数据');
    const demoSentences = Array.from({ length: 10 }, (_, i) => ({
      id: 10000 + i, // Use high IDs to avoid conflict with real IDs potentially
      spanish_text: [
        'Hola, ¿cómo estás?',
        'Me gustaría pedir una cerveza, por favor.',
        '¿Dónde está la biblioteca?',
        'Hace mucho calor hoy.',
        'No entiendo lo que dices.',
        '¿Puedes repetir eso, por favor?',
        'Me llamo Juan y soy de España.',
        'Mañana voy a viajar a Madrid.',
        'Este libro es muy interesante.',
        'Gracias por tu ayuda.'
      ][i] || `Oración de ejemplo ${i + 1}`,
      chinese_translation: [
        '你好，你好吗？',
        '我想点一杯啤酒，谢谢。',
        '图书馆在哪里？',
        '今天天气很热。',
        '我不明白你在说什么。',
        '请你重复一遍好吗？',
        '我叫胡安，来自西班牙。',
        '明天我要去马德里旅行。',
        '这本书很有趣。',
        '谢谢你的帮助。'
      ][i] || `示例句子 ${i + 1}`,
      tags: i < 3 ? ['入门'] : (i < 6 ? ['旅行'] : ['日常']),
      is_studied: false,
      is_mastered: false,
      is_public: true
    }));
    return {
      sentences: demoSentences,
      allTags: ['入门', '旅行', '日常']
    };
  }

  const uniqueTags = new Set()

  // 处理 RPC 返回的数据，为 null 的字段提供默认值
  const processedSentences = sentencesData.map(sentence => {
    if (sentence.tags && sentence.tags.length > 0) {
      sentence.tags.forEach(tag => uniqueTags.add(tag))
    }

    return {
      ...sentence,
      // 确保 is_studied 和 is_mastered 总是有布尔值
      is_studied: sentence.is_studied || false,
      is_mastered: sentence.is_mastered || false,
    }
  })

  return {
    sentences: processedSentences,
    allTags: Array.from(uniqueTags).sort()
  }
}
