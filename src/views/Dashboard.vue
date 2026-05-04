<template>
  <el-container style="min-height:100vh">
    <el-aside width="220px" style="background:#304156">
      <div style="color:#fff;text-align:center;padding:20px 0;font-size:18px">🏛 残疾人证管理</div>
      <el-menu :default-active="route.path" background-color="#304156" text-color="#bfcbd9" active-text-color="#409EFF" router>
        <el-menu-item index="/"><el-icon><DataAnalysis /></el-icon> 仪表盘</el-menu-item>
        <el-menu-item index="/certificates"><el-icon><Document /></el-icon> 残疾人证管理</el-menu-item>
        <el-menu-item index="/issuances"><el-icon><Postcard /></el-icon> 发证管理</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;display:flex;align-items:center;justify-content:flex-end;border-bottom:1px solid #e6e6e6">
        <span>{{ user?.real_name || '' }} ({{ user?.role==='admin'?'管理员':'操作员' }})</span>
        <el-button type="danger" text @click="logout" style="margin-left:12px">退出</el-button>
      </el-header>
      <el-main>

<el-row :gutter="20">
  <el-col :span="6"><el-card shadow="hover"><el-statistic title="证书总数" :value="stats.total" /></el-card></el-col>
  <el-col :span="6"><el-card shadow="hover"><el-statistic title="即将到期" :value="stats.expiring"><template #suffix><span style="color:#e6a23c">90天内</span></template></el-statistic></el-card></el-col>
  <el-col :span="6"><el-card shadow="hover"><el-statistic title="已到期" :value="stats.expired"><template #suffix><span style="color:#f56c6c">⚠</span></template></el-statistic></el-card></el-col>
  <el-col :span="6"><el-card shadow="hover"><el-statistic title="待审核发证" :value="stats.pending_issuance" /></el-card></el-col>
</el-row>

<el-row :gutter="20" style="margin-top:20px">
  <el-col :span="12">
    <el-card header="残疾类别分布"><div ref="catChart" style="height:300px"></div></el-card>
  </el-col>
  <el-col :span="12">
    <el-card header="各村委证书分布 (Top10)"><div ref="vilChart" style="height:300px"></div></el-card>
  </el-col>
</el-row>

      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'
import * as echarts from 'echarts'

const router = useRouter(), route = useRoute()
const user = ref(JSON.parse(localStorage.getItem('user')) || {})
const stats = reactive({ total:0, expiring:0, expired:0, pending_issuance:0 })
const catChart = ref(null), vilChart = ref(null)

function logout() { localStorage.clear(); router.push('/login') }

onMounted(async () => {
  try {
    const { data: res } = await api.dashboard()
    Object.assign(stats, res.data)
    await nextTick()
    if (res.data.by_category?.length) {
      const c = echarts.init(catChart.value)
      c.setOption({
        tooltip: { trigger: 'item' },
        series: [{ type:'pie', radius:['40%','70%'], data: res.data.by_category.map(x=>({name:x.category_name,value:x.count})) }]
      })
    }
    if (res.data.by_village?.length) {
      const v = echarts.init(vilChart.value)
      v.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type:'category', data: res.data.by_village.map(x=>x.name), axisLabel:{rotate:30} },
        yAxis: { type:'value' },
        series: [{ type:'bar', data: res.data.by_village.map(x=>x.count), itemStyle:{color:'#409EFF'} }],
        grid: { left:10, right:10, bottom:60, top:10, containLabel:true }
      })
    }
  } catch(e) { ElMessage.error('加载失败') }
})
</script>
