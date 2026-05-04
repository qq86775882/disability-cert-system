<template>
  <div>
    <!-- 工具栏 -->
    <el-card style="margin-bottom:16px">
      <el-row :gutter="16" align="middle">
        <el-col :span="5"><el-input v-model="search.keyword" placeholder="搜索姓名/身份证/证号/电话" clearable @clear="fetchData" @keyup.enter="fetchData" /></el-col>
        <el-col :span="3">
          <el-select v-model="search.status" placeholder="状态" clearable @change="fetchData">
            <el-option label="待发证" value="pending" />
            <el-option label="已发证" value="issued" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-select v-model="search.category" placeholder="类别" clearable @change="fetchData">
            <el-option v-for="(v,k) in categories" :key="k" :label="v" :value="k" />
          </el-select>
        </el-col>
        <el-col :span="2">
          <el-select v-model="search.level" placeholder="等级" clearable @change="fetchData">
            <el-option v-for="(v,k) in levels" :key="k" :label="v" :value="k" />
          </el-select>
        </el-col>
        <el-col :span="4"><el-button type="primary" @click="fetchData">查询</el-button></el-col>
        <el-col :span="7" style="text-align:right">
          <el-button type="primary" @click="openCreate">新增申请</el-button>
          <el-button @click="handleExport">导出</el-button>
          <el-upload :show-file-list="false" :before-upload="handleImport" accept=".csv"><el-button>导入</el-button></el-upload>
        </el-col>
      </el-row>
    </el-card>

    <!-- 表格 -->
    <el-card>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="id_card" label="身份证号" min-width="160" />
        <el-table-column prop="disability_category_name" label="类别" width="100" />
        <el-table-column prop="disability_level_name" label="等级" width="80" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="cert_no" label="证号" min-width="180" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'warning' : 'success'">{{ row.status_name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发证日期" width="110">
          <template #default="{ row }">{{ row.issued_date?.slice(0,10) || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="success" @click="openIssue(row)">发证</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" @click="showDetail(row)">查看</el-button>
              <el-button link type="warning" @click="openReissue(row)">补办</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination style="margin-top:16px;justify-content:flex-end"
        v-model:current-page="pager.page" :page-size="pager.size" :total="pager.total"
        layout="total, prev, pager, next" @current-change="fetchData" />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑申请' : '新增申请'" width="600px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="性别" prop="gender">
            <el-radio-group v-model="form.gender"><el-radio value="男">男</el-radio><el-radio value="女">女</el-radio></el-radio-group>
          </el-form-item></el-col>
        </el-row>
        <el-form-item label="身份证号" prop="id_card"><el-input v-model="form.id_card" maxlength="18" /></el-form-item>
        <el-form-item label="出生日期"><el-date-picker v-model="form.birth_date" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="残疾类别" prop="disability_category">
            <el-select v-model="form.disability_category" style="width:100%"><el-option v-for="(v,k) in categories" :key="k" :label="v" :value="k" /></el-select>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="残疾等级" prop="disability_level">
            <el-select v-model="form.disability_level" style="width:100%"><el-option v-for="(v,k) in levels" :key="k" :label="v" :value="k" /></el-select>
          </el-form-item></el-col>
        </el-row>
        <el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="家庭住址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="监护人"><el-input v-model="form.guardian" /></el-form-item>
        <el-form-item label="监护人电话"><el-input v-model="form.guardian_phone" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 发证弹窗 -->
    <el-dialog v-model="issueVisible" title="标记已发证" width="400px">
      <el-form label-width="120px">
        <el-form-item label="有效期开始日期">
          <el-date-picker v-model="issueValidFrom" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <div style="color:#909399;font-size:13px">有效期 = 开始日期 + 10年</div>
      </el-form>
      <template #footer>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleIssue">确认发证</el-button>
      </template>
    </el-dialog>

    <!-- 补办弹窗 -->
    <el-dialog v-model="reissueVisible" title="补办残疾人证" width="400px">
      <el-form label-width="120px">
        <div style="margin-bottom:12px;color:#909399">原证号: {{ reissueRow?.cert_no }}</div>
        <el-form-item label="新证有效期开始"><el-date-picker v-model="issueValidFrom" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reissueVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleReissue">确认补办</el-button>
      </template>
    </el-dialog>

    <!-- 详情 -->
    <el-dialog v-model="detailVisible" title="发证详情" width="600px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ detail.gender }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ detail.id_card }}</el-descriptions-item>
        <el-descriptions-item label="残疾证号">{{ detail.cert_no }}</el-descriptions-item>
        <el-descriptions-item label="残疾类别">{{ detail.disability_category_name }}</el-descriptions-item>
        <el-descriptions-item label="残疾等级">{{ detail.disability_level_name }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ detail.phone }}</el-descriptions-item>
        <el-descriptions-item label="住址">{{ detail.address }}</el-descriptions-item>
        <el-descriptions-item label="发证日期">{{ detail.issued_date?.slice(0,10) }}</el-descriptions-item>
        <el-descriptions-item label="有效至"> {{ detail.valid_to?.slice(0,10) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getIssuances, getIssuanceDetail, createIssuance, updateIssuance, issueCert, reissueCert, getIssuancesExportUrl, importIssuances } from '../api'

const categories = { 1: '视力残疾', 2: '听力残疾', 3: '言语残疾', 4: '肢体残疾', 5: '智力残疾', 6: '精神残疾', 7: '多重残疾' }
const levels = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }

