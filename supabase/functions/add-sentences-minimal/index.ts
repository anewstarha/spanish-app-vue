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
  // 处理浏览器的 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- 1. 初始化客户端并验证用户 ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')!.replace('Bearer ', '')
    )
    if (!user) {
      throw new Error("User not authenticated.")
    }

    // --- 2. 解析请求体 ---
    const { sentences, tags } = await req.json()
    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      throw new Error("Input sentences are required.")
    }

    // --- 3. 调用 AI 仅获取翻译 ---
    const prompt = `Translate the following Spanish sentences into Chinese. Return the result as a valid JSON array of strings, where each string is the translation of the corresponding sentence. Do not include any other text or explanations. The order must be preserved.

Input sentences:
${JSON.stringify(sentences)}

JSON Array of translations:`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // 清理并解析AI返回的JSON字符串
    let translations: string[] = [];
    try {
        // 尝试找到JSON数组的开始和结束位置，以防AI返回额外文本
        const jsonMatch = responseText.match(/\[.*\]/s);
        if (jsonMatch) {
            translations = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("AI did not return a valid JSON array.");
        }
    } catch (e) {
        console.error("Failed to parse AI translation response:", responseText);
        throw new Error("AI translation response was not valid JSON.");
    }

    if (translations.length !== sentences.length) {
      throw new Error("Mismatch between number of original sentences and translations.")
    }

    // --- 4. 准备数据并写入数据库 ---
    const sentencesToInsert = sentences.map((spanish_text, index) => ({
      user_id: user.id,
      spanish_text: spanish_text.trim(),
      chinese_translation: translations[index],
      tags: tags && tags.length > 0 ? tags : null,
      ai_explanation: null, // 解释字段留空，等待后台任务填充
    }))

    const { error: insertError } = await supabaseAdmin
      .from('sentences')
      .insert(sentencesToInsert)

    if (insertError) {
      throw insertError
    }

    // --- 5. 返回成功响应 ---
    return new Response(JSON.stringify({ message: 'Sentences added successfully. Processing explanation and vocabulary in the background.' }), {
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
