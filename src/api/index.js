import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    }
    const msg = err.response?.data?.message || err.message || '请求失败'
    ElMessage.error(msg)
    return Promise.reject(err)
  }
)

// --- Auth ---
export const login = data => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')

// --- Dashboard ---
export const getStats = () => api.get('/dashboard/stats')

// --- Issuances ---
export const getIssuances = params => api.get('/issuances', { params })
export const getIssuanceDetail = id => api.get(`/issuances/${id}`)
export const createIssuance = data => api.post('/issuances', data)
export const updateIssuance = (id, data) => api.put(`/issuances/${id}`, data)
export const issueCert = (id, data) => api.post(`/issuances/${id}/issue`, data)
export const reissueCert = (id, data) => api.post(`/issuances/${id}/reissue`, data)

// --- Certificates ---
export const getCertificates = params => api.get('/certificates', { params })
export const getCertificateDetail = id => api.get(`/certificates/${id}`)
export const updateCertificate = (id, data) => api.put(`/certificates/${id}`, data)
export const getAlerts = () => api.get('/certificates/alerts')

// --- Export / Import URLs ---
export const getIssuancesExportUrl = params => {
  const p = new URLSearchParams(params).toString()
  return `/api/issuances/export?${p}`
}
export const getCertificatesExportUrl = params => {
  const p = new URLSearchParams(params).toString()
  return `/api/certificates/export?${p}`
}
export const importIssuances = formData => api.post('/issuances/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const importCertificates = formData => api.post('/certificates/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
