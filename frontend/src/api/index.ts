import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

export const getStoredServerUrl = (): string => {
  const custom = localStorage.getItem('cloudgst_server_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'https://pos-1156.onrender.com';
};

export const getApiBaseUrl = (): string => {
  const host = getStoredServerUrl();
  return host ? `${host}/api/v1` : '/api/v1';
};

export const resolveMediaUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  const host = getStoredServerUrl();
  return host ? `${host}${clean}` : clean;
};

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Create Axios instance
const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT + Company ID + dynamic cloud host
api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = localStorage.getItem('accessToken');
  const companyId = localStorage.getItem('currentCompanyId');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (companyId) {
    config.headers['X-Company-Id'] = companyId;
  }

  return config;
});

// Response interceptor — auto-refresh JWT on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        // No refresh token — redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${getApiBaseUrl()}/auth/refresh`, { refreshToken });
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        onRefreshed(newAccessToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Helper to extract error message
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

// ─── API Functions ────────────────────────────────────────────────

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  logoutAll: () => api.post('/auth/logout-all').then((r) => r.data),
  getMe: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data).then((r) => r.data),
  getSessions: () => api.get('/auth/sessions').then((r) => r.data),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`).then((r) => r.data),
  updateProfile: (data: any) => api.put('/auth/profile', data).then((r) => r.data),
};

// Companies
export const companyApi = {
  list: () => api.get('/companies').then((r) => r.data),
  create: (data: any) => api.post('/companies', data).then((r) => r.data),
  get: (id: string) => api.get(`/companies/${id}`).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/companies/${id}`, data).then((r) => r.data),
  getStats: () => api.get(`/companies/stats`).then((r) => r.data),
  getSettings: () => api.get('/settings').then((r) => r.data),
  updateSettings: (data: any) => api.put('/settings', data).then((r) => r.data),
};

// Dashboard
export const dashboardApi = {
  getSummary: (params?: { period?: string; startDate?: string; endDate?: string }) =>
    api.get('/dashboard/summary', { params }).then((r) => r.data),
};

// Products
export const productApi = {
  list: (params?: any) => api.get('/products', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/products/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/products', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
  searchByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`).then((r) => r.data),
  stockAdjust: (data: any) => api.post('/products/stock-adjust', data).then((r) => r.data),
  stockMovements: (params?: any) => api.get('/products/stock-movements', { params }).then((r) => r.data),
};

// Categories
export const categoryApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (data: any) => api.post('/categories', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
  brands: { list: () => api.get('/categories/brands').then((r) => r.data), create: (data: any) => api.post('/categories/brands', data).then((r) => r.data) },
  units: { list: () => api.get('/categories/units').then((r) => r.data), create: (data: any) => api.post('/categories/units', data).then((r) => r.data) },
};

// Customers
export const customerApi = {
  list: (params?: any) => api.get('/customers', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/customers/${id}`).then((r) => r.data),
  getLedger: (id: string, params?: any) => api.get(`/customers/${id}/ledger`, { params }).then((r) => r.data),
  create: (data: any) => api.post('/customers', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/customers/${id}`).then((r) => r.data),
};

// Suppliers
export const supplierApi = {
  list: (params?: any) => api.get('/suppliers', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/suppliers/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/suppliers', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/suppliers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/suppliers/${id}`).then((r) => r.data),
};

// Invoices
export const invoiceApi = {
  list: (params?: any) => api.get('/invoices', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/invoices/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/invoices', data).then((r) => r.data),
  cancel: (id: string, reason?: string) => api.post(`/invoices/${id}/cancel`, { reason }).then((r) => r.data),
};

// Quotations
export const quotationApi = {
  list: (params?: any) => api.get('/quotations', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/quotations/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/quotations', data).then((r) => r.data),
};

// Purchases
export const purchaseApi = {
  list: (params?: any) => api.get('/purchases', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/purchases/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/purchases', data).then((r) => r.data),
};

// Sales Returns
export const salesReturnApi = {
  list: (params?: any) => api.get('/sales-returns', { params }).then((r) => r.data),
  create: (data: any) => api.post('/sales-returns', data).then((r) => r.data),
};

// Purchase Returns
export const purchaseReturnApi = {
  list: (params?: any) => api.get('/purchase-returns', { params }).then((r) => r.data),
};

// Payments
export const paymentApi = {
  list: (params?: any) => api.get('/payments', { params }).then((r) => r.data),
  create: (data: any) => api.post('/payments', data).then((r) => r.data),
};

// Expenses
export const expenseApi = {
  list: (params?: any) => api.get('/expenses', { params }).then((r) => r.data),
  create: (data: any) => api.post('/expenses', data).then((r) => r.data),
  categories: () => api.get('/expenses/categories').then((r) => r.data),
};

// Warehouses
export const warehouseApi = {
  list: () => api.get('/warehouses').then((r) => r.data),
  create: (data: any) => api.post('/warehouses', data).then((r) => r.data),
};

// Staff
export const staffApi = {
  list: () => api.get('/staff').then((r) => r.data),
  create: (data: any) => api.post('/staff', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/staff/${id}`, data).then((r) => r.data),
};

// Roles
export const roleApi = {
  list: () => api.get('/roles').then((r) => r.data),
  permissions: () => api.get('/roles/permissions').then((r) => r.data),
  create: (data: any) => api.post('/roles', data).then((r) => r.data),
};

// Reports
export const reportApi = {
  gstSummary: (params?: any) => api.get('/reports/gst/summary', { params }).then((r) => r.data),
  sales: (params?: any) => api.get('/reports/sales', { params }).then((r) => r.data),
  inventory: (params?: any) => api.get('/reports/inventory', { params }).then((r) => r.data),
  hsnSummary: (params?: any) => api.get('/reports/gst/hsn-summary', { params }).then((r) => r.data),
};

// Notifications
export const notificationApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id: string) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
};

// Audit Logs
export const auditApi = {
  list: (params?: any) => api.get('/audit-logs', { params }).then((r) => r.data),
};

// Support
export const supportApi = {
  list: () => api.get('/support').then((r) => r.data),
  create: (data: any) => api.post('/support', data).then((r) => r.data),
};

// Super Admin
export const superAdminApi = {
  stats: () => api.get('/super-admin/stats').then((r) => r.data),
  companies: (params?: any) => api.get('/super-admin/companies', { params }).then((r) => r.data),
  users: (params?: any) => api.get('/super-admin/users', { params }).then((r) => r.data),
  toggleCompany: (id: string) => api.put(`/super-admin/companies/${id}/toggle`).then((r) => r.data),
  auditLogs: (params?: any) => api.get('/super-admin/audit-logs', { params }).then((r) => r.data),
  plans: () => api.get('/super-admin/plans').then((r) => r.data),
};

// File Upload
export const uploadApi = {
  image: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
};

// Invoice Templates
export const templateApi = {
  list: () => api.get('/templates').then((r) => r.data),
  get: (id: string) => api.get(`/templates/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/templates', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),
  setDefault: (id: string) => api.post(`/templates/${id}/set-default`).then((r) => r.data),
};

export default api;
