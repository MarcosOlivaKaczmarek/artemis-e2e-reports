export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (response.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.href = "/api/auth/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || response.statusText);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    // Body-less response — caller is responsible for not accessing the result
    return undefined as unknown as T;
  }

  return response.json();
}
