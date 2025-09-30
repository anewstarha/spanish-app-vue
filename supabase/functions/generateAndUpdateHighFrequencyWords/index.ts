import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.12.0'

// --- 环境变量 (与您的配置保持一致) ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// --- AI 模型初始化 (用于单词翻译) ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

// --- CORS 响应头 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- 文本处理工具 (源自您的 textUtils.js 文件) ---
const stopWords = new Set(['a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha', 'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les', 'que', 'quien', 'cuyo', 'donde', 'como', 'cuando']); //
const punctuationRegex = /[.,;!?()"\-—:¿¡]/g; //

/**
 * 用于生成“单词列表”，会过滤掉标点和常见停用词
 * @param {string} sentence 输入的句子
 * @returns {string[]} 返回核心词汇数组
 */
function getCoreWordsFromSentence(sentence: string): string[] { //
  if (!sentence) return []; //
  return sentence.toLowerCase() //
                 .replace(punctuationRegex, '') //
                 .split(/\s+/) //
                 .filter(word => word.length > 1 && !stopWords.has(word)); //
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- 1. 解析来自数据库触发器的 Webhook 负载 ---
    const { record } = await req.json()
    if (!record || !record.user_id || !record.spanish_text) {
      throw new Error("Invalid webhook payload. 'record' with 'user_id' and 'spanish_text' is required.")
    }
    const { user_id: userId, spanish_text: spanishText } = record

    // --- 2. 提取核心单词 ---
    const wordsToAdd = Array.from(new Set(getCoreWordsFromSentence(spanishText)))
    if (wordsToAdd.length === 0) {
      return new Response(JSON.stringify({ message: 'No new words to process.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // --- 3. 区分“全新词”和“已存在词” ---
    const { data: existingWordsData, error: selectError } = await supabaseAdmin
      .from('high_frequency_words')
      .select('spanish_word')
      .eq('user_id', userId)
      .in('spanish_word', wordsToAdd)

    if (selectError) throw selectError

    const existingWordsSet = new Set(existingWordsData.map(w => w.spanish_word))
    const brandNewWords = wordsToAdd.filter(w => !existingWordsSet.has(w))
    const existingWordsToIncrement = wordsToAdd.filter(w => existingWordsSet.has(w))

    // --- 4. 处理“全新词”（获取翻译并插入） ---
    if (brandNewWords.length > 0) {
      const prompt = `Translate the following Spanish words into Chinese. Return a valid JSON object where keys are the original Spanish words and values are their Chinese translations.

Spanish words: ${JSON.stringify(brandNewWords)}

JSON object:`
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      if (!jsonMatch) throw new Error("AI word translation response did not contain a valid JSON object.");

      const translations: Record<string, string> = JSON.parse(jsonMatch[0]);

      const newWordsToInsert = brandNewWords.map(word => ({
        user_id: userId,
        spanish_word: word,
        chinese_translation: translations[word] || 'N/A',
        frequency: 1
      }));

      const { error: insertError } = await supabaseAdmin
        .from('high_frequency_words')
        .insert(newWordsToInsert);

      if (insertError) throw insertError;
    }

    // --- 5. 处理“已存在词”（调用RPC增加频率） ---
    if (existingWordsToIncrement.length > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('update_user_word_frequency', {
        p_user_id: userId,
        p_words_to_add: existingWordsToIncrement,
        p_words_to_remove: [] // 在新增场景下，移除列表为空
      });
      if (rpcError) throw rpcError;
    }

    return new Response(JSON.stringify({ message: 'Vocabulary updated successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
