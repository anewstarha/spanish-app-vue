import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason, AudioInputStream, SpeechRecognitionCanceledEventArgs, CancellationReason } from 'npm:microsoft-cognitiveservices-speech-sdk';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY');
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION');
    if (!azureKey || !azureRegion) {
      throw new Error('Azure credentials not found in function secrets.');
    }
    const formData = await req.formData();
    const audioBlob = formData.get('audio');
    if (!audioBlob || !(audioBlob instanceof File)) {
      throw new Error("Audio blob not found in the request.");
    }
    const audioBuffer = await audioBlob.arrayBuffer();
    const result = await recognizeSpeechFromBuffer(audioBuffer, azureKey, azureRegion);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Critical error in transcribe-audio function:', error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
// 这是简化的函数，它依赖于WAV文件头来自动识别音频格式
function recognizeSpeechFromBuffer(audioBuffer, azureKey, azureRegion) {
  return new Promise((resolve, reject)=>{
    const speechConfig = SpeechConfig.fromSubscription(azureKey, azureRegion);
    speechConfig.speechRecognitionLanguage = 'es-ES';
    const pushStream = AudioInputStream.createPushStream();
    pushStream.write(audioBuffer);
    pushStream.close();
    // 直接从流创建配置，让SDK读取WAV头
    const audioConfig = AudioConfig.fromStreamInput(pushStream);
    const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
    recognizer.recognizeOnceAsync((res)=>{
      let displayResult;
      switch(res.reason){
        case ResultReason.RecognizedSpeech:
          displayResult = {
            RecognitionStatus: 'Success',
            DisplayText: res.text
          };
          break;
        case ResultReason.NoMatch:
          displayResult = {
            RecognitionStatus: 'NoMatch',
            DisplayText: '未能识别出任何语音。'
          };
          break;
        case ResultReason.Canceled:
          const cancellation = SpeechRecognitionCanceledEventArgs.fromResult(res);
          let errorMessage = `Operation Canceled: ${cancellation.reason}`;
          if (cancellation.reason === CancellationReason.Error) {
            errorMessage += ` | ErrorCode=${cancellation.errorCode} | ErrorDetails=${cancellation.errorDetails}`;
          }
          displayResult = {
            RecognitionStatus: 'Canceled',
            DisplayText: errorMessage
          };
          break;
        default:
          displayResult = {
            RecognitionStatus: ResultReason[res.reason],
            DisplayText: ''
          };
          break;
      }
      recognizer.close();
      resolve(displayResult);
    }, (err)=>{
      console.error("ERROR in recognizeOnceAsync:", err);
      recognizer.close();
      reject(err);
    });
  });
}
