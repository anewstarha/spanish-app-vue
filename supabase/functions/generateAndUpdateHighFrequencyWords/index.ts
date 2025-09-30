// supabase/functions/generateAndUpdateHighFrequencyWords/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// CORS headers for preflight requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- 【优化 1: 优化并缩减停用词列表】 ---
// 只排除冠词、最常见的介词和连词，保留对学习者有用的高频词。
const spanishStopWords = new Set([
  // Articles (冠词)
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // Prepositions (常用介词)
  'a', 'ante', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'sin', 'sobre',
  // Conjunctions (常用连词)
  'y', 'e', 'o', 'u', 'mas', 'pero', 'aunque',
  // Contractions (缩合词)
  'al', 'del'
]);


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    const { userId } = await req.json();
    if (!userId) {
      throw new Error("User ID is required.");
    }

    const { data: sentences, error: sentencesError } = await supabaseAdmin
      .from('sentences')
      .select('spanish_text')
      .eq('user_id', userId);

    if (sentencesError) throw sentencesError;

    const wordFrequencyMap = new Map<string, number>();
    for (const sentence of sentences) {
      const words = sentence.spanish_text.toLowerCase().match(/\b[\w']+\b/g) || [];

      const filteredWords = words.filter(word =>
        word.length > 1 && !spanishStopWords.has(word)
      );

      for (const word of filteredWords) {
        wordFrequencyMap.set(word, (wordFrequencyMap.get(word) || 0) + 1);
      }
    }

    const { data: existingWords, error: existingWordsError } = await supabaseAdmin
      .from('high_frequency_words')
      .select('spanish_word')
      .eq('user_id', userId);
    if (existingWordsError) throw existingWordsError;

    const existingWordSet = new Set(existingWords.map(w => w.spanish_word));

    const newWordsToTranslate = [];
    for (const word of wordFrequencyMap.keys()) {
      if (!existingWordSet.has(word)) {
        newWordsToTranslate.push(word);
      }
    }

    if (newWordsToTranslate.length > 0) {
      const { data: translationData, error: invokeError } = await supabaseAdmin.functions.invoke('explain-sentence', {
        body: { words: newWordsToTranslate, getTranslation: true },
      });
      if (invokeError) throw invokeError;

      const translations = translationData.translations;
      const newWordsToInsert = Object.entries(translations).map(([spanish, chinese]) => ({
        user_id: userId,
        spanish_word: spanish,
        chinese_translation: chinese,
        frequency: 0,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('high_frequency_words')
        .insert(newWordsToInsert);
      if (insertError) throw insertError;
    }

    const wordsToUpsert = [];
    for (const [word, frequency] of wordFrequencyMap.entries()) {
      wordsToUpsert.push({
        user_id: userId,
        spanish_word: word,
        frequency: frequency,
      });
    }

    if (wordsToUpsert.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('high_frequency_words')
          .upsert(wordsToUpsert, { onConflict: 'user_id, spanish_word' });
        if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({ message: "Word bank updated successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
