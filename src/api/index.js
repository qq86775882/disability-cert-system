import axios from 'axios'

const http = axios.create({ baseURL: '/api' })
http.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})
http.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401) { localStorage.clear(); window.location.href = '/login' }
  return Promise.reject(e)
})

export default {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  dashboard: () => http.get('/dashboard/stats'),
  villages: () => http.get('/villages'),

  // 残疾人证管理
  certList: (p) => http.get('/certificates', { params: p }),
  certGet: (id) => http.get(`/certificates/${id}`),
  certUpdate: (id, data) => http.put(`/certificates/${id}`, data),
  certLookup: (id_card) => http.get('/certificates/lookup', { params: { id_card } }),
  certExport: (p) => http.get('/certificates/export', { params: p, responseType: 'blob' }),
  certImport: (data) => http.post('/certificates/import', { data }),
  certTemplate: () => http.get('/certificates/template', { responseType: 'blob' }),

  // 发证管理
  issList: (p) => http.get('/issuances', { params: p }),
  issCreate: (data) => http.post('/issuances', data),
  issGet: (id) => http.get(`/issuances/${id}`),
  issApprove: (id) => http.post(`/issuances/${id}/approve`),
  issReject: (id, reason) => http.post(`/issuances/${id}/reject`, { reason }),
  issIssue: (id, data) => http.post(`/issuances/${id}/issue`, data),
  issExport: (p) => http.get('/issuances/export', { params: p, responseType: 'blob' }),
  issImport: (data) => http.post('/issuances/import', { data }),
  issTemplate: () => http.get('/issuances/template', { responseType: 'blob' }),
}
