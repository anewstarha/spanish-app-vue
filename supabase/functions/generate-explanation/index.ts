import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.12.0'

// --- 环境变量 (与您的配置保持一致) ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// --- AI 模型初始化 ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

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
    // --- 1. 解析来自数据库触发器的 Webhook 负载 ---
    // Supabase 触发器发送的 body 格式为 { record: { ... } }
    const { record } = await req.json()
    if (!record || !record.id || !record.spanish_text) {
      throw new Error("Invalid webhook payload. 'record' with 'id' and 'spanish_text' is required.")
    }

    // --- 安全检查：如果该句子已有解释，则直接退出，避免重复处理和计费 ---
    if (record.ai_explanation) {
      console.log(`Sentence ${record.id} already has an explanation. Skipping.`)
      return new Response(JSON.stringify({ message: 'Already processed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // --- 2. 构建获取详细解释的 AI Prompt ---
    const prompt = `Act as a Spanish language teacher. For the following Spanish sentence, provide a detailed explanation in Chinese. The explanation should be structured in a valid JSON object with three keys: "grammar_analysis", "key_words", and "extended_sentences".
- "grammar_analysis": Explain the grammatical structure of the sentence, including verb conjugations, tenses, and sentence patterns.
- "key_words": Identify 2-3 key vocabulary words, providing their Chinese translation and a brief explanation.
- "extended_sentences": Provide two example sentences that use a similar grammatical structure or vocabulary, along with their Chinese translations.

Spanish Sentence: "${record.spanish_text}"

Return only the JSON object, without any other text or markdown formatting.`

    // --- 3. 调用 AI 生成解释 ---
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // 尝试从返回文本中提取纯净的 JSON 对象
    let explanationJson;
    try {
        const jsonMatch = responseText.match(/{[\s\S]*}/);
        if (!jsonMatch) {
            throw new Error("AI response did not contain a valid JSON object.");
        }
        explanationJson = JSON.parse(jsonMatch[0]);
    } catch(e) {
        console.error("Failed to parse AI explanation response:", responseText);
        throw new Error("AI explanation response was not valid JSON.");
    }

    // --- 4. 将生成的解释更新回数据库 ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error: updateError } = await supabaseAdmin
      .from('sentences')
      .update({ ai_explanation: explanationJson }) // 直接存储 JSON 对象
      .eq('id', record.id)

    if (updateError) {
      throw updateError
    }

    // --- 5. 返回成功响应 ---
    return new Response(JSON.stringify({ message: `Successfully generated and saved explanation for sentence ${record.id}.` }), {
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
