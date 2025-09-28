import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  SpeechConfig,
  AudioConfig,
  SpeechRecognizer,
  ResultReason,
  AudioInputStream,
  PushAudioInputStream,
} from 'microsoft-cognitiveservices-speech-sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    if (!azureKey || !azureRegion) {
      throw new Error('Azure credentials not found in function secrets.')
    }

    const formData = await req.formData()
    const audioBlob = formData.get('audio')
    if (!audioBlob || !(audioBlob instanceof File)) {
      throw new Error("Audio blob not found in the request.")
    }
    const audioBuffer = await audioBlob.arrayBuffer()

    const result = await recognizeSpeechFromBuffer(audioBuffer, azureKey, azureRegion)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Critical error in transcribe-audio function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

function recognizeSpeechFromBuffer(
  audioBuffer: ArrayBuffer,
  azureKey: string,
  azureRegion: string
): Promise<{ RecognitionStatus: string; DisplayText: string }> {

  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(azureKey, azureRegion)
    speechConfig.speechRecognitionLanguage = 'es-ES'

    // 因为我们现在发送的是一个完整的WAV文件，SDK可以自动识别其头部信息。
    // 我们不再需要手动指定音频格式。
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
