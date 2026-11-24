let selectedGymId: number | undefined;
export const setApiGym = (id: number | undefined) => { selectedGymId=id; };

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(selectedGymId?{'X-Gym-Id':String(selectedGymId)}:{}), ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? 'Request failed.', response.status, data.details);
  return data as T;
}

export const request = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
};

export type Page<T> = { rows: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export function params(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key,value]) => { if (value !== undefined && value !== '') query.set(key,String(value)); });
  const result = query.toString();
  return result ? `?${result}` : '';
}
