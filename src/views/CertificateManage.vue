<template>
  <div>
    <!-- 工具栏 -->
    <el-card style="margin-bottom:16px">
      <el-row :gutter="16" align="middle">
        <el-col :span="6"><el-input v-model="search.keyword" placeholder="搜索姓名/身份证/证号/电话" clearable @clear="fetchData" @keyup.enter="fetchData" /></el-col>
        <el-col :span="3">
          <el-select v-model="search.status" placeholder="状态" clearable @change="fetchData">
            <el-option label="正常" value="normal" />
            <el-option label="临期" value="approaching" />
            <el-option label="到期" value="expired" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="search.category" placeholder="残疾类别" clearable @change="fetchData">
            <el-option v-for="(v,k) in categories" :key="k" :label="v" :value="k" />
          </el-select>
        </el-col>
        <el-col :span="2">
          <el-select v-model="search.level" placeholder="等级" clearable @change="fetchData">
            <el-option v-for="(v,k) in levels" :key="k" :label="v" :value="k" />
          </el-select>
        </el-col>
        <el-col :span="4"><el-button type="primary" @click="fetchData">查询</el-button></el-col>
        <el-col :span="6" style="text-align:right">
          <el-button @click="handleExport">导出</el-button>
          <el-upload :show-file-list="false" :before-upload="handleImport" accept=".csv">
            <el-button>导入</el-button>
          </el-upload>
        </el-col>
      </el-row>
    </el-card>

    <!-- 表格 -->
    <el-card>
      <el-table :data="list" stripe v-loading="loading" style="width:100%">
        <el-table-column prop="cert_no" label="残疾证号" min-width="180" />
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="gender" label="性别" width="60" />
        <el-table-column prop="id_card" label="身份证号" min-width="160" />
        <el-table-column prop="disability_category_name" label="残疾类别" width="100" />
        <el-table-column prop="disability_level_name" label="等级" width="80" />
        <el-table-column prop="phone" label="联系方式" width="120" />
        <el-table-column label="有效期" min-width="200">
          <template #default="{ row }">
            {{ row.valid_from?.slice(0,10) }} ~ {{ row.valid_to?.slice(0,10) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.cert_status)" effect="dark">{{ row.cert_status }}</el-tag>
            <div style="font-size:12px;color:#909399">剩余{{ row.days_remaining }}天</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination style="margin-top:16px;justify-content:flex-end"
        v-model:current-page="pager.page" :page-size="pager.size" :total="pager.total"
        layout="total, prev, pager, next" @current-change="fetchData" />
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="残疾人证详情" width="600px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ detail.gender }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ detail.id_card }}</el-descriptions-item>
        <el-descriptions-item label="残疾证号">{{ detail.cert_no }}</el-descriptions-item>
        <el-descriptions-item label="残疾类别">{{ detail.disability_category_name }}</el-descriptions-item>
        <el-descriptions-item label="残疾等级">{{ detail.disability_level_name }}</el-descriptions-item>
        <el-descriptions-item label="联系方式">{{ detail.phone }}</el-descriptions-item>
        <el-descriptions-item label="家庭住址" :span="2">{{ detail.address }}</el-descriptions-item>
        <el-descriptions-item label="有效期开始">{{ detail.valid_from?.slice(0,10) }}</el-descriptions-item>
        <el-descriptions-item label="有效期结束">{{ detail.valid_to?.slice(0,10) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.cert_status)">{{ detail.cert_status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="剩余天数">{{ detail.days_remaining }}天</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCertificates, getCertificateDetail, getCertificatesExportUrl, importCertificates } from '../api'

const categories = { 1: '视力残疾', 2: '听力残疾', 3: '言语残疾', 4: '肢体残疾', 5: '智力残疾', 6: '精神残疾', 7: '多重残疾' }
const levels = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }
const loading = ref(false)
const list = ref([])
const pager = reactive({ page: 1, size: 20, total: 0 })
const search = reactive({ keyword: '', status: '', category: '', level: '' })
const detailVisible = ref(false)
const detail = ref(null)

const statusTag = s => s === '正常' ? 'success' : s === '临期' ? 'warning' : 'danger'

onMounted(() => fetchData())

async function fetchData() {
  loading.value = true
  try {
    const params = { page: pager.page, size: pager.size }
    if (search.keyword) params.keyword = search.keyword
    if (search.status) params.status = search.status
    if (search.category) params.category = search.category
    if (search.level) params.level = search.level

    const { data } = await getCertificates(params)
    list.value = data.list
    pager.total = data.total
  } finally { loading.value = false }
}

async function showDetail(row) {
  const { data } = await getCertificateDetail(row.id)
  detail.value = data
  detailVisible.value = true
}

function handleExport() {
  const params = {}
  if (search.keyword) params.keyword = search.keyword
  if (search.status) params.status = search.status
  if (search.category) params.category = search.category
  if (search.level) params.level = search.level
  window.open(getCertificatesExportUrl(params), '_blank')
}

async function handleImport(file) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await importCertificates(fd)
  ElMessage.success(`导入: 成功${data.success}条, 失败${data.errors.length}条`)
  fetchData()
  return false
}
</script>
