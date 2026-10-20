/**
 * api.js — обёртка над fetch для работы с бэкендом.
 *
 * Использование:
 *   const products = await api.get('/products');
 *   await api.post('/auth/login', { email, password });
 *
 * Токен хранится в localStorage под ключом 'token',
 * данные пользователя — под ключом 'user'.
 *
 * Ошибки:
 *   - Сетевая ошибка (сервер недоступен) — err.isNetworkError === true.
 *   - HTTP-ошибка (400/401/404/500) — err.message из ответа сервера,
 *     err.status — HTTP-код.
 */

const API_BASE = '/api';

const api = {
  /* ---------- Работа с токеном и пользователем ---------- */
  getToken() {
    return localStorage.getItem('token');
  },
  setToken(token) {
    localStorage.setItem('token', token);
  },
  clearToken() {
    localStorage.removeItem('token');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  clearUser() {
    localStorage.removeItem('user');
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  isAdmin() {
    const user = this.getUser();
    return Boolean(user && user.role === 'admin');
  },

  logout() {
    this.clearToken();
    this.clearUser();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },

  /* ---------- Базовый запрос ---------- */
  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const netErr = new Error('Нет связи с сервером. Проверьте, запущен ли бэкенд.');
      netErr.isNetworkError = true;
      throw netErr;
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      // 401 — токен протух или невалиден, чистим сессию
      if (res.status === 401) {
        this.clearToken();
        this.clearUser();
      }

      const message =
        (data && data.message) ||
        (data && data.error) ||
        `Ошибка ${res.status}`;

      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },
};

// Экспортируем глобально, чтобы было доступно из обычных <script>
window.api = api;