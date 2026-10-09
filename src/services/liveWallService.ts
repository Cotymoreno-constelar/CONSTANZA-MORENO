import { LiveEventConfig, LivePost, PostStatus } from '../types/liveWall';

const STORAGE_POSTS_KEY = 'divo_20_live_posts_v2';
const STORAGE_EVENT_KEY = 'divo_20_live_event_config_v2';

export const DEFAULT_EVENT_CONFIG: LiveEventConfig = {
  id: 'divo-event-20-anos',
  ownerId: 'owner-divo',
  nombre: 'DIVO 20 AÑOS — Vistiendo Momentos',
  slug: 'divo20',
  fecha: '2026-10-22T19:00:00Z',
  logoUrl: '',
  colorPrimario: '#C5A059',
  colorSecundario: '#0a0a0a',
  moderacionActiva: false, // Por defecto publica en directo
  estado: 'activo',
  createdAt: '2026-09-01T00:00:00Z',
};

export const INITIAL_POSTS: LivePost[] = [
  {
    id: 'post-1',
    eventId: 'divo-event-20-anos',
    imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    mensaje: '¡Felicitaciones a todo el equipo de DIVO por estos 20 años vistiendo elegancia cordobesa! Impecable la gala.',
    nombreInvitado: 'Pablo & Jimena Moreno',
    estado: 'aprobado',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    destacado: true,
  },
  {
    id: 'post-2',
    eventId: 'divo-event-20-anos',
    imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    mensaje: '¡Qué noche emocionante en los 20 años de DIVO! Vistiendo momentos inolvidables.',
    nombreInvitado: 'Valeria Mazza',
    estado: 'aprobado',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    destacado: true,
  },
  {
    id: 'post-3',
    eventId: 'divo-event-20-anos',
    imageUrl: null,
    mensaje: '¡Orgullo total de formar parte de esta historia! Que sean 20 años más marcando tendencia en Córdoba. ¡Salud!',
    nombreInvitado: 'Marcos Villalobos',
    estado: 'aprobado',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'post-4',
    eventId: 'divo-event-20-anos',
    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    mensaje: 'La puesta en escena en la Capilla del Buen Pastor es un lujo total. ¡Aplausos!',
    nombreInvitado: 'Lucía Santillán',
    estado: 'aprobado',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  }
];

export class LiveWallService {
  private static listeners: Set<(posts: LivePost[]) => void> = new Set();
  private static configListeners: Set<(config: LiveEventConfig) => void> = new Set();
  private static broadcastChannel: BroadcastChannel | null = null;
  private static isInit = false;

  private static init() {
    if (this.isInit || typeof window === 'undefined') return;
    this.isInit = true;

    // Sincronización instantánea entre pestañas / pantallas con BroadcastChannel
    try {
      this.broadcastChannel = new BroadcastChannel('divo_live_wall_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'POSTS_UPDATE') {
          this.notifyPosts(event.data.posts);
        } else if (event.data?.type === 'CONFIG_UPDATE') {
          this.notifyConfig(event.data.config);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    // Escuchar storage events
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_POSTS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.notifyPosts(parsed);
        } catch {
          // ignore
        }
      }
      if (e.key === STORAGE_EVENT_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.notifyConfig(parsed);
        } catch {
          // ignore
        }
      }
    });
  }

  public static getEventConfig(): LiveEventConfig {
    if (typeof window === 'undefined') return DEFAULT_EVENT_CONFIG;
    try {
      const data = localStorage.getItem(STORAGE_EVENT_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(DEFAULT_EVENT_CONFIG));
    return DEFAULT_EVENT_CONFIG;
  }

  public static updateEventConfig(updates: Partial<LiveEventConfig>): LiveEventConfig {
    const current = this.getEventConfig();
    const updated = { ...current, ...updates };
    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(updated));
      this.notifyConfig(updated);
      this.broadcastChannel?.postMessage({ type: 'CONFIG_UPDATE', config: updated });
    } catch (e) {
      console.error(e);
    }
    return updated;
  }

  public static getPosts(): LivePost[] {
    if (typeof window === 'undefined') return INITIAL_POSTS;
    try {
      const data = localStorage.getItem(STORAGE_POSTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(INITIAL_POSTS));
    return INITIAL_POSTS;
  }

  private static setPosts(posts: LivePost[]) {
    try {
      localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(posts));
      this.notifyPosts(posts);
      this.broadcastChannel?.postMessage({ type: 'POSTS_UPDATE', posts });
    } catch (e) {
      console.error(e);
    }
  }

  private static notifyPosts(posts: LivePost[]) {
    this.listeners.forEach((cb) => cb(posts));
  }

  private static notifyConfig(config: LiveEventConfig) {
    this.configListeners.forEach((cb) => cb(config));
  }

  public static subscribePosts(cb: (posts: LivePost[]) => void): () => void {
    this.init();
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public static subscribeConfig(cb: (config: LiveEventConfig) => void): () => void {
    this.init();
    this.configListeners.add(cb);
    return () => {
      this.configListeners.delete(cb);
    };
  }

  // Crear nuevo post desde la vista de invitado
  public static async createPost(params: {
    nombreInvitado: string;
    mensaje?: string | null;
    imageUrl?: string | null;
  }): Promise<LivePost> {
    const config = this.getEventConfig();
    const initialStatus: PostStatus = config.moderacionActiva ? 'pendiente' : 'aprobado';

    const newPost: LivePost = {
      id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventId: config.id,
      nombreInvitado: params.nombreInvitado.trim() || 'Invitado/a DIVO',
      mensaje: params.mensaje ? params.mensaje.trim().substring(0, 280) : null,
      imageUrl: params.imageUrl || null,
      estado: initialStatus,
      createdAt: new Date().toISOString(),
    };

    const current = this.getPosts();
    const updated = [newPost, ...current];
    this.setPosts(updated);
    return newPost;
  }

  // Moderar post (aprobar / rechazar)
  public static updatePostStatus(postId: string, nuevoEstado: PostStatus) {
    const current = this.getPosts();
    const updated = current.map((p) => (p.id === postId ? { ...p, estado: nuevoEstado } : p));
    this.setPosts(updated);
  }

  // Eliminar post
  public static deletePost(postId: string) {
    const current = this.getPosts();
    const updated = current.filter((p) => p.id !== postId);
    this.setPosts(updated);
  }

  // Reordenar o destacar
  public static toggleHighlight(postId: string) {
    const current = this.getPosts();
    const updated = current.map((p) => (p.id === postId ? { ...p, destacado: !p.destacado } : p));
    this.setPosts(updated);
  }

  // Reset a valores de prueba
  public static resetDemoPosts() {
    this.setPosts(INITIAL_POSTS);
  }

  // Obtener URL directa para compartir el muro en vivo con los invitados
  public static getGuestUploadUrl(slug = 'divo20'): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${origin}${base}?muro=true&slug=${slug}`;
  }

  // Obtener URL de la pantalla completa para proyector
  public static getProjectionScreenUrl(slug = 'divo20'): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${origin}${base}?pantalla=true&slug=${slug}`;
  }
}
