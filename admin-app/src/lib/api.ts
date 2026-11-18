export class ApiError extends Error {}

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch("/api/admin/" + url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401 && url !== "login") window.dispatchEvent(new Event("compack:unauth"))
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(j.error || "Erreur " + r.status)
  return j as T
}