const loading = ref(false), submitting = ref(false)
const list = ref([])
const pager = reactive({ page: 1, size: 20, total: 0 })
const search = reactive({ keyword: '', status: '', category: '', level: '' })
const formVisible = ref(false), isEdit = ref(false), editId = ref(null)
const formRef = ref(null)
const form = reactive({ name: '', gender: '男', id_card: '', birth_date: '', disability_category: '', disability_level: '', phone: '', address: '', guardian: '', guardian_phone: '', remark: '' })
const rules = {
  name: [{ required: true, message: '请输入姓名' }],
  gender: [{ required: true }],
  id_card: [{ required: true, message: '请输入身份证号' }, { min: 18, max: 18, message: '必须18位' }],
  disability_category: [{ required: true, message: '请选择类别' }],
  disability_level: [{ required: true, message: '请选择等级' }]
}

const issueVisible = ref(false), issueRow = ref(null), issueValidFrom = ref('')
const reissueVisible = ref(false), reissueRow = ref(null)
const detailVisible = ref(false), detail = ref(null)

onMounted(() => fetchData())

async function fetchData() {
  loading.value = true
  try {
    const params = { page: pager.page, size: pager.size }
    if (search.keyword) params.keyword = search.keyword
    if (search.status && search.status !== 'all') params.status = search.status
    if (search.category) params.category = search.category
    if (search.level) params.level = search.level
    const { data } = await getIssuances(params)
    list.value = data.list; pager.total = data.total
  } finally { loading.value = false }
}

function resetForm() {
  Object.assign(form, { name: '', gender: '男', id_card: '', birth_date: '', disability_category: '', disability_level: '', phone: '', address: '', guardian: '', guardian_phone: '', remark: '' })
  isEdit.value = false; editId.value = null
}

function openCreate() { resetForm(); formVisible.value = true }
function openEdit(row) { isEdit.value = true; editId.value = row.id; Object.assign(form, row); formVisible.value = true }

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (isEdit.value) await updateIssuance(editId.value, form)
    else await createIssuance(form)
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
    formVisible.value = false
    fetchData()
  } finally { submitting.value = false }
}

function openIssue(row) { issueRow.value = row; issueValidFrom.value = ''; issueVisible.value = true }

async function handleIssue() {
  if (!issueValidFrom.value) return ElMessage.warning('请选择有效期开始日期')
  submitting.value = true
  try {
    await issueCert(issueRow.value.id, { valid_from: issueValidFrom.value })
    ElMessage.success('发证成功')
    issueVisible.value = false
    fetchData()
  } finally { submitting.value = false }
}

function openReissue(row) { reissueRow.value = row; issueValidFrom.value = ''; reissueVisible.value = true }

async function handleReissue() {
  if (!issueValidFrom.value) return ElMessage.warning('请选择新证有效期开始日期')
  submitting.value = true
  try {
    await reissueCert(reissueRow.value.id, { valid_from: issueValidFrom.value })
    ElMessage.success('补办成功')
    reissueVisible.value = false
    fetchData()
  } finally { submitting.value = false }
}

async function showDetail(row) { const { data } = await getIssuanceDetail(row.id); detail.value = data; detailVisible.value = true }

function handleExport() {
  const params = {}
  if (search.keyword) params.keyword = search.keyword
  if (search.status && search.status !== 'all') params.status = search.status
  if (search.category) params.category = search.category
  if (search.level) params.level = search.level
  window.open(getIssuancesExportUrl(params), '_blank')
}

async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  const { data } = await importIssuances(fd)
  ElMessage.success(`导入: 成功${data.success}条, 失败${data.errors.length}条`)
  fetchData(); return false
}
</script>
