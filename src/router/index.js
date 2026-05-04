import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { noAuth: true } },
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
  { path: '/certificates', name: 'Certificates', component: () => import('../views/CertificateList.vue') },
  { path: '/certificates/:id', name: 'CertificateDetail', component: () => import('../views/CertificateDetail.vue') },
  { path: '/issuances', name: 'Issuances', component: () => import('../views/IssuanceList.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (!to.meta.noAuth && !token) return next('/login')
  if (to.path === '/login' && token) return next('/')
  next()
})

export default router
