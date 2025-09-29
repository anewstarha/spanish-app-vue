import { ref, onMounted, onUnmounted } from 'vue';

const canInstall = ref(false);
let deferredPrompt = null;

const beforeInstallPromptHandler = (e) => {
  // 阻止浏览器默认的安装提示
  e.preventDefault();
  // 保存事件，以便之后触发
  deferredPrompt = e;
  // 显示我们自己的安装按钮
  canInstall.value = true;
};

export function usePWAInstall() {
  onMounted(() => {
    window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
  });

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
  });

  const promptInstall = () => {
    if (!deferredPrompt) return;

    // 显示浏览器原生的安装弹窗
    deferredPrompt.prompt();

    // 等待用户响应
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('用户接受了安装');
      } else {
        console.log('用户拒绝了安装');
      }
      // 清理
      deferredPrompt = null;
      canInstall.value = false;
    });
  };

  return { canInstall, promptInstall };
}
