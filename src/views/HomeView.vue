<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/supabase';
import AppHeader from '@/components/AppHeader.vue';
import GreetingCard from '@/components/GreetingCard.vue';
import HomeCharts from '@/components/HomeCharts.vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useStudyStore } from '@/stores/studyStore';
import * as dataService from '@/services/dataService';

const router = useRouter();
const userStore = useUserStore();
const studyStore = useStudyStore();

// 用于存储从后端获取的统计数据
const homeStats = ref(null);
const isLoadingStats = ref(true);

onMounted(async () => {
  try {
    const { data, error } = await supabase.rpc('get_home_statistics');
    if (error) throw error;
    homeStats.value = data;
  } catch (err) {
    console.error("加载首页统计失败:", err);
  } finally {
    isLoadingStats.value = false;
  }
});


// --- 下面的业务逻辑保持不变 ---
async function quickStudy() {
    if (!userStore.profile) return;
    const unfinishedStudy = userStore.profile.current_session_ids;
    if (unfinishedStudy && unfinishedStudy.length > 0) {
        const progress = userStore.profile.current_session_progress || 0;
        await studyStore.resumeSession(unfinishedStudy, progress);
        router.push({ name: 'studySession' });
        return;
    }
    const lastFilters = userStore.profile.last_study_filters;
    const filtersToUse = lastFilters || { mastery: 'unmastered', studied: 'unstudied', tags: [], count: 10, isRandom: true };
    const { sentences } = await dataService.getStudyData();
    const filtered = sentences.filter(sentence => {
        if (filtersToUse.mastery !== 'all' && (sentence.is_mastered || false) !== (filtersToUse.mastery === 'mastered')) return false;
        if (filtersToUse.studied !== 'all' && (sentence.is_studied || false) !== (filtersToUse.studied === 'studied')) return false;
        if (filtersToUse.tags && filtersToUse.tags.length > 0) {
            const sentenceTags = sentence.tags || [];
            if (!sentenceTags.some(tag => filtersToUse.tags.includes(tag))) return false;
        }
        return true;
    });
    if (filtered.length === 0) {
        alert("No hay frases que coincidan con los filtros actuales.");
        router.push({ name: 'study' });
        return;
    }
    let source = [...filtered];
    if (filtersToUse.isRandom) { source.sort(() => 0.5 - Math.random()); }
    const idsToStudy = source.slice(0, filtersToUse.count || 10).map(s => s.id);
    await studyStore.startSession(idsToStudy);
    router.push({ name: 'studySession' });
}
async function quickTest() {
    if (!userStore.profile) return;
    const unfinishedQuiz = userStore.profile.current_quiz_questions;
    if (unfinishedQuiz && unfinishedQuiz.length > 0) {
        router.push({ name: 'quiz', state: { autoResume: true } });
        return;
    }
    const lastFilters = userStore.profile.last_quiz_filters;
    const filtersToUse = lastFilters || { mastery: 'unmastered', studied: 'studied', tags: [] };
    const { sentences } = await dataService.getStudyData();
    const filtered = sentences.filter(sentence => {
        if (filtersToUse.mastery !== 'all' && (sentence.is_mastered || false) !== (filtersToUse.mastery === 'mastered')) return false;
        if (filtersToUse.studied !== 'all' && (sentence.is_studied || false) !== (filtersToUse.studied === 'studied')) return false;
        if (filtersToUse.tags && filtersToUse.tags.length > 0) {
            const sentenceTags = sentence.tags || [];
            if (!sentenceTags.some(tag => filtersToUse.tags.includes(tag))) return false;
        }
        return true;
    });
    if (filtered.length === 0) {
        alert("No hay frases disponibles para la prueba, por favor estudia primero.");
        router.push({ name: 'quiz' });
        return;
    }
    const testKeys = ['scramble', 'vocabulary', 'dictation', 'read_aloud', 'repeat_aloud'];
    let allPossibleQuestions = [];
    filtered.forEach(sentence => { testKeys.forEach(key => { allPossibleQuestions.push({ sentence, testKey: key }); }); });
    const quizQuestions = allPossibleQuestions.sort(() => 0.5 - Math.random());
    await userStore.updateUserProfile({ current_quiz_questions: quizQuestions, current_quiz_progress: 0 });
    router.push({ name: 'quiz' });
}
function manageContent() {
    router.push({ name: 'manage' });
}
</script>

<template>
  <div class="home-view-padding">
    <AppHeader />
    <GreetingCard :streak="homeStats?.streak" />

    <div v-if="isLoadingStats" class="loading-placeholder">Cargando estadísticas...</div>
    <HomeCharts v-else-if="homeStats" :progress="homeStats.progress" />

    <section class="quick-actions">
        <button @click="quickStudy" class="btn btn-primary action-btn">
            Aprendizaje Rápido
        </button>
        <button @click="quickTest" class="btn btn-primary action-btn">
            Prueba Rápida
        </button>
        <button @click="manageContent" class="btn btn-primary action-btn">
            Gestionar Contenido
        </button>
    </section>
  </div>
</template>

<style scoped>
.home-view-padding {
  padding: 0 15px;
}
.loading-placeholder {
  text-align: center;
  padding: 40px 20px;
  color: var(--secondary-text);
  background-color: #f8f9fa;
  border-radius: 12px;
  margin-top: 20px;
}
.quick-actions {
    margin-top: 30px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 20px;
}
.action-btn {
    width: 100%;
    padding: 16px;
    font-size: 18px;
}
</style>
