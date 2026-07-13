import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/v1",
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let refreshSubscribers: ((token: boolean) => void)[] = [];

function onRefreshed(isSuccess: boolean) {
  refreshSubscribers.forEach((cb) => cb(isSuccess));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (isSuccess: boolean) => void) {
  refreshSubscribers.push(cb);
}

// Request Interceptor: Ya no se inyecta localStorage. Solo añade correlation ID.
api.interceptors.request.use((config) => {
  // Aquí podríamos añadir X-CSRF-Token si estuviera en estado en memoria.
  return config;
});

// Response Interceptor: Manejo de 401 y Single-flight Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si no es un 401, o si la request fue para auth (login/refresh), lanzar error
    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/logout") ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        addRefreshSubscriber((isSuccess: boolean) => {
          if (isSuccess) {
            originalRequest._retry = true;
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await api.post("/auth/refresh");
      isRefreshing = false;
      onRefreshed(true);
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      onRefreshed(false);
      // Redirigir y limpiar memoria (manejado visualmente por AuthProvider también)
      window.location.href = "/login";
      return Promise.reject(refreshError);
    }
  }
);

export default api;
