/**
 * Configuración e inicialización del cliente Supabase.
 * Para desplegar en producción con Supabase, configurar en variables de entorno:
 * VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 *
 * Si no están configuradas las variables, la aplicación opera con sincronización
 * en tiempo real automática (BroadcastChannel + LocalStorage) garantizando
 * funcionamiento offline y total interactividad.
 */

export const SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://xyzcompany.supabase.co';

export const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  !SUPABASE_URL.includes('xyzcompany') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('...')
);
