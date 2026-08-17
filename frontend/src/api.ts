let csrfToken = "";

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const data = await parseJson<{ csrfToken: string }>(
    await fetch("/api/auth/csrf", { credentials: "include" })
  );
  csrfToken = data.csrfToken;
  return csrfToken;
}

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parseJson<T>(await fetch(path, { credentials: "include" }));
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = await ensureCsrf();
  return parseJson<T>(
    await fetch(path, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiUpload(files: FileList | File[]): Promise<string[]> {
  const token = await ensureCsrf();
  const form = new FormData();
  Array.from(files).forEach((file) => form.append("files", file));
  const data = await parseJson<{ paths: string[] }>(
    await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": token },
      body: form,
    })
  );
  return data.paths;
}
