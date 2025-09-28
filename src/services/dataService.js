import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/userStore'

export async function getStudyData() {
  const store = useUserStore()
  if (!store.user) {
    console.error('获取学习数据失败：用户未登录')
    return { sentences: [], allTags: [] }
  }

  // 恢复使用你的高效 RPC 调用
  const { data: sentencesData, error } = await supabase.rpc('get_user_sentences_with_progress', {
    p_user_id: store.user.id
  })

  if (error) {
    console.error('调用 RPC 函数 get_user_sentences_with_progress 失败:', error)
    throw new Error('Failed to fetch study data via RPC.')
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
