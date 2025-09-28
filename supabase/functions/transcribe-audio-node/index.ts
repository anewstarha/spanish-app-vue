import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  SpeechConfig,
  AudioConfig,
  SpeechRecognizer,
  ResultReason,
  AudioInputStream,
  PushAudioInputStream,
} from 'microsoft-cognitiveservices-speech-sdk'

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 预检请求处理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取 Azure 凭证
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')

    if (!azureKey || !azureRegion) {
      throw new Error('Azure credentials not found in function secrets.')
    }

    // 获取前端上传的音频数据
    const formData = await req.formData()
    const audioBlob = formData.get('audio')

    if (!audioBlob || !(audioBlob instanceof File)) {
      throw new Error("Audio blob not found in the request.")
    }
    const audioBuffer = await audioBlob.arrayBuffer()

    // 使用 Azure Speech SDK 进行识别
    const result = await recognizeSpeechFromBuffer(audioBuffer, azureKey, azureRegion)

    // 将SDK返回的结果发送回前端
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Critical error in transcribe-audio-node function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/**
 * 使用 Azure Speech SDK 从音频 Buffer 中识别语音
 */
function recognizeSpeechFromBuffer(
  audioBuffer: ArrayBuffer,
  azureKey: string,
  azureRegion: string
): Promise<{ RecognitionStatus: string; DisplayText: string }> {

  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(azureKey, azureRegion)
    speechConfig.speechRecognitionLanguage = 'es-ES'

    const pushStream: PushAudioInputStream = AudioInputStream.createPushStream()
    pushStream.write(audioBuffer)
    pushStream.close()

    const audioConfig = AudioConfig.fromStreamInput(pushStream)
    const recognizer = new SpeechRecognizer(speechConfig, audioConfig)

    recognizer.recognizeOnceAsync(
      (res) => {
        let displayResult: { RecognitionStatus: string; DisplayText: string };

        if (res.reason === ResultReason.RecognizedSpeech) {
          displayResult = { RecognitionStatus: 'Success', DisplayText: res.text };
        } else {
          displayResult = { RecognitionStatus: ResultReason[res.reason], DisplayText: '' };
        }
        recognizer.close();
        resolve(displayResult);
      },
      (err) => {
        console.error("ERROR in recognizeOnceAsync:", err);
        recognizer.close();
        reject(err);
      }
    );
  });
}
