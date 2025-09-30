import { supabase } from '@/supabase';
import { useUserStore } from '@/stores/userStore';

// 源自您旧项目的 getWordsFromSentence 逻辑
function getWordsFromSentence(sentence) {
    if (!sentence) return [];
    const stopWords = new Set(['a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha', 'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les', 'que', 'quien', 'cuyo', 'donde', 'como', 'cuando', 'cual']);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    return Array.from(new Set(
        sentence.toLowerCase().replace(punctuationRegex, '').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word))
    ));
}


/**
 * 高效的增量词汇同步函数 (混动模式)
 * @param {object} params - 参数对象
 * @param {string} [params.oldSentenceText=''] - 旧的句子文本
 * @param {string} [params.newSentenceText=''] - 新的句子文本
 */
export async function syncWordBankForSentenceChange({ oldSentenceText = '', newSentenceText = '' }) {
    const store = useUserStore();
    if (!store.user) {
        console.error("词库同步失败: 用户未登录。");
        return;
    }
    const userId = store.user.id;

    console.log("开始增量同步个人词库...");

    // 1. 在前端计算单词差异
    const oldWords = getWordsFromSentence(oldSentenceText);
    const newWords = getWordsFromSentence(newSentenceText);

    const wordsToRemove = oldWords.filter(word => !newWords.includes(word));
    const wordsToAdd = newWords.filter(word => !oldWords.includes(word));

    if (wordsToRemove.length === 0 && wordsToAdd.length === 0) {
        console.log("词库无需变动。");
        return;
    }

    // 2. 识别出 "全新单词" 和 "已存在但需增加频率的单词"
    const { data: existingWordsInDb } = await supabase
        .from('high_frequency_words')
        .select('spanish_word')
        .eq('user_id', userId)
        .in('spanish_word', wordsToAdd);

    const existingWordsSet = new Set((existingWordsInDb || []).map(w => w.spanish_word));
    const brandNewWords = wordsToAdd.filter(w => !existingWordsSet.has(w));
    const existingWordsToIncrement = wordsToAdd.filter(w => existingWordsSet.has(w));

    // 3. 将所有“已存在单词”的频率变更，交给后端RPC函数处理
    if (existingWordsToIncrement.length > 0 || wordsToRemove.length > 0) {
        console.log(`更新频率: ${existingWordsToIncrement.length}个增加, ${wordsToRemove.length}个减少`);
        const { error: rpcError } = await supabase.rpc('update_user_word_frequency', {
            p_user_id: userId,
            p_words_to_add: existingWordsToIncrement,
            p_words_to_remove: wordsToRemove
        });
        if (rpcError) {
            console.error('调用RPC更新词频失败:', rpcError);
            // 即使失败，也继续尝试处理新词
        }
    }

    // 4. 在前端处理“全新单词”的翻译和插入
    if (brandNewWords.length > 0) {
        console.log(`发现 ${brandNewWords.length} 个全新单词，正在获取翻译...`);
        try {
            const { data: translationResult, error: functionError } = await supabase.functions.invoke('explain-sentence', {
                body: { words: brandNewWords, getTranslation: true }
            });

            if(functionError) throw functionError;

            // 假设 explain-sentence 返回 { translations: { word: '...' } } 格式
            const translations = translationResult?.translations || {};

            const newWordsToInsert = brandNewWords.map(word => ({
                user_id: userId,
                spanish_word: word,
                frequency: 1, // 全新单词频率为1
                chinese_translation: translations[word] || null
            }));

            if (newWordsToInsert.length > 0) {
                const { error: insertError } = await supabase.from('high_frequency_words').insert(newWordsToInsert);
                if (insertError) throw insertError;
            }

        } catch(error) {
            console.error('处理全新单词失败:', error);
        }
    }

    console.log("个人词库同步完成！");
}
