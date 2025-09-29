// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

// 导入所有视图组件
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import QuizView from '../views/QuizView.vue'
import ManageView from '../views/ManageView.vue'
import StudyLayout from '../views/StudyLayout.vue'
import StudyView from '../views/StudyView.vue'
import StudySessionView from '../views/StudySessionView.vue'

const routes = [
  {
    path: '/study',
    component: StudyLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'study', component: StudyView },
      { path: 'session', name: 'studySession', component: StudySessionView }
    ]
  },
  { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
  { path: '/quiz', name: 'quiz', component: QuizView, meta: { requiresAuth: true } },
  { path: '/manage', name: 'manage', component: ManageView, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// --- 最终版的智能导航守卫 ---
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();

  // 1. 如果认证状态还未就绪，就等待
  if (!userStore.authReady) {
    await userStore.waitForAuth();
  }

  // 2. 在获取到准确状态后，再进行判断
  const isLoggedIn = userStore.isLoggedIn;
  const requiresAuth = to.meta.requiresAuth;
  const isAuthPage = to.name === 'login' || to.name === 'register';

  if (requiresAuth && !isLoggedIn) {
    next({ name: 'login' });
  } else if (isAuthPage && isLoggedIn) {
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router;
