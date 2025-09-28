import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY');
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION');

    if (!azureKey || !azureRegion) {
      throw new Error('Azure credentials not found in Supabase function secrets.');
    }

    const formData = await req.formData();
    const audioBlob = formData.get('audio');

    if (!audioBlob || !(audioBlob instanceof File)) {
      throw new Error("Audio blob not found in the request.");
    }

    const mimeType = audioBlob.type;
    if (!mimeType) {
        throw new Error("MIME type could not be determined from the uploaded audio file.");
    }

    const azureUrl = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/dictation/cognitiveservices/v1?language=es-ES&format=simple`;

    // --- 【核心修改】---
    // 将 File 对象转换为 ArrayBuffer，以确保发送的是纯粹的二进制数据。
    const audioData = await audioBlob.arrayBuffer();

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': mimeType,
        'User-Agent': 'Supabase/Deno-Fetch'
      },
      body: audioData, // 使用转换后的 ArrayBuffer
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // 尝试解析为JSON，如果Azure返回了结构化错误
      try {
        const jsonError = JSON.parse(errorBody);
        throw new Error(`Azure API Error (${response.status}): ${jsonError.message || errorBody}`);
      } catch(e) {
        throw new Error(`Azure API Error (${response.status}): ${errorBody}`);
      }
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Critical error in transcribe-audio function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
