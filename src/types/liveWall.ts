export type PostStatus = 'pendiente' | 'aprobado' | 'rechazado';

export interface LivePost {
  id: string;
  eventId: string;
  imageUrl?: string | null;
  mensaje?: string | null; // max 280 caracteres
  nombreInvitado: string;
  estado: PostStatus;
  createdAt: string;
  destacado?: boolean;
}

export interface LiveEventConfig {
  id: string;
  ownerId: string;
  nombre: string;
  slug: string;
  fecha: string;
  logoUrl?: string;
  colorPrimario: string;
  colorSecundario: string;
  moderacionActiva: boolean;
  estado: 'activo' | 'finalizado';
  expiraEn?: string;
  createdAt: string;
}
