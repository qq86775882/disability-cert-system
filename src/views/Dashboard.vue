<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" style="margin-bottom:20px">
      <el-col :span="6"><stat-card title="总证数" :value="stats.total_certs" color="#409EFF" icon="Document" /></el-col>
      <el-col :span="6"><stat-card title="待发证" :value="stats.pending_count" color="#E6A23C" icon="Clock" /></el-col>
      <el-col :span="6"><stat-card title="临期" :value="stats.approaching_count" color="#F56C6C" icon="WarningFilled" /></el-col>
      <el-col :span="6"><stat-card title="到期" :value="stats.expired_count" color="#909399" icon="CircleCloseFilled" /></el-col>
    </el-row>

    <!-- 图表 -->
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>残疾类别分布</template>
          <div ref="categoryChart" style="height:300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>等级分布</template>
          <div ref="levelChart" style="height:300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="24">
        <el-card>
          <template #header>月度发证趋势</template>
          <div ref="trendChart" style="height:280px"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getStats } from '../api'
import StatCard from '../components/StatCard.vue'

const stats = ref({ total_certs: 0, pending_count: 0, approaching_count: 0, expired_count: 0, by_category: [], by_level: [], monthly_trend: [] })
const categoryChart = ref(null)
const levelChart = ref(null)
const trendChart = ref(null)

onMounted(async () => {
  const { data } = await getStats()
  stats.value = data

  await nextTick()
  initCharts()
})

function initCharts() {
  // 类别饼图
  const cChart = echarts.init(categoryChart.value)
  cChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: stats.value.by_category.map(c => ({ name: c.category_name, value: c.count })),
      label: { show: true, formatter: '{b}: {c}' }
    }]
  })

  // 等级柱状图
  const lChart = echarts.init(levelChart.value)
  lChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: stats.value.by_level.map(l => l.level_name) },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar', barWidth: '50%',
      data: stats.value.by_level.map(l => l.count),
      itemStyle: { color: '#409EFF', borderRadius: [4, 4, 0, 0] }
    }]
  })

  // 月度趋势
  const tChart = echarts.init(trendChart.value)
  tChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['发证', '补办'] },
    xAxis: { type: 'category', data: stats.value.monthly_trend.map(m => m.month) },
    yAxis: { type: 'value' },
    series: [
      { name: '发证', type: 'line', data: stats.value.monthly_trend.map(m => m.issue), smooth: true, color: '#409EFF' },
      { name: '补办', type: 'line', data: stats.value.monthly_trend.map(m => m.reissue), smooth: true, color: '#E6A23C' }
    ]
  })
}
</script>

<style scoped>
.dashboard { padding: 0; }
</style>
