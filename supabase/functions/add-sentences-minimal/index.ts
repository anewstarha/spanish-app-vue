import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'

// --- 环境变量 ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

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
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')!.replace('Bearer ', '')
    )
    if (!user) throw new Error("User not authenticated.")

    const { sentences, tags } = await req.json()
    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      throw new Error("Input sentences are required.")
    }

    // --- 核心改动：使用原始 fetch 调用 Google AI ---
    const modelName = "gemini-2.5-pro" // 使用您指定的 gemini-2.5-pro 如果您确定，否则这是一个稳妥的备选
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`

    const prompt = `Translate the following Spanish sentences into Chinese. Return the result as a valid JSON array of strings, where each string is the translation of the corresponding sentence. Do not include any other text or explanations. The order must be preserved.

Input sentences:
${JSON.stringify(sentences)}

JSON Array of translations:`

    const aiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.json()
      console.error("Google AI API Error:", errorBody);
      throw new Error(`Google AI API returned an error: ${errorBody.error.message}`)
    }

    const aiResult = await aiResponse.json()
    const responseText = aiResult.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\[.*\]/s);
    if (!jsonMatch) throw new Error("AI did not return a valid JSON array.");
    const translations = JSON.parse(jsonMatch[0]);

    if (translations.length !== sentences.length) {
      throw new Error("Mismatch between number of original sentences and translations.")
    }

    const sentencesToInsert = sentences.map((spanish_text, index) => ({
      user_id: user.id,
      spanish_text: spanish_text.trim(),
      chinese_translation: translations[index],
      tags: tags && tags.length > 0 ? tags : null,
      ai_notes: null,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('sentences')
      .insert(sentencesToInsert)

    if (insertError) throw insertError

    return new Response(JSON.stringify({ message: 'Sentences added successfully.' }), {
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
