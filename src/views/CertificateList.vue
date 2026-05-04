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
        <span>{{ user?.real_name }} ({{ user?.role==='admin'?'管理员':'操作员' }})</span>
        <el-button type="danger" text @click="logout" style="margin-left:12px">退出</el-button>
      </el-header>
      <el-main>

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
    <el-select v-model="filters.village_code" placeholder="村委会" clearable size="small" style="width:180px" @change="load">
      <el-option v-for="v in villages" :key="v.code" :label="`${v.code} ${v.name}`" :value="v.code" />
    </el-select>
    <el-select v-model="filters.category" placeholder="残疾类别" clearable size="small" style="width:140px" @change="load">
      <el-option label="视力残疾" :value="1" /><el-option label="听力残疾" :value="2" />
      <el-option label="言语残疾" :value="3" /><el-option label="肢体残疾" :value="4" />
      <el-option label="智力残疾" :value="5" /><el-option label="精神残疾" :value="6" />
      <el-option label="多重残疾" :value="7" />
    </el-select>
    <el-select v-model="filters.status" placeholder="状态" clearable size="small" style="width:120px" @change="load">
      <el-option label="正常" value="normal" /><el-option label="临期" value="expiring" /><el-option label="到期" value="expired" />
    </el-select>
    <el-input v-model="filters.keyword" placeholder="搜索姓名/身份证/证号" clearable size="small" style="width:220px" @clear="load" @keyup.enter="load" />
    <el-button type="primary" size="small" @click="load">查询</el-button>
  </div>
  <div style="display:flex;gap:8px">
    <el-button size="small" @click="downloadTemplate">📥 下载模板</el-button>
    <el-button size="small" type="success" @click="exportData">📤 导出</el-button>
    <el-upload :show-file-list="false" :before-upload="handleImport" accept=".csv" style="display:inline">
      <el-button size="small" type="warning">📥 导入CSV</el-button>
    </el-upload>
  </div>
</div>

<el-table :data="list" border stripe v-loading="loading" style="width:100%" @row-click="rowClick" highlight-current-row>
  <el-table-column prop="cert_no" label="证号" width="140" />
  <el-table-column prop="name" label="姓名" width="80" />
  <el-table-column prop="gender" label="性别" width="55" />
  <el-table-column prop="id_card" label="身份证号" width="180" />
  <el-table-column prop="village_name" label="村委会" width="120" />
  <el-table-column label="残疾类别" width="100">
    <template #default="{row}">{{ row.category_name }}</template>
  </el-table-column>
  <el-table-column label="等级" width="60">
    <template #default="{row}">{{ row.level_name }}</template>
  </el-table-column>
  <el-table-column label="状态" width="80">
    <template #default="{row}">
      <el-tag :type="row.display_status==='expired'?'danger':row.display_status==='expiring'?'warning':'success'" size="small">
        {{ row.display_status==='expired'?'到期':row.display_status==='expiring'?'临期':'正常' }}
      </el-tag>
    </template>
  </el-table-column>
  <el-table-column prop="valid_from" label="有效期起" width="110" />
  <el-table-column label="有效期" width="110">
    <template #default="{row}">{{ row.valid_to }}
      <span v-if="row.days_left!=null && row.days_left<=90" style="color:#f56c6c">({{row.days_left}}天)</span>
    </template>
  </el-table-column>
  <el-table-column label="操作" width="80" fixed="right">
    <template #default="{row}">
      <el-button type="primary" link size="small" @click.stop="editCert(row)">编辑</el-button>
    </template>
  </el-table-column>
</el-table>

<div style="margin-top:16px;text-align:right">
  <el-pagination v-model:current-page="pagination.page" :page-size="pagination.size" :total="pagination.total"
    layout="total,prev,pager,next" @current-change="load" background />
</div>

      </el-main>
    </el-container>
  </el-container>

