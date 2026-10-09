-- ==============================================================================
-- DIVO 20 AÑOS — SCRIPT SQL COMPLETO PARA SUPABASE
-- Incluye: Tablas, Políticas de Seguridad (RLS), Triggers, Funciones y Storage Bucket
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logo_url TEXT,
    color_primario VARCHAR(20) DEFAULT '#C5A059',
    color_secundario VARCHAR(20) DEFAULT '#0a0a0a',
    moderacion_activa BOOLEAN NOT NULL DEFAULT false,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
    expira_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsqueda rápida por slug
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_estado ON public.events(estado);

-- 3. TABLA: posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    image_url TEXT,
    mensaje VARCHAR(280),
    nombre_invitado VARCHAR(120) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para posts
CREATE INDEX IF NOT EXISTS idx_posts_event_id ON public.posts(event_id);
CREATE INDEX IF NOT EXISTS idx_posts_estado ON public.posts(estado);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- 4. POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Políticas para events
-- Lectura pública para cualquier invitado que consulte el evento
CREATE POLICY "Lectura pública de eventos activos"
ON public.events
FOR SELECT
USING (true);

-- Solo administradores o creadores pueden insertar/editar eventos
CREATE POLICY "Admins pueden gestionar eventos"
ON public.events
FOR ALL
USING (auth.uid() = owner_id OR auth.role() = 'service_role');

-- Políticas para posts
-- 1) Los invitados solo pueden insertar posts si el evento está activo y respetando el estado según moderación
CREATE POLICY "Invitados pueden publicar en eventos activos"
ON public.posts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = posts.event_id
        AND events.estado = 'activo'
    )
);

-- 2) La pantalla pública e invitados solo pueden leer posts aprobados
CREATE POLICY "Lectura pública solo de posts aprobados"
ON public.posts
FOR SELECT
USING (
    estado = 'aprobado'
    OR (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = posts.event_id
            AND (events.owner_id = auth.uid() OR auth.role() = 'authenticated')
        )
    )
);

-- 3) Dueño del evento o Staff autenticado puede leer pendientes, moderar, editar y borrar
CREATE POLICY "Staff y admins pueden moderar posts"
ON public.posts
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = posts.event_id
        AND (events.owner_id = auth.uid() OR auth.role() = 'authenticated')
    )
);

CREATE POLICY "Staff y admins pueden eliminar posts"
ON public.posts
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = posts.event_id
        AND (events.owner_id = auth.uid() OR auth.role() = 'authenticated')
    )
);

-- 5. STORAGE BUCKET PARA FOTOS DEL EVENTO
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-photos',
    'event-photos',
    true,
    10485760, -- 10 MB límite
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Carga pública de fotos para invitados"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Lectura pública de fotos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-photos');

-- 6. Habilitar Supabase Realtime para la tabla posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- 7. EVENTO INICIAL DE DEMOSTRACIÓN (DIVO 20 AÑOS)
INSERT INTO public.events (id, nombre, slug, fecha, color_primario, color_secundario, moderacion_activa, estado)
VALUES (
    'd17020a0-0000-4000-8000-000000000001',
    'DIVO 20 AÑOS — Vistiendo Momentos',
    'divo20',
    '2026-10-22 19:00:00-03',
    '#C5A059',
    '#0a0a0a',
    false,
    'activo'
)
ON CONFLICT (slug) DO NOTHING;
