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

// 优化后的导航守卫 - 避免认证状态未初始化时的错误跳转
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();

  // 如果认证状态还没有初始化完成，允许导航继续
  // 这样可以避免在会话检查完成前就做错误的跳转决策
  if (!userStore.isInitialized) {
    next();
    return;
  }

  const isLoggedIn = userStore.isLoggedIn;
  const isAuthPage = to.name === 'login' || to.name === 'register';

  if (isLoggedIn && isAuthPage) {
    // 已登录用户访问登录/注册页，重定向到主页
    next({ name: 'home' });
  }
  else if (to.meta.requiresAuth && !isLoggedIn) {
    // 需要认证的页面但用户未登录，重定向到登录页
    next({ name: 'login' });
  }
  else {
    // 其他情况正常导航
    next();
  }
});

export default router;
