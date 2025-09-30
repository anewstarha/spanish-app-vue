import 'https://deno.land/x/dotenv@v3.2.2/load.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// 从环境变量中获取 Gemini API Key
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
/**
 * 通用的 Gemini AI 调用函数
 */ async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 未在环境变量中设置。");
  }
  // 注意：为了更好的JSON输出能力，建议使用gemini-1.5-pro或更新的模型
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      // 新增：要求模型返回JSON格式
      generationConfig: {
        responseMimeType: "application/json"
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    })
  });
  const data = await response.json();
  if (response.status !== 200 || !data.candidates) {
    console.error('Gemini API Error:', data);
    throw new Error(`Gemini API 错误：${data.error?.message || '未知错误'}`);
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
// 这个函数现在可能不再是必需的了，因为我们直接要求AI返回JSON，但保留它以防万一
function cleanJsonString(rawString) {
  const trimmedString = rawString.trim();
  if (trimmedString.startsWith('```json') && trimmedString.endsWith('```')) {
    return trimmedString.substring(7, trimmedString.length - 3).trim();
  }
  return trimmedString;
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const { sentence, sentences, words, word, getExplanation, getTranslation } = body;
    let prompt = '';
    // --- 智能判断任务类型并生成相应指令 ---
    // 【复合任务优化】批量翻译句子并获取更丰富的AI解释
    if (getTranslation && getExplanation && Array.isArray(sentences)) {
      prompt = `
        您是一位专业的西班牙语老师，请为一名中文母语的学习者处理以下西班牙语句子。
        您的任务是为每个句子生成一个包含翻译和详细解释的JSON对象。
        请严格按照指定的JSON数组格式返回结果，不要添加任何额外的文本或markdown标记。

        对于每个句子，请生成一个如下结构的对象：
        {
          "spanish_text": "原始西班牙语句子",
          "chinese_translation": "准确的中文翻译",
          "ai_notes": "这是一段详细的中文解释，请包含以下几点：\\n1. **核心语法点**：简单说明句子中最重要的一个语法结构。\\n2. **重点词汇**：列出1-2个关键单词及其在本句中的含义。\\n3. **举一反三**：提供一个使用相同语法点或词汇的简短新例句及其翻译。"
        }
        
        需要处理的句子列表: ${JSON.stringify(sentences.map((s)=>s.spanish_text))}
      `;
      const jsonString = await callGemini(prompt);
      const translatedSentences = JSON.parse(jsonString); // 直接解析，因为AI被要求返回纯JSON
      return new Response(JSON.stringify({
        translatedSentences
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 【单词解析优化】为单个单词生成更可靠的JSON学习卡片
    if (getExplanation && typeof word === 'string') {
      prompt = `
        您是一位专业的西班牙语老师，请为中文母语者提供关于西班牙语单词 "${word}" 的一份深度学习卡片。
        请严格按照指定的JSON格式返回您的回答，确保所有键和值都是字符串。如果某个字段不适用（例如非动词没有变位），请返回 null 或者一个空数组。
        不要添加任何额外的文本或markdown标记。

        返回的JSON对象结构如下:
        {
          "ipa": "在这里填写国际音标",
          "pronunciationTip": "在这里用中文填写一句话发音技巧",
          "partOfSpeech": "在这里填写词性，例如 '及物动词', '阴性名词', '形容词'",
          "coreMeaning": "在这里填写核心的中文含义",
          "usageNotes": "在这里填写1-2个最常见的用法或搭配，并提供例句",
          "conjugationTable": {
            "tense": "陈述式现在时",
            "forms": [
              "yo ...", "tú ...", "él/ella/Ud. ...", "nosotros/as ...", "vosotros/as ...", "ellos/ellas/Uds. ..."
            ]
          },
          "mnemonic": "在这里提供一个有创意的联想记忆技巧",
          "synonyms": ["填写1-2个近义词"],
          "antonyms": ["填写1-2个反义词"]
        }
      `;
      const jsonString = await callGemini(prompt);
      // 不需要再清洗，因为API会直接返回JSON字符串
      return new Response(jsonString, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- 以下是旧的、保持不变的任务逻辑 ---
    if (getTranslation && Array.isArray(words)) {
    // ... (省略未改动的代码)
    }
    if (getTranslation && Array.isArray(sentences)) {
    // ... (省略未改动的代码)
    }
    if (getExplanation && typeof sentence === 'string') {
    // ... (省略未改动的代码)
    }
    return new Response(JSON.stringify({
      error: '无效的请求格式。'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
