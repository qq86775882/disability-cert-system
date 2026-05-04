<template>
  <div class="layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
      <div class="logo">{{ isCollapse ? '🏛' : '🏛 证管理系统' }}</div>
      <el-menu :default-active="activeMenu" router :collapse="isCollapse" background-color="#304156" text-color="#bfcbd9" active-text-color="#409EFF">
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis /></el-icon><span>仪表盘</span></el-menu-item>
        <el-menu-item index="/certificates"><el-icon><Collection /></el-icon><span>残疾人证管理</span></el-menu-item>
        <el-menu-item index="/issuances"><el-icon><DocumentAdd /></el-icon><span>发证管理</span></el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主区域 -->
    <div class="main-area">
      <el-header class="top-header">
        <div class="header-left">
          <el-icon :size="22" style="cursor:pointer" @click="isCollapse = !isCollapse"><Fold /></el-icon>
        </div>
        <div class="header-right">
          <span>{{ userStore.userInfo?.real_name || '管理员' }}</span>
          <el-button text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <div class="content"><router-view /></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isCollapse = ref(false)

const activeMenu = computed(() => '/' + route.path.split('/')[1])

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar { background: #304156; transition: width 0.3s; overflow-x: hidden; }
.logo { height: 60px; line-height: 60px; text-align: center; color: #fff; font-size: 18px; white-space: nowrap; }
.main-area { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; }
.top-header { height: 60px; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.header-right { display: flex; align-items: center; gap: 10px; }
.content { flex: 1; padding: 20px; overflow-y: auto; }
</style>
