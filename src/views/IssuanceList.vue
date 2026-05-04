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
    <el-select v-model="filters.status" placeholder="状态" clearable size="small" style="width:110px" @change="load">
      <el-option label="待审核" value="pending" /><el-option label="已审核" value="approved" />
      <el-option label="已驳回" value="rejected" /><el-option label="已发证" value="issued" />
    </el-select>
    <el-select v-model="filters.type" placeholder="类型" clearable size="small" style="width:100px" @change="load">
      <el-option label="新办" value="new" /><el-option label="换证" value="renew" /><el-option label="补办" value="reissue" />
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
    <el-button size="small" type="primary" @click="openCreate">➕ 新增申请</el-button>
  </div>
</div>

<el-table :data="list" border stripe v-loading="loading" style="width:100%">
  <el-table-column prop="name" label="姓名" width="80" />
  <el-table-column prop="gender" label="性别" width="55" />
  <el-table-column prop="id_card" label="身份证号" width="180" />
  <el-table-column prop="village_name" label="村委会" width="120" />
  <el-table-column label="残疾类别" width="100"><template #default="{row}">{{ row.category_name }}</template></el-table-column>
  <el-table-column label="等级" width="60"><template #default="{row}">{{ row.level_name }}</template></el-table-column>
  <el-table-column label="类型" width="70">
    <template #default="{row}"><el-tag size="small" :type="row.type==='new'?'primary':row.type==='renew'?'warning':'info'">{{ row.type==='new'?'新办':row.type==='renew'?'换证':'补办' }}</el-tag></template>
  </el-table-column>
  <el-table-column label="状态" width="80">
    <template #default="{row}">
      <el-tag size="small" :type="row.status==='pending'?'warning':row.status==='approved'?'success':row.status==='rejected'?'danger':'primary'">
        {{ row.status==='pending'?'待审核':row.status==='approved'?'已审核':row.status==='rejected'?'已驳回':'已发证' }}
      </el-tag>
    </template>
  </el-table-column>
  <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
  <el-table-column label="操作" min-width="220" fixed="right">
    <template #default="{row}">
      <el-button v-if="row.status==='pending'" type="success" link size="small" @click="approve(row)">审核通过</el-button>
      <el-button v-if="row.status==='pending'" type="danger" link size="small" @click="reject(row)">驳回</el-button>
      <el-button v-if="row.status==='approved'" type="primary" link size="small" @click="openIssue(row)">发证</el-button>
      <span v-if="row.status==='issued' || row.status==='rejected'" style="color:#909399;font-size:12px">--</span>
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

<!-- 新增申请弹窗 -->
<el-dialog v-model="createVisible" title="新增发证申请" width="700px" @opened="resetCreateForm">
  <el-form :model="createForm" ref="createFormRef" :rules="createRules" label-width="100px">
    <el-form-item label="身份证号" prop="id_card">
      <el-input v-model="createForm.id_card" placeholder="输入身份证号，点击查询自动填充">
        <template #append><el-button @click="lookupIdCard" :loading="lookupLoading">查询</el-button></template>
      </el-input>
    </el-form-item>
    <el-alert v-if="lookupResult" :title="lookupResult" type="info" :closable="false" style="margin-bottom:12px" />
    <el-row :gutter="12">
      <el-col :span="12"><el-form-item label="姓名" prop="name"><el-input v-model="createForm.name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="性别" prop="gender"><el-select v-model="createForm.gender"><el-option label="男" value="男" /><el-option label="女" value="女" /></el-select></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="出生日期"><el-date-picker v-model="createForm.birth_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="电话"><el-input v-model="createForm.phone" /></el-form-item></el-col>
      <el-col :span="24"><el-form-item label="地址"><el-input v-model="createForm.address" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会编码">
        <el-select v-model="createForm.village_code" filterable @change="onCreateVillageChange">
          <el-option v-for="v in villages" :key="v.code" :label="v.code" :value="v.code" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会"><el-input v-model="createForm.village_name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人"><el-input v-model="createForm.guardian" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人电话"><el-input v-model="createForm.guardian_phone" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾类别" prop="disability_category">
        <el-select v-model="createForm.disability_category"><el-option v-for="(v,k) in catMap" :key="k" :label="v" :value="+k" /></el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾等级" prop="disability_level">
        <el-select v-model="createForm.disability_level"><el-option v-for="(v,k) in lvlMap" :key="k" :label="v" :value="+k" /></el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="申请类型" prop="type">
        <el-select v-model="createForm.type"><el-option label="新办" value="new" /><el-option label="换证" value="renew" /><el-option label="补办" value="reissue" /></el-select>
      </el-form-item></el-col>
      <el-col :span="24"><el-form-item label="备注"><el-input v-model="createForm.remark" type="textarea" :rows="2" /></el-form-item></el-col>
    </el-row>
  </el-form>
  <template #footer>
    <el-button @click="createVisible=false">取消</el-button>
    <el-button type="primary" @click="submitCreate">提交</el-button>
  </template>
</el-dialog>

