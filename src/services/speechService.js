// src/services/speechService.js

import { supabase } from '@/supabase';
import { splitSentenceForTts } from '@/utils/textUtils';

const audio = new Audio();
let isAudioUnlocked = false;

// --- 【核心修改在这里】 ---
async function _unlockAudio() {
  if (isAudioUnlocked) return;

  // 直接使用全局的 audio 对象来播放无声音频以解锁
  const originalSrc = audio.src; // 保存当前可能存在的 src
  audio.src = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
  audio.volume = 0;

  try {
    await audio.play();
    isAudioUnlocked = true;
    console.log("Audio context unlocked successfully using the main audio object.");
  } catch (error) {
    isAudioUnlocked = true;
    console.warn("Audio context unlock failed, but this is often not a critical error.", error);
  } finally {
    // 播放完无声音频后，恢复它之前的状态
    audio.src = originalSrc;
    audio.volume = 1; // 恢复音量
  }
}

function cancel() {
  if (!audio.paused) {
    audio.pause();
    audio.src = '';
  }
}

async function _executeSpeak(text, isSlow = false) {
  if (!text) return;

  const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("用户未认证");

  const response = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ text, isSlow }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(errorBody.error || `TTS API 错误 (${response.status})`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("TTS API did not return audio content.");
  }

  audio.src = `data:audio/mp3;base64,${data.audioContent}`;

  return new Promise((resolve, reject) => {
    audio.onended = null;
    audio.onerror = null;

    audio.onended = () => resolve();
    audio.onerror = (e) => reject(e);

    audio.play().catch(err => {
        console.error("Audio play() failed:", err);
        reject(err);
    });
  });
}

// speak, speakWordByWord, getWordExplanation 函数保持不变
async function speak(text, options = {}) {
  await _unlockAudio();
  const { isSlow = false, onStart, onEnd } = options;
  cancel();
  if (onStart) onStart();
  try {
    await _executeSpeak(text, isSlow);
  } catch (error) {
    console.error(`朗读 "${text}" 时发生错误:`, error);
    throw error;
  } finally {
    if (onEnd) onEnd();
  }
}

async function speakWordByWord(text, options = {}) {
  await _unlockAudio();
  const { onStart, onEnd } = options;
  if (!text) { if (onEnd) onEnd(); return; }
  cancel();
  if (onStart) onStart();
  const words = splitSentenceForTts(text);
  try {
    for (const word of words) {
      if (audio.paused && audio.src === '') break;
      await _executeSpeak(word, false);
      if (audio.paused && audio.src === '') break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  } catch (error) {
    console.error('逐词朗读时出错:', error);
  } finally {
    if (onEnd) onEnd();
  }
}

async function getWordExplanation(wordObject) {
    if (!wordObject || !wordObject.spanish_word) return null;
    try {
        const EXPLAIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-sentence`;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未认证");

        const response = await fetch(EXPLAIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ word: wordObject.spanish_word, getExplanation: true }),
        });

        if (!response.ok) throw new Error(`AI 服务错误 (${response.status})`);

        const explanationData = await response.json();

        if (explanationData && Object.keys(explanationData).length > 0) {
        supabase
            .from('high_frequency_words')
            .update({ ai_explanation: explanationData })
            .eq('id', wordObject.id)
            .then(({ error }) => {
            if (error) console.error('回写 AI 解释到数据库失败:', error);
            });
        }

        return explanationData;
    } catch (error) {
        console.error('获取 AI 单词解析失败:', error);
        return null;
    }
}

export { speak, speakWordByWord, cancel, getWordExplanation };
