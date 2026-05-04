<template>
  <el-container style="min-height:100vh">
    <el-aside width="220px" style="background:#304156">
      <div style="color:#fff;text-align:center;padding:20px 0;font-size:18px">🏛 残疾人证管理</div>
      <el-menu :default-active="'/certificates'" background-color="#304156" text-color="#bfcbd9" active-text-color="#409EFF" router>
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

<el-page-header @back="router.back()" title="返回">
  <template #content><span style="font-size:18px">证书详情 - {{ cert.name }}</span></template>
</el-page-header>

<el-descriptions :column="3" border style="margin-top:20px" v-loading="loading">
  <el-descriptions-item label="证号">{{ cert.cert_no }}</el-descriptions-item>
  <el-descriptions-item label="姓名">{{ cert.name }}</el-descriptions-item>
  <el-descriptions-item label="性别">{{ cert.gender }}</el-descriptions-item>
  <el-descriptions-item label="身份证号">{{ cert.id_card }}</el-descriptions-item>
  <el-descriptions-item label="出生日期">{{ cert.birth_date }}</el-descriptions-item>
  <el-descriptions-item label="电话">{{ cert.phone || '-' }}</el-descriptions-item>
  <el-descriptions-item label="地址" :span="2">{{ cert.address || '-' }}</el-descriptions-item>
  <el-descriptions-item label="村委会编码">{{ cert.village_code || '-' }}</el-descriptions-item>
  <el-descriptions-item label="村委会">{{ cert.village_name || '-' }}</el-descriptions-item>
  <el-descriptions-item label="监护人">{{ cert.guardian || '-' }}</el-descriptions-item>
  <el-descriptions-item label="监护人电话">{{ cert.guardian_phone || '-' }}</el-descriptions-item>
  <el-descriptions-item label="残疾类别">{{ cert.category_name }}</el-descriptions-item>
  <el-descriptions-item label="残疾等级">{{ cert.level_name }}</el-descriptions-item>
  <el-descriptions-item label="状态">
    <el-tag :type="cert.status==='expired'?'danger':cert.status==='expiring'||cert.days_left<=90?'warning':'success'">
      {{ cert.status==='expired'?'到期':cert.status==='expiring'||cert.days_left<=90?'临期('+cert.days_left+'天)':'正常' }}
    </el-tag>
  </el-descriptions-item>
  <el-descriptions-item label="有效期起">{{ cert.valid_from || '-' }}</el-descriptions-item>
  <el-descriptions-item label="有效期止">{{ cert.valid_to || '-' }}</el-descriptions-item>
  <el-descriptions-item label="版本">V{{ cert.version || 1 }}</el-descriptions-item>
  <el-descriptions-item label="备注" :span="3">{{ cert.remark || '-' }}</el-descriptions-item>
</el-descriptions>

<div style="margin-top:20px">
  <el-button type="primary" @click="editVisible=true">✏️ 编辑</el-button>
</div>

<el-divider />

<h4>📋 操作时间线</h4>
<el-timeline v-if="timeline.length" style="margin-top:16px">
  <el-timeline-item v-for="(item,idx) in timeline" :key="idx" :timestamp="item.time" placement="top">
    {{ item.action }} — {{ item.operator }}
    <span v-if="item.reason" style="color:#f56c6c">（原因：{{ item.reason }}）</span>
  </el-timeline-item>
</el-timeline>
<el-empty v-else description="暂无操作记录" />

      </el-main>
    </el-container>
  </el-container>

<!-- 编辑弹窗 -->
<el-dialog v-model="editVisible" title="编辑证书信息" width="700px">
  <el-form :model="editForm" label-width="100px">
    <el-row :gutter="12">
      <el-col :span="12"><el-form-item label="证号"><el-input v-model="editForm.cert_no" disabled /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="姓名"><el-input v-model="editForm.name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="性别"><el-select v-model="editForm.gender"><el-option label="男" value="男" /><el-option label="女" value="女" /></el-select></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="身份证号"><el-input v-model="editForm.id_card" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="出生日期"><el-date-picker v-model="editForm.birth_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="电话"><el-input v-model="editForm.phone" /></el-form-item></el-col>
      <el-col :span="24"><el-form-item label="地址"><el-input v-model="editForm.address" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会编码">
        <el-select v-model="editForm.village_code" filterable @change="onVilChange">
          <el-option v-for="v in villages" :key="v.code" :label="v.code" :value="v.code" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="村委会"><el-input v-model="editForm.village_name" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人"><el-input v-model="editForm.guardian" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="监护人电话"><el-input v-model="editForm.guardian_phone" /></el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾类别">
        <el-select v-model="editForm.disability_category">
          <el-option v-for="(v,k) in catMap" :key="k" :label="v" :value="+k" />
        </el-select>
      </el-form-item></el-col>
      <el-col :span="12"><el-form-item label="残疾等级">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'

const router = useRouter(), route = useRoute()
const user = ref(JSON.parse(localStorage.getItem('user'))||{})
const loading = ref(false)
const cert = reactive({})
const villages = ref([])
const editVisible = ref(false)
const editForm = reactive({})
const catMap = { 1:'视力残疾',2:'听力残疾',3:'言语残疾',4:'肢体残疾',5:'智力残疾',6:'精神残疾',7:'多重残疾' }
const lvlMap = { 1:'一级',2:'二级',3:'三级',4:'四级' }
const timeline = computed(() => {
  try { return typeof cert.timeline==='string'?JSON.parse(cert.timeline):(cert.timeline||[]) }
  catch { return [] }
})

function logout() { localStorage.clear(); router.push('/login') }
function onVilChange(code) { const v=villages.value.find(v=>v.code===code); if(v) editForm.village_name=v.name }

async function load() {
  loading.value=true
  try {
    const {data:res}=await api.certGet(route.params.id)
    Object.assign(cert,res.data)
  }catch(e){ElMessage.error('加载失败')}
  finally{loading.value=false}
}

async function saveEdit() {
  try {
    await api.certUpdate(cert.id, editForm)
    ElMessage.success('保存成功'); editVisible.value=false; load()
  }catch(e){ElMessage.error(e.response?.data?.message||'保存失败')}
}

onMounted(async () => {
  try { const {data:res}=await api.villages(); villages.value=res.data } catch(e) {}
  load()
})
</script>
