// src/services/speechService.js

import { supabase } from '@/supabase';
import { splitSentenceForTts } from '@/utils/textUtils';

const audio = new Audio();
let isAudioUnlocked = false;

async function _unlockAudio() {
  if (isAudioUnlocked) return;

  // --- 核心修复：直接使用全局的 audio 对象来解锁 ---
  const originalSrc = audio.src; // 保存当前可能存在的 src
  audio.src = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAAgAAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

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
  try {
    const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("用户未认证");

    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ text, isSlow }),
    });

    if (!response.ok) throw new Error(`TTS API 错误 (${response.status})`);

    const data = await response.json();
    audio.src = `data:audio/mp3;base64,${data.audioContent}`;

    await audio.play();

    await new Promise(resolve => {
      const endedListener = () => resolve();
      audio.addEventListener('ended', endedListener, { once: true });
    });

  } catch (error) {
    console.error(`朗读 "${text}" 时发生严重错误:`, error);
    throw error;
  }
}

async function speak(text, options = {}) {
  await _unlockAudio();
  const { isSlow = false, onStart, onEnd } = options;
  cancel();
  if (onStart) onStart();
  try {
    await _executeSpeak(text, isSlow);
  } catch (error) {
    // 错误已在 _executeSpeak 中打印
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
      if (audio.src === '') break;
      await _executeSpeak(word, false);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  } catch (error) {
    // 捕获错误
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
