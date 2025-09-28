<script setup>
import { ref } from 'vue';
import { supabase } from '@/supabase'; // 确保您的 supabase 客户端路径正确

// --- 响应式状态定义 ---
const statusMessage = ref('空闲 (Idle)');
const logOutput = ref('');
const transcribedText = ref('');
const errorMessage = ref('');

const isRecording = ref(false);
const isProcessing = ref(false);

// --- 运行时变量 ---
let mediaRecorder = null;
let audioChunks = [];

// --- 核心功能函数 ---

/**
 * 日志记录函数，带时间戳
 * @param {string} message - 要记录的消息
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  logOutput.value += `[${timestamp}] ${message}\n`;
  // 自动滚动到底部
  const logEl = document.getElementById('log-output');
  if (logEl) {
    logEl.scrollTop = logEl.scrollHeight;
  }
}

/**
 * 清理状态，准备开始新的一次测试
 */
function resetState() {
  logOutput.value = '';
  transcribedText.value = '';
  errorMessage.value = '';
  audioChunks = [];
  log('状态已重置。');
}

/**
 * 开始录音
 */
async function startRecording() {
  resetState();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const errorMsg = '错误：您的浏览器不支持麦克风功能。';
    log(errorMsg);
    errorMessage.value = errorMsg;
    statusMessage.value = '失败';
    return;
  }

  try {
    log('1. 请求麦克风权限...');
    statusMessage.value = '请求权限...';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    log('2. 麦克风权限已获取。');

    isRecording.value = true;
    statusMessage.value = '正在录音...';

    const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
    mediaRecorder = new MediaRecorder(stream, options);
    log(`3. MediaRecorder 已初始化，配置: ${JSON.stringify(options)}`);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
      log(`   - 捕获到音频数据块，大小: ${event.data.size} bytes`);
    };

    mediaRecorder.onstop = async () => {
      log('6. 录音已停止，开始处理音频数据...');
      isProcessing.value = true;
      statusMessage.value = '正在处理...';

      const audioBlob = new Blob(audioChunks, { type: options.mimeType });
      log(`7. 音频数据块已合并为 Blob，总大小: ${audioBlob.size} bytes, 类型: ${audioBlob.type}`);

      if (audioBlob.size === 0) {
        const errorMsg = '错误：录音文件大小为0，请检查麦克风是否正常工作。';
        log(errorMsg);
        errorMessage.value = errorMsg;
        statusMessage.value = '失败';
        isProcessing.value = false;
        return;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      log('8. 已创建 FormData 并附加音频 Blob。');

      try {
        log('9. 准备发送请求到后端 Supabase Function...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("用户未认证，无法获取 session token。");
        }
        log('   - 成功获取用户 session。');

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`;
        log(`   - 请求目标 URL: ${url}`);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          body: formData,
        });

        log(`10. 收到后端响应，HTTP 状态码: ${response.status}`);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`服务器错误 (${response.status}): ${errorBody}`);
        }

        const result = await response.json();
        log('11. 成功解析后端返回的 JSON 数据:');
        log(JSON.stringify(result, null, 2)); // 打印完整的返回结果

        if (result.RecognitionStatus === 'Success') {
          transcribedText.value = result.DisplayText;
          statusMessage.value = '成功！';
          log('12. 语音识别成功！');
        } else {
          throw new Error(`语音识别失败，状态: ${result.RecognitionStatus}, 原因: ${result.Reason || '未知'}`);
        }
      } catch (error) {
        log(`--- 捕获到错误 --- \n${error.message}`);
        errorMessage.value = error.message;
        statusMessage.value = '失败';
      } finally {
        isProcessing.value = false;
        stream.getTracks().forEach(track => track.stop());
        log('13. 媒体流已关闭。测试流程结束。');
      }
    };

    mediaRecorder.start();
    log('4. 录音已开始。');

  } catch (err) {
    const errorMsg = `在获取麦克风权限时发生错误: ${err.message}`;
    log(errorMsg);
    errorMessage.value = errorMsg;
    statusMessage.value = '失败';
    isRecording.value = false;
  }
}

/**
 * 停止录音
 */
function stopRecording() {
  log('5. 用户点击停止录音。');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isRecording.value = false;
}

</script>

<template>
  <div class="tester-container">
    <h1>语音转文字功能调试器</h1>

    <div class="controls">
      <button @click="startRecording" :disabled="isRecording || isProcessing">
        开始录音
      </button>
      <button @click="stopRecording" :disabled="!isRecording || isProcessing">
        停止录音
      </button>
    </div>

    <div class="status-panel">
      <h2>当前状态: <span :class="`status-${statusMessage.split(' ')[0]}`">{{ statusMessage }}</span></h2>
      <div v-if="isProcessing" class="spinner"></div>
    </div>

    <div class="result-panel">
      <h2>识别结果:</h2>
      <p class="transcribed-text">{{ transcribedText || '...' }}</p>
    </div>

    <div v-if="errorMessage" class="error-panel">
      <h2>错误信息:</h2>
      <p class="error-text">{{ errorMessage }}</p>
    </div>

    <div class="log-panel">
      <h2>执行日志:</h2>
      <pre id="log-output" class="log-output">{{ logOutput }}</pre>
    </div>
  </div>
</template>

<style scoped>
.tester-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  max-width: 800px;
  margin: 2rem auto;
  padding: 1rem 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}
h1, h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
}
.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.controls button {
  font-size: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}
.controls button:hover:not(:disabled) {
  background-color: #0056b3;
}
.controls button:disabled {
  background-color: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}
.status-panel {
  padding: 1rem;
  background-color: #e9ecef;
  border-radius: 5px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.status-panel h2 {
  border: none;
  margin: 0;
}
.status-成功！ { color: #28a745; }
.status-失败 { color: #dc3545; }
.status-正在录音... { color: #fd7e14; }
.status-正在处理... { color: #17a2b8; }

.result-panel .transcribed-text {
  font-size: 1.2rem;
  font-style: italic;
  color: #333;
}
.error-panel {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 1rem;
  border-radius: 5px;
  margin-top: 1rem;
}
.error-text {
  white-space: pre-wrap;
  word-break: break-all;
}
.log-panel {
  margin-top: 1.5rem;
}
.log-output {
  background-color: #333;
  color: #0f0;
  font-family: 'Courier New', Courier, monospace;
  padding: 1rem;
  border-radius: 5px;
  height: 300px;
  overflow-y: scroll;
  white-space: pre-wrap;
  word-break: break-word;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top-color: #17a2b8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
