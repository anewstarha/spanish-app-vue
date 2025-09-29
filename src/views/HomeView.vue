<script setup>
import { computed } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import GreetingCard from '@/components/GreetingCard.vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useStudyStore } from '@/stores/studyStore';
import * as dataService from '@/services/dataService';

const router = useRouter();
const userStore = useUserStore();
const studyStore = useStudyStore();

// --- 快速学习逻辑 (这部分不变) ---
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
    const filtersToUse = lastFilters || {
        mastery: 'unmastered',
        studied: 'unstudied',
        tags: [],
        count: 10,
        isRandom: true
    };
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
        alert("没有符合条件的句子可供学习，请尝试在“学习”页面更改筛选条件，或在“内容管理”页面添加新句子。");
        router.push({ name: 'study' });
        return;
    }
    let source = [...filtered];
    if (filtersToUse.isRandom) {
        source.sort(() => 0.5 - Math.random());
    }
    const idsToStudy = source.slice(0, filtersToUse.count || 10).map(s => s.id);
    await studyStore.startSession(idsToStudy);
    router.push({ name: 'studySession' });
}

// --- 快速测试逻辑 ---
async function quickTest() {
    if (!userStore.profile) return;

    const unfinishedQuiz = userStore.profile.current_quiz_questions;
    if (unfinishedQuiz && unfinishedQuiz.length > 0) {
        // 【修改点】导航时，通过 state 传递 autoResume 标志
        router.push({ name: 'quiz', state: { autoResume: true } });
        return;
    }

    // 后续逻辑不变...
    const lastFilters = userStore.profile.last_quiz_filters;
    const filtersToUse = lastFilters || {
        mastery: 'unmastered',
        studied: 'studied',
        tags: [],
    };
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
        alert("没有符合条件的句子可供测试，请先进行学习。");
        router.push({ name: 'quiz' });
        return;
    }
    const testKeys = ['scramble', 'vocabulary', 'dictation', 'read_aloud', 'repeat_aloud'];
    let allPossibleQuestions = [];
    filtered.forEach(sentence => {
        testKeys.forEach(key => {
            allPossibleQuestions.push({ sentence, testKey: key });
        });
    });
    const quizQuestions = allPossibleQuestions.sort(() => 0.5 - Math.random());
    await userStore.updateUserProfile({
      current_quiz_questions: quizQuestions,
      current_quiz_progress: 0
    });
    router.push({ name: 'quiz' });
}

function manageContent() {
    router.push({ name: 'manage' });
}
</script>

<template>
  <div class="home-view-padding">
    <AppHeader />
    <GreetingCard />

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

.quick-actions {
    margin-top: 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.action-btn {
    width: 100%;
    padding: 16px;
    font-size: 18px;
}
</style>
