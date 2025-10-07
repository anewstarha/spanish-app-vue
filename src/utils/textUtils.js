// src/utils/textUtils.js

// 复制自你旧项目的停用词列表
const stopWords = new Set(['a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'mas', 'es', 'son', 'está', 'están', 'fue', 'fueron', 'ser', 'estar', 'haber', 'hay', 'ha', 'no', 'mi', 'tu', 'su', 'mí', 'te', 'se', 'me', 'nos', 'os', 'lo', 'los', 'la', 'las', 'le', 'les', 'que', 'quien', 'cuyo', 'donde', 'como', 'cuando']);

const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;

// 用于生成"单词列表"，会过滤掉标点和常见停用词
export function getCoreWordsFromSentence(sentence) {
  if (!sentence || typeof sentence !== 'string') return [];
  try {
    return sentence.toLowerCase()
                   .replace(punctuationRegex, '')
                   .split(/\s+/)
                   .filter(word => word && word.length > 1 && !stopWords.has(word));
  } catch (error) {
    console.error('解析句子时出错:', error);
    return [];
  }
}

// 用于"逐词朗读"，只去除标点，不过滤任何单词
export function splitSentenceForTts(sentence) {
  if (!sentence || typeof sentence !== 'string') return [];
  try {
    return sentence.toLowerCase()
                   .replace(punctuationRegex, '')
                   .split(/\s+/)
                   .filter(word => word && word.length > 0);
  } catch (error) {
    console.error('分割句子时出错:', error);
    return [];
  }
}

// 将文本中的西班牙语单词包裹在可点击的span标签中
export function linkifySpanishWords(text) {
  if (!text || typeof text !== 'string') return '';
  try {
    // 这个正则表达式会匹配包含西班牙语特殊字符的单词
    const spanishWordRegex = /([a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]+)/g;
    return text.replace(spanishWordRegex, '<span class="clickable-word" data-word="$1">$1</span>');
  } catch (error) {
    console.error('处理西班牙语单词时出错:', error);
    return text;
  }
}