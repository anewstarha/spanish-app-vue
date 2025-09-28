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
      {
        path: '',
        name: 'study',
        component: StudyView,
      },
      {
        path: 'session',
        name: 'studySession',
        component: StudySessionView,
      }
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

// 简化后的导航守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();

  // 在 App.vue 的 onAuthStateChange 生效前，user 状态是 undefined
  // 如果此时就要做判断，可能会不准确。但 onAuthStateChange 速度很快
  // 我们可以等待状态明确后再做决定，或者直接先按当前状态判断
  const isLoggedIn = userStore.isLoggedIn;
  const isAuthPage = to.name === 'login' || to.name === 'register';

  if (isLoggedIn && isAuthPage) {
    next({ name: 'study' });
  }
  else if (to.meta.requiresAuth && !isLoggedIn) {
    // 增加对初始未知状态的处理：如果状态还是 undefined，先跳到登录页
    // App.vue 的监听器会在之后纠正路由（如果用户实际已登录）
    if (userStore.user === undefined) {
      next({ name: 'login' });
    } else {
      next({ name: 'login' });
    }
  }
  else {
    next();
  }
});

export default router;
