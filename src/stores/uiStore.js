// src/stores/uiStore.js

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  // 默认情况下，导航栏是可见的
  const isNavVisible = ref(true);

  function setNavVisibility(isVisible) {
    isNavVisible.value = isVisible;
  }

  return { isNavVisible, setNavVisibility };
});
