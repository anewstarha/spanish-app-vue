import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.12.0'

// --- 环境变量 ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// --- AI 模型初始化 ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }) // 已修正为 gemini-pro

// --- CORS 响应头 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    if (!record || !record.id || !record.spanish_text) {
      throw new Error("Invalid webhook payload.")
    }

    // =======================
    // === 核心修正点 2/2 (a) ===
    // =======================
    if (record.ai_notes) { // 将 ai_explanation 更正为 ai_notes
      console.log(`Sentence ${record.id} already has notes. Skipping.`)
      return new Response(JSON.stringify({ message: 'Already processed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // ... (AI Prompt 部分代码保持不变) ...
    const prompt = `Act as a Spanish language teacher. For the following Spanish sentence, provide a detailed explanation in Chinese. The explanation should be structured in a valid JSON object with three keys: "grammar_analysis", "key_words", and "extended_sentences".
- "grammar_analysis": Explain the grammatical structure of the sentence, including verb conjugations, tenses, and sentence patterns.
- "key_words": Identify 2-3 key vocabulary words, providing their Chinese translation and a brief explanation.
- "extended_sentences": Provide two example sentences that use a similar grammatical structure or vocabulary, along with their Chinese translations.

Spanish Sentence: "${record.spanish_text}"

Return only the JSON object, without any other text or markdown formatting.`
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    const jsonMatch = responseText.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("AI response did not contain a valid JSON object.");
    const explanationJson = JSON.parse(jsonMatch[0]);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // =======================
    // === 核心修正点 2/2 (b) ===
    // =======================
    const { error: updateError } = await supabaseAdmin
      .from('sentences')
      .update({ ai_notes: explanationJson }) // 将 ai_explanation 更正为 ai_notes
      .eq('id', record.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ message: `Successfully generated notes for sentence ${record.id}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
