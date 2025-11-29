// Frontend/lib/apiClient.js
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Check if token is expired
  isTokenExpired(token) {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  // Clear expired token
  clearExpiredToken() {
    const token = localStorage.getItem('token');
    if (token && this.isTokenExpired(token)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return true;
    }
    return false;
  }

  getAuthHeaders() {
    // Clear expired token first
    this.clearExpiredToken();

    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - clear token and redirect to login
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/auth/login';
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Dashboard
  async getDashboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/dashboard?${query}`, { cache: 'no-store' });
  }

  // Warehouses
  async getWarehouses(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/warehouses?${query}`);
  }

  async createWarehouse(data) {
    return this.request('/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWarehouse(id, data) {
    return this.request(`/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWarehouse(id) {
    return this.request(`/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  async patchWarehouse(id, data) {
    return this.request(`/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Inventory
  async getInventory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/inventory?${query}`);
  }

  async createInventoryItem(data) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInventoryItem(sku, data) {
    return this.request(`/inventory/${sku}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInventoryItem(sku) {
    return this.request(`/inventory/${sku}`, {
      method: 'DELETE',
    });
  }

  async adjustInventory(data) {
    return this.request('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async importInventory(data) {
    return this.request('/inventory/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Spare Parts
  async getSpareParts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/spare-parts?${query}`);
  }

  // Categories
  async getCategories(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/categories?${query}`);
  }

  async createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id, data) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Transactions
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions?${query}`);
  }
  
  async importSpareParts(data) {
    return this.request('/spare-parts/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createSparePart(data) {
    return this.request('/spare-parts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSparePart(id, data) {
    return this.request(`/spare-parts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSparePart(id) {
    return this.request(`/spare-parts/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks?${query}`);
  }

  async createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id, data) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Dispatch Orders
  async getDispatchOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/dispatch-orders?${query}`);
  }

  async createDispatchOrder(data) {
    return this.request('/dispatch-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDispatchOrder(id, data) {
    return this.request(`/dispatch-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDispatchOrder(id) {
    return this.request(`/dispatch-orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Reports
  async getInventoryReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports/inventory?${query}`);
  }

  async getTransactionsReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports/transactions?${query}`);
  }

  async getDispatchReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reports/dispatch?${query}`);
  }

  // Auth
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async signup(userData) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Upload
  async uploadFile(formData) {
    return this.request('/upload', {
      method: 'POST',
      headers: {
        // Let browser set Content-Type for FormData
        ...this.getAuthHeaders(),
      },
      body: formData,
    });
  }

  // Logout - clear local storage
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/auth/login';
  }

  // Check if user is authenticated
  isAuthenticated() {
    const token = localStorage.getItem('token');
    return token && !this.isTokenExpired(token);
  }
}

// Export a singleton instance
const apiClient = new ApiClient();
export default apiClient;