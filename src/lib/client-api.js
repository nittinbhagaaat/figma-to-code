/** Browser-side API client. Throws ApiError with the server's message on non-2xx. */
export class ApiError extends Error {
  constructor(message, status, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
async function request(method, url, body) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, { method, headers: body && !isForm ? { "Content-Type": "application/json" } : undefined, body: body ? (isForm ? body : JSON.stringify(body)) : undefined, credentials: "same-origin" });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !json?.ok) throw new ApiError(json?.error?.message || `Request failed (${res.status})`, res.status, json?.error?.code, json?.error?.details);
  return json.data;
}
export const api = {
  get: (u) => request("GET", u),
  post: (u, b) => request("POST", u, b ?? {}),
  put: (u, b) => request("PUT", u, b),
  patch: (u, b) => request("PATCH", u, b),
  del: (u) => request("DELETE", u),
};
