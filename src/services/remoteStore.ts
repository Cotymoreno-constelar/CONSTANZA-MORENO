import { Guest } from '../types/guest';

/**
 * Almacenamiento compartido de invitados en Supabase (API REST / PostgREST).
 * Sin dependencias extra: usa fetch directo.
 *
 * La clave "anon" de Supabase es pública por diseño (va dentro del sitio).
 * Se puede sobreescribir con VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) || {};

const SUPABASE_URL = (env.VITE_SUPABASE_URL || 'https://spwjmzoshgpqblcojiui.supabase.co').replace(/\/+$/, '');
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwd2ptem9zaGdwcWJsY29qaXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjM1MjIsImV4cCI6MjEwNzEzOTUyMn0.Y5jp3PNq4n97JpbxWZ7XR6GcKQ2wowQyhGwQhNiUP14';

const TABLE = 'divo_guests';
const META_ID = '__meta_seeded';
const BASE = `${SUPABASE_URL}/rest/v1/${TABLE}`;

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

interface Row {
  id: string;
  data: Guest;
  updated_at?: string;
}

function toRow(g: Guest): Row {
  return { id: g.id, data: g, updated_at: g.updatedAt || new Date().toISOString() };
}

async function ensureOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${what} falló (${res.status}) ${text}`.trim());
  }
}

export const RemoteStore = {
  enabled: true,

  /** Trae todos los invitados. Devuelve null si la tabla no existe o no hay conexión. */
  async fetchAll(): Promise<Guest[] | null> {
    try {
      const out: Guest[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const res = await fetch(`${BASE}?select=id,data&order=id.asc`, {
          headers: headers({ Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' }),
        });
        if (!res.ok) return null;
        const rows: Array<{ id: string; data: Guest }> = await res.json();
        for (const r of rows) {
          if (r.id !== META_ID && r.data) out.push(r.data);
        }
        if (rows.length < pageSize) break;
      }
      return out;
    } catch {
      return null;
    }
  },

  async isSeeded(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE}?select=id&id=eq.${META_ID}`, { headers: headers() });
      if (!res.ok) return true; // ante la duda, no sembrar
      const rows = await res.json();
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return true;
    }
  },

  async markSeeded(): Promise<void> {
    await RemoteStore.upsertRaw([{ id: META_ID, data: {} as Guest, updated_at: new Date().toISOString() }]);
  },

  async getOne(id: string): Promise<Guest | null> {
    try {
      const res = await fetch(`${BASE}?select=data&id=eq.${encodeURIComponent(id)}`, { headers: headers() });
      if (!res.ok) return null;
      const rows: Array<{ data: Guest }> = await res.json();
      return rows[0]?.data || null;
    } catch {
      return null;
    }
  },

  /** Busca por id, token o nombre completo (para links de RSVP). */
  async findByIdOrToken(query: string): Promise<Guest | null> {
    try {
      const q = encodeURIComponent(query);
      const res = await fetch(`${BASE}?select=data&or=(id.eq.${q},data->>token.eq.${q})&limit=1`, {
        headers: headers(),
      });
      if (!res.ok) return null;
      const rows: Array<{ data: Guest }> = await res.json();
      return rows[0]?.data || null;
    } catch {
      return null;
    }
  },

  async upsertRaw(rows: Row[]): Promise<void> {
    if (rows.length === 0) return;
    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const res = await fetch(`${BASE}?on_conflict=id`, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows.slice(i, i + chunk)),
      });
      await ensureOk(res, 'guardar');
    }
  },

  async upsert(guests: Guest[]): Promise<void> {
    await RemoteStore.upsertRaw(guests.map(toRow));
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${BASE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=minimal' }),
    });
    await ensureOk(res, 'borrar');
  },

  /** Borra todos los invitados (conserva la marca de "ya sembrado"). */
  async clear(): Promise<void> {
    const res = await fetch(`${BASE}?id=neq.${META_ID}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=minimal' }),
    });
    await ensureOk(res, 'vaciar');
  },

  async replaceAll(guests: Guest[]): Promise<void> {
    await RemoteStore.clear();
    await RemoteStore.upsert(guests);
    await RemoteStore.markSeeded();
  },
};
