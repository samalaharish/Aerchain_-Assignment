type SupabaseEnv = Record<string, string | undefined>;

export type SupabaseServerClient = {
  isConfigured: true;
  getState<T>(key: string): Promise<T | null>;
  upsertState<T>(key: string, value: T): Promise<void>;
  deleteState(key: string): Promise<void>;
  upsertRows(table: string, rows: Record<string, unknown> | Record<string, unknown>[], onConflict?: string): Promise<void>;
  selectRows<T>(table: string, query: string): Promise<T[]>;
};

export function getSupabaseServerClient(env: SupabaseEnv = process.env): SupabaseServerClient | null {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const baseUrl = url.replace(/\/$/, "");
  const serviceRoleKey = key;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed ${response.status}: ${await response.text()}`);
    }

    if (response.status === 204) return null as T;
    const text = await response.text();
    return text ? JSON.parse(text) as T : null as T;
  }

  return {
    isConfigured: true,
    async getState<T>(stateKey: string): Promise<T | null> {
      const rows = await request<Array<{ value: T }>>(`app_state?key=eq.${encodeURIComponent(stateKey)}&select=value&limit=1`);
      return rows[0]?.value ?? null;
    },
    async upsertState<T>(stateKey: string, value: T): Promise<void> {
      await request("app_state?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          key: stateKey,
          value,
          updated_at: new Date().toISOString()
        })
      });
    },
    async deleteState(stateKey: string): Promise<void> {
      await request(`app_state?key=eq.${encodeURIComponent(stateKey)}`, {
        method: "DELETE"
      });
    },
    async upsertRows(table: string, rows: Record<string, unknown> | Record<string, unknown>[], onConflict = "id"): Promise<void> {
      await request(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(rows)
      });
    },
    async selectRows<T>(table: string, query: string): Promise<T[]> {
      return await request<T[]>(`${table}?${query}`);
    }
  };
}
