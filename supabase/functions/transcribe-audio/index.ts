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
      throw new Error('Azure credentials not found in Supabase function environment variables.');
    }

    const formData = await req.formData();
    const audioBlob = formData.get('audio'); // as FormDataEntryValue;

    if (!audioBlob || !(audioBlob instanceof File)) {
      throw new Error("Audio blob not found in the request.");
    }

    // --- 【核心修改】---
    // 不再从 formData 读取独立的 mimeType 字段，
    // 而是直接从接收到的文件对象中获取它的类型。这更可靠！
    const mimeType = audioBlob.type;

    if (!mimeType) {
        throw new Error("MIME type could not be determined from the uploaded audio file.");
    }

    const azureUrl = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=es-ES&format=simple`;

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': mimeType,
      },
      body: audioBlob,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Azure API Error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    console.log('Azure API Response:', JSON.stringify(result, null, 2));

    if (result.RecognitionStatus === 'Success') {
      const transcript = result.DisplayText || '';
      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      const failureReason = result.RecognitionStatus || 'UnknownRecognitionFailure';
       return new Response(JSON.stringify({ transcript: '', reason: failureReason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
      });
    }

  } catch (error) {
    console.error('Critical error in transcribe-audio function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
