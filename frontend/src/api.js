const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "talenthub_token";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.rule = payload?.rule;
  }
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    raw = false,
    headers: customHeaders = {},
  } = options;

  const headers = { ...customHeaders };
  const currentToken = token();
  if (auth && currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the TalentHub API. Make sure the backend is running on port 8000.",
      0,
      null,
    );
  }

  if (response.status === 401 && auth) {
    window.dispatchEvent(new Event("talenthub:unauthorized"));
  }

  if (!response.ok) {
    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => "");
    }
    const detail =
      (data && typeof data === "object" && data.detail) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${response.status}.`;
    throw new ApiError(detail, response.status, data);
  }

  if (raw) {
    return response;
  }
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

export function setToken(value) {
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return token();
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          search.append(key, item);
        }
      });
    } else {
      search.append(key, String(value));
    }
  });
  const result = search.toString();
  return result ? `?${result}` : "";
}

export async function downloadResume(profileId) {
  const response = await request(`/files/resumes/${profileId}`, { raw: true });
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const filename = match ? decodeURIComponent(match[1]) : "resume.pdf";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
