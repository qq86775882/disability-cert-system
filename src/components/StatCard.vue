<template>
  <el-card shadow="hover" :style="{ borderTop: `3px solid ${color}` }">
    <div class="stat-card-body">
      <div class="stat-icon">
        <el-icon :size="32" :color="color"><component :is="icon" /></el-icon>
      </div>
      <div class="stat-info">
        <div class="stat-value">{{ value }}</div>
        <div class="stat-title">{{ title }}</div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
defineProps({
  title: String,
  value: [Number, String],
  color: { type: String, default: '#409EFF' },
  icon: { type: String, default: 'Document' }
})
</script>

<style scoped>
.stat-card-body { display: flex; align-items: center; gap: 16px; }
.stat-info { flex: 1; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-title { font-size: 14px; color: #909399; margin-top: 4px; }
</style>