<!-- 编辑弹窗 -->
<el-dialog v-model="editVisible" title="编辑证书信息" width="700px" @close="editVisible=false">
  <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="100px">
    <el-row :gutter="12">
      <el-col :span="12"><el-form-item label="证号" prop="cert_no"><el-input v-model="editForm.cert_no" disabled /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="姓名" prop="name"><el-input v-model="editForm.name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="性别" prop="gender"><el-select v-model="editForm.gender"><el-option label="男" value="男" /><el-option label="女" value="女" /></el-select></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="身份证号" prop="id_card"><el-input v-model="editForm.id_card" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="出生日期"><el-date-picker v-model="editForm.birth_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="电话"><el-input v-model="editForm.phone" /></el-form-item></el-col>
      <el-col :span="24"><el-form-item label="地址"><el-input v-model="editForm.address" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会编码">
        <el-select v-model="editForm.village_code" filterable @change="onVillageChange">
          <el-option v-for="v in villages" :key="v.code" :label="v.code" :value="v.code" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会"><el-input v-model="editForm.village_name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人"><el-input v-model="editForm.guardian" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人电话"><el-input v-model="editForm.guardian_phone" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾类别" prop="disability_category">
        <el-select v-model="editForm.disability_category">
          <el-option v-for="(v,k) in catMap" :key="k" :label="v" :value="+k" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾等级" prop="disability_level">
        <el-select v-model="editForm.disability_level">
          <el-option v-for="(v,k) in lvlMap" :key="k" :label="v" :value="+k" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="有效期起"><el-date-picker v-model="editForm.valid_from" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="有效期止"><el-date-picker v-model="editForm.valid_to" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
      <el-col :span="24"><el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" :rows="2" /></el-form-item></el-col>
    </el-row>
  </el-form>
  <template #footer>
    <el-button @click="editVisible=false">取消</el-button>
    <el-button type="primary" @click="saveEdit">保存</el-button>
  </template>
</el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'

const router = useRouter(), route = useRoute()
const user = ref(JSON.parse(localStorage.getItem('user'))||{})
const loading = ref(false)
const list = ref([])
const villages = ref([])
const pagination = reactive({ page:1, size:20, total:0 })
const filters = reactive({ village_code:'', category:'', status:'', keyword:'' })
const catMap = { 1:'视力残疾',2:'听力残疾',3:'言语残疾',4:'肢体残疾',5:'智力残疾',6:'精神残疾',7:'多重残疾' }
const lvlMap = { 1:'一级',2:'二级',3:'三级',4:'四级' }

const editVisible = ref(false)
const editForm = reactive({})
const editFormRef = ref(null)
const editRules = {
  name:[{required:true,message:'必填'}],
  gender:[{required:true,message:'必填'}],
  id_card:[{required:true,message:'必填'}],
  disability_category:[{required:true,message:'必填'}],
  disability_level:[{required:true,message:'必填'}],
}

function logout() { localStorage.clear(); router.push('/login') }

async function load() {
  loading.value = true
  try {
    const p = { page:pagination.page, size:pagination.size, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) }
    const { data:res } = await api.certList(p)
    list.value = res.data.list; pagination.total = res.data.total; pagination.page = res.data.page
  } catch(e) {} finally { loading.value = false }
}

function rowClick(row) { router.push(`/certificates/${row.id}`) }
function editCert(row) {
  Object.assign(editForm, { ...row }); editVisible.value = true
}
function onVillageChange(code) {
  const v = villages.value.find(v=>v.code===code)
  if(v) editForm.village_name = v.name
}
async function saveEdit() {
  try {
    await api.certUpdate(editForm.id, editForm)
    ElMessage.success('保存成功'); editVisible.value = false; load()
  } catch(e) { ElMessage.error(e.response?.data?.message||'保存失败') }
}

async function exportData() {
  try {
    const p = Object.fromEntries(Object.entries(filters).filter(([,v])=>v))
    const { data } = await api.certExport(p)
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `certificates_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  } catch(e) { ElMessage.error('导出失败') }
}
function downloadTemplate() {
  api.certTemplate().then(({data})=>{
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'certificate_template.csv'; a.click()
  })
}
async function handleImport(file) {
  try {
    const text = await file.text()
    const { data:res } = await api.certImport(text)
    ElMessage.success(res.message); load()
  } catch(e) { ElMessage.error('导入失败') }
  return false
}

onMounted(async () => {
  try { const { data:res } = await api.villages(); villages.value = res.data } catch(e) {}
  load()
})
</script>
