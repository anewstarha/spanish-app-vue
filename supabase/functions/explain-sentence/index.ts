import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// --- 环境变量 ---
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// --- CORS 响应头 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 封装一个通用的、基于 fetch 的 Gemini AI 调用函数
 */
async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const modelName = "gemini-2.5-pro"; // 使用您指定的模型
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error('Gemini API Error:', errorBody);
    throw new Error(`Gemini API Error: ${errorBody.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('Gemini API Error: No text content in response', data);
    throw new Error('Gemini API did not return any text content.');
  }
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sentence, sentences, words, word, getExplanation, getTranslation } = await req.json();

    // --- 任务1: 【核心更新】批量处理句子（翻译 + 我们新设计的AI解释） ---
    if (getTranslation && getExplanation && Array.isArray(sentences)) {
      const prompt = `You are a professional Spanish teacher for a Chinese native speaker. For each sentence in the list below, generate a JSON object. Strictly return the result as a JSON array, with no additional text or markdown.

Each JSON object must have this structure:
{
  "spanish_text": "Original Spanish sentence",
  "chinese_translation": "Accurate Chinese translation",
  "ai_notes": {
    "grammar_analysis": "In Chinese, briefly explain the most important grammatical point of the sentence.",
    "translation_analysis": "In Chinese, explain how the translation was derived, focusing on word choice, idioms, or word order adjustments.",
    "extended_sentences": "Provide one new short example sentence in Spanish that uses a similar grammar point, along with its Chinese translation."
  }
}

List of sentences to process: ${JSON.stringify(sentences.map(s => s.spanish_text))}`;

      const jsonString = await callGemini(prompt);
      const translatedSentences = JSON.parse(jsonString);
      return new Response(JSON.stringify({ translatedSentences }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 任务2: 为单个单词生成AI学习卡片 ---
    if (getExplanation && typeof word === 'string') {
        const prompt = `You are a professional Spanish teacher. Provide a detailed learning card for the Spanish word "${word}" for a Chinese native speaker. Strictly return your response in the specified JSON format. Ensure all keys and values are strings. If a field is not applicable (e.g., no conjugation for a noun), return null or an empty array. Add no extra text or markdown.

Return a JSON object with this structure:
{
  "ipa": "IPA pronunciation here",
  "pronunciationTip": "A one-sentence pronunciation tip in Chinese",
  "partOfSpeech": "Part of speech, e.g., 'Transitive Verb', 'Feminine Noun', 'Adjective'",
  "coreMeaning": "Core Chinese meaning here",
  "usageNotes": "Provide 1-2 common usages or collocations with example sentences and their Chinese translations.",
  "mnemonic": "Provide a creative mnemonic tip in Chinese.",
  "synonyms": ["Provide 1-2 synonyms"],
  "antonyms": ["Provide 1-2 antonyms"]
}`;
      const jsonString = await callGemini(prompt);
      return new Response(jsonString, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 任务3: 批量翻译单词 ---
    if (getTranslation && !getExplanation && Array.isArray(words)) {
      const prompt = `Translate the following Spanish words into Chinese. Return a valid JSON object where keys are the original Spanish words and values are their Chinese translations. Add no extra text or markdown.

Spanish words: ${JSON.stringify(words)}

JSON object:`;
      const jsonString = await callGemini(prompt);
      const translations = JSON.parse(jsonString);
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 任务4: 只为批量句子获取翻译 ---
     if (getTranslation && !getExplanation && Array.isArray(sentences)) {
        const prompt = `For each Spanish sentence in the following list, provide its Chinese translation. Return a valid JSON array of objects. Each object must contain both the original "spanish_text" and its "chinese_translation". Preserve the order.

Example format: [{"spanish_text": "Hola", "chinese_translation": "你好"}].

Sentences to translate: ${JSON.stringify(sentences.map(s => s.spanish_text))}`;

        const jsonString = await callGemini(prompt);
        const translatedSentences = JSON.parse(jsonString);

        return new Response(JSON.stringify({ translatedSentences }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 如果没有匹配的任务，返回 400 错误
    return new Response(JSON.stringify({ error: 'Invalid request format or combination of parameters.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
