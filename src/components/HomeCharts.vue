<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/supabase';
import { Bar, Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement);

const isLoading = ref(true);
const progressData = ref(null);
const weeklyData = ref(null);
const error = ref(null);

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
  },
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        precision: 0,
      },
    },
  },
};

onMounted(async () => {
  try {
    const { data, error: rpcError } = await supabase.rpc('get_home_statistics');
    if (rpcError) throw rpcError;

    if (!data) throw new Error("未能从数据库获取统计数据。");

    // 为甜甜圈图准备数据
    progressData.value = {
      labels: ['已掌握', '已学习', '未学习'],
      datasets: [{
        backgroundColor: ['#28a745', '#4A90E2', '#e9ecef'],
        data: [data.progress.mastered, data.progress.studied, data.progress.unstudied],
      }],
    };

    // 为条形图准备数据
    const labels = data.weekly_activity.map((d, i) => {
        if (i === 6) return '今天';
        const date = new Date(d.date);
        // 使用 toLocaleDateString 获取本地化的星期几，更通用
        return date.toLocaleDateString('zh-CN', { weekday: 'short' });
    });
    weeklyData.value = {
      labels: labels,
      datasets: [{
        label: '完成句子数',
        backgroundColor: '#4A90E2',
        data: data.weekly_activity.map(d => d.count),
        borderRadius: 5,
      }],
    };

  } catch (err) {
    error.value = `加载统计数据失败: ${err.message}`;
    console.error(error.value);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="stats-container">
    <div v-if="isLoading" class="loading-indicator">正在加载统计数据...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else class="charts-grid">
      <div class="chart-card">
        <h4>学习总览</h4>
        <div class="chart-wrapper">
          <Doughnut v-if="progressData" :data="progressData" :options="doughnutChartOptions" />
        </div>
      </div>
      <div class="chart-card">
        <h4>最近7日活动</h4>
        <div class="chart-wrapper">
          <Bar v-if="weeklyData" :data="weeklyData" :options="barChartOptions" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-container {
  margin-top: 30px;
  margin-bottom: 20px;
}
.charts-grid {
  display: grid;
  grid-template-columns: 1fr; /* 移动端默认单列 */
  gap: 20px;
}
/* 在屏幕宽度大于等于 640px 时，变为两列布局 */
@media (min-width: 640px) {
    .charts-grid {
        grid-template-columns: 1fr 1fr;
    }
}
.chart-card {
  background-color: #ffffff;
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 4px B2px rgba(0,0,0,0.08);
}
.chart-card h4 {
  margin: 0 0 16px 0;
  text-align: center;
  color: var(--primary-text);
  font-size: 16px;
  font-weight: 600;
}
.chart-wrapper {
  height: 220px; /* 固定图表高度 */
}
.loading-indicator, .error-message {
  text-align: center;
  padding: 40px 20px;
  color: var(--secondary-text);
  background-color: #f8f9fa;
  border-radius: 12px;
}
.error-message {
    color: #dc3545;
}
</style>
