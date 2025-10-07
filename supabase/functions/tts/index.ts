// 文件: supabase/functions/tts/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (req)=>{
  // 强制处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  // 只允许POST请求
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "只支持POST请求"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { text, isSlow = false } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({
        error: "缺少文本参数"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const GOOGLE_TTS_API_KEY = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!GOOGLE_TTS_API_KEY) {
      return new Response(JSON.stringify({
        error: "服务器配置错误"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const API_URL = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
    let inputText;
    if (isSlow) {
      inputText = `<speak><prosody rate="slow">${text}</prosody></speak>`;
    } else {
      inputText = text;
    }
    const request = {
      input: isSlow ? {
        ssml: inputText
      } : {
        text: inputText
      },
      voice: {
        languageCode: "es-ES",
        ssmlGender: "FEMALE"
      },
      audioConfig: {
        audioEncoding: "MP3"
      }
    };
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify({
        error: "TTS API错误",
        details: error
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const data = await response.json();
    return new Response(JSON.stringify({
      audioContent: data.audioContent
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "内部服务器错误"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