<!-- 发证弹窗 -->
<el-dialog v-model="issueVisible" title="发证" width="400px">
  <el-form :model="issueForm" label-width="100px">
    <el-form-item label="证号"><el-input v-model="issueForm.cert_no" placeholder="如 ZJ2025000001" /></el-form-item>
    <el-form-item label="有效期起"><el-date-picker v-model="issueForm.valid_from" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
    <el-form-item label="有效期止"><el-date-picker v-model="issueForm.valid_to" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
  </el-form>
  <template #footer>
    <el-button @click="issueVisible=false">取消</el-button>
    <el-button type="primary" @click="submitIssue">确 认 发 证</el-button>
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
const filters = reactive({ village_code:'', status:'', type:'', keyword:'' })
const catMap = { 1:'视力残疾',2:'听力残疾',3:'言语残疾',4:'肢体残疾',5:'智力残疾',6:'精神残疾',7:'多重残疾' }
const lvlMap = { 1:'一级',2:'二级',3:'三级',4:'四级' }

// 新增
const createVisible = ref(false)
const createForm = reactive({ name:'',gender:'男',id_card:'',birth_date:'',phone:'',address:'',village_code:'',village_name:'',guardian:'',guardian_phone:'',disability_category:4,disability_level:4,type:'new',remark:'' })
const createFormRef = ref(null)
const createRules = {
  name:[{required:true,message:'必填'}], id_card:[{required:true,message:'必填'}],
  gender:[{required:true}], disability_category:[{required:true}], disability_level:[{required:true}],
  type:[{required:true}],
}
const lookupLoading = ref(false)
const lookupResult = ref('')

// 发证
const issueVisible = ref(false)
const issueForm = reactive({ cert_no:'', valid_from:'', valid_to:'' })
let currentIssueId = null

function logout() { localStorage.clear(); router.push('/login') }

async function load() {
  loading.value = true
  try {
    const p = { page:pagination.page, size:pagination.size, ...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)) }
    const { data:res } = await api.issList(p)
    list.value = res.data.list; pagination.total = res.data.total; pagination.page = res.data.page
  } catch(e) {} finally { loading.value = false }
}

function resetCreateForm() {
  Object.assign(createForm, { name:'',gender:'男',id_card:'',birth_date:'',phone:'',address:'',village_code:'',village_name:'',guardian:'',guardian_phone:'',disability_category:4,disability_level:4,type:'new',remark:'' })
  lookupResult.value = ''
}

async function lookupIdCard() {
  if(!createForm.id_card) return
  lookupLoading.value = true
  try {
    const { data:res } = await api.certLookup(createForm.id_card)
    if(res.data) {
      const d=res.data
      Object.assign(createForm, {
        name:d.name, gender:d.gender, birth_date:d.birth_date, phone:d.phone||'',
        address:d.address||'', village_code:d.village_code||'', village_name:d.village_name||'',
        guardian:d.guardian||'', guardian_phone:d.guardian_phone||'',
        disability_category:d.disability_category, disability_level:d.disability_level,
        type:'renew'
      })
      lookupResult.value = `已从证书库匹配：${d.name} ${d.category_name}${d.level_name} ${d.village_name}`
    } else {
      lookupResult.value = '未在证书库中找到此人，请手动填写（将作为新办处理）'
      createForm.type = 'new'
    }
  } catch(e) {
    lookupResult.value = '查询失败'
  } finally { lookupLoading.value = false }
}

function onCreateVillageChange(code) {
  const v = villages.value.find(v=>v.code===code)
  if(v) createForm.village_name = v.name
}

async function submitCreate() {
  try {
    await api.issCreate(createForm)
    ElMessage.success('申请提交成功'); createVisible.value = false; load()
  } catch(e) { ElMessage.error(e.response?.data?.message||'提交失败') }
}

async function approve(row) {
  try {
    await ElMessageBox.confirm(`确认审核通过 ${row.name} 的申请？`, '审核通过', { type:'success' })
    await api.issApprove(row.id); ElMessage.success('已审核通过'); load()
  } catch(e) { if(e!=='cancel') ElMessage.error('操作失败') }
}

async function reject(row) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入驳回原因', '驳回', { type:'warning' })
    await api.issReject(row.id, reason); ElMessage.success('已驳回'); load()
  } catch(e) { if(e!=='cancel') ElMessage.error('操作失败') }
}

function openIssue(row) {
  currentIssueId = row.id
  const today = new Date().toISOString().slice(0,10)
  issueForm.cert_no = ''; issueForm.valid_from = today; issueForm.valid_to = ''
  issueVisible.value = true
}

async function submitIssue() {
  if(!issueForm.cert_no||!issueForm.valid_from||!issueForm.valid_to){
    return ElMessage.warning('请填写完整')
  }
  try {
    await api.issIssue(currentIssueId, issueForm)
    ElMessage.success('发证成功！'); issueVisible.value = false; load()
  } catch(e) { ElMessage.error(e.response?.data?.message||'发证失败') }
}

async function exportData() {
  try {
    const p = Object.fromEntries(Object.entries(filters).filter(([,v])=>v))
    const { data } = await api.issExport(p)
    const blob = new Blob([data], { type:'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `issuances_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  } catch(e) { ElMessage.error('导出失败') }
}

function downloadTemplate() {
  api.issTemplate().then(({data})=>{
    const blob = new Blob([data], { type:'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'issuance_template.csv'; a.click()
  })
}

async function handleImport(file) {
  try {
    const text = await file.text()
    const { data:res } = await api.issImport(text)
    ElMessage.success(res.message); load()
  } catch(e) { ElMessage.error('导入失败') }
  return false
}

onMounted(async () => {
  try { const { data:res } = await api.villages(); villages.value = res.data } catch(e) {}
  load()
})
</script>
