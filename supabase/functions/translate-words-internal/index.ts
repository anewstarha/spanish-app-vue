import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
serve(async (req)=>{
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405
    });
  }
  const { words } = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');
  const { data, error } = await supabase.functions.invoke('ai', {
    body: JSON.stringify({
      prompt: `将以下西班牙语单词翻译成中文，以JSON格式返回一个数组，每个对象包含"spanish_word"和"chinese_translation"两个字段。仅返回JSON，不要包含任何额外文字。
      单词列表: ${words.join(', ')}`
    })
  });
  if (error) {
    console.error('AI invocation error:', error);
    return new Response(JSON.stringify({
      error: 'AI translation failed.'
    }), {
      status: 500
    });
  }
  let translatedWords;
  try {
    translatedWords = JSON.parse(data);
  } catch (e) {
    console.error('JSON parsing error:', e, 'Raw AI response:', data);
    return new Response(JSON.stringify({
      error: 'Failed to parse AI response.'
    }), {
      status: 500
    });
  }
  return new Response(JSON.stringify({
    translatedWords
  }), {
    headers: {
      'Content-Type': 'application/json'
    },
    status: 200
  });
});
