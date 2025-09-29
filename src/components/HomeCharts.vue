<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, ArcElement);

const props = defineProps({
  progress: {
    type: Object,
    required: true,
  }
});

const totalSentences = computed(() => {
  if (!props.progress) return 0;
  return props.progress.mastered + props.progress.studied + props.progress.unstudied;
});

const chartData = computed(() => ({
  labels: ['Dominadas', 'Estudiadas', 'Sin estudiar'], // 已掌握, 已学习, 未学习
  datasets: [{
    backgroundColor: ['#28a745', '#4A90E2', '#e9ecef'],
    data: [props.progress.mastered, props.progress.studied, props.progress.unstudied],
    borderWidth: 0,
  }],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%', // 调整甜甜圈的厚度
  plugins: {
    legend: {
      display: false, // 我们将自定义图例，所以禁用默认的
    },
    tooltip: {
      enabled: true, // 鼠标悬停时依然显示提示
    }
  },
};

const legendItems = computed(() => [
  { label: 'Dominadas', value: props.progress.mastered, color: '#28a745' },
  { label: 'Estudiadas', value: props.progress.studied, color: '#4A90E2' },
  { label: 'Sin estudiar', value: props.progress.unstudied, color: '#e9ecef' },
]);
</script>

<template>
  <section class="stats-container">
    <div class="chart-card">
      <h4 class="card-title">Resumen de Estudio</h4>
      <div class="card-content">
        <div class="chart-wrapper">
          <Doughnut :data="chartData" :options="chartOptions" />
          <div class="chart-center-text">
            <span class="total-number">{{ totalSentences }}</span>
            <span class="total-label">Frases</span>
          </div>
        </div>
        <div class="legend-wrapper">
          <div v-for="item in legendItems" :key="item.label" class="legend-item">
            <span class="legend-color-dot" :style="{ backgroundColor: item.color }"></span>
            <span class="legend-label">{{ item.label }}</span>
            <span class="legend-value">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chart-card {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.card-title {
  margin: 0 0 20px 0;
  text-align: left;
  color: var(--primary-text);
  font-size: 18px;
  font-weight: 600;
}
.card-content {
  display: flex;
  align-items: center;
  gap: 20px;
}
.chart-wrapper {
  position: relative;
  width: 130px; /* 固定图表区域宽度 */
  height: 130px;
  flex-shrink: 0;
}
.chart-center-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}
.total-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-text);
}
.total-label {
  display: block;
  font-size: 12px;
  color: var(--secondary-text);
}
.legend-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  font-size: 14px;
}
.legend-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
}
.legend-label {
  color: var(--secondary-text);
}
.legend-value {
  margin-left: auto; /* 将数字推到最右边 */
  font-weight: 600;
  color: var(--primary-text);
}
</style>
