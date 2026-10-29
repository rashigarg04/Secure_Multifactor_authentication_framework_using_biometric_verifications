import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // send the httpOnly session cookie
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

// 401s from these calls are expected (e.g. wrong password, not signed in yet)
const EXPECTED_401 = [
  "/auth/login",
  "/auth/register",
  "/auth/me",
  "/auth/logout",
  "/auth/generate-authentication-options",
  "/auth/verify-authentication",
];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !EXPECTED_401.includes(err.config?.url)) {
      // Session expired mid-use: tell AuthContext to drop the user
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  }
);

/** Turn any error (axios, WebAuthn, generic) into a message safe to show the user. */
export function getErrorMessage(err) {
  // Server responded
  if (err?.response) {
    const data = err.response.data;
    if (Array.isArray(data?.issues) && data.issues.length) {
      return data.issues.map((i) => `${i.field}: ${i.message}`).join(" · ");
    }
    if (data?.error) return data.error;
    return `Request failed (${err.response.status})`;
  }
  if (err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED") {
    return "Cannot reach the server. Is the backend running on port 4000?";
  }

  // WebAuthn / browser errors (from @simplewebauthn/browser)
  switch (err?.name) {
    case "NotAllowedError":
      return "The biometric prompt was cancelled or timed out. Please try again.";
    case "InvalidStateError":
      return "This authenticator is already registered for your account.";
    case "SecurityError":
      return "Security error: the page origin does not match the server's RP_ID/ORIGIN. Open the app at http://localhost:5173 (not 127.0.0.1).";
    case "NotSupportedError":
      return "This device or browser does not support the requested authenticator type.";
    case "AbortError":
      return "The request was cancelled.";
    default:
  }
  if (err?.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "This authenticator is already registered for your account.";
  }
  return err?.message || "Something went wrong";
}

export const authApi = {
  register: (body) => api.post("/auth/register", body).then((r) => r.data),
  login: (body) => api.post("/auth/login", body).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const accountApi = {
  devices: () => api.get("/devices").then((r) => r.data),
  renameDevice: (id, name) => api.patch(`/devices/${id}`, { name }).then((r) => r.data),
  removeDevice: (id, password) =>
    api.delete(`/devices/${id}`, { data: { password } }).then((r) => r.data),
  setMfa: (enabled, password) => api.patch("/mfa", { enabled, password }).then((r) => r.data),
  logs: (limit = 50) => api.get("/logs", { params: { limit } }).then((r) => r.data),
};