<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header><h2 style="text-align:center;margin:0">🏛 残疾人证管理系统</h2></template>
      <el-form :model="form" ref="formRef" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="handleLogin" style="width:100%">登 录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
const router = useRouter()
const form = reactive({ username: 'admin', password: 'admin123' })
const loading = ref(false)
const rules = { username: [{ required: true, message: '请输入用户名' }], password: [{ required: true, message: '请输入密码' }] }
async function handleLogin() {
  loading.value = true
  try {
    const { data: res } = await api.login(form)
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    router.push('/')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '登录失败')
  } finally { loading.value = false }
}
</script>

<style scoped>
.login-container { display:flex; justify-content:center; align-items:center; min-height:100vh; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); }
.login-card { width:420px; }
</style>
