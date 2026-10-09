import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Sparkles,
  Ticket,
  Tv,
  Users,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ChevronDown,
  Camera,
  Flame
} from 'lucide-react';
import { Guest } from './types/guest';
import { GuestService } from './services/guestService';
import { INITIAL_GUESTS } from './data/initialGuests';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DoorScanner } from './components/scanner/DoorScanner';
import { RSVPView } from './components/rsvp/RSVPView';
import { InvitationCard } from './components/invitation/InvitationCard';
import { StageScreen } from './components/stage/StageScreen';
import { DivoLogo } from './components/brand/DivoLogo';
import { GuestUploadView } from './components/liveWall/GuestUploadView';
import { ProjectionScreen } from './components/liveWall/ProjectionScreen';
import { LiveWallAdmin } from './components/liveWall/LiveWallAdmin';

type ViewTab = 'admin' | 'scanner' | 'card-preview' | 'rsvp' | 'stage' | 'muro-admin' | 'muro-invitado' | 'pantalla-proyector';

function parseInitialRoute(): {
  token: string | null;
  isAsistencia: boolean;
  isOrganizer: boolean;
  isMuroInvitado: boolean;
  isPantalla: boolean;
  slug: string;
} {
  if (typeof window === 'undefined') {
    return { token: null, isAsistencia: false, isOrganizer: false, isMuroInvitado: false, isPantalla: false, slug: 'divo20' };
  }

  const searchParams = new URLSearchParams(window.location.search);
  let hashParams = new URLSearchParams();
  if (window.location.hash.includes('?')) {
    hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
  }

  const token =
    searchParams.get('guest') ||
    searchParams.get('token') ||
    searchParams.get('id') ||
    hashParams.get('guest') ||
    hashParams.get('token') ||
    hashParams.get('id') ||
    null;

  const isOrganizer =
    searchParams.has('admin') ||
    hashParams.has('admin') ||
    window.location.hash.includes('admin') ||
    window.location.pathname.includes('/admin');

  // Muro en vivo para invitados (subir foto/mensaje)
  const isMuroInvitado =
    searchParams.has('muro') ||
    searchParams.has('fotos') ||
    hashParams.has('muro') ||
    window.location.pathname.includes('/e/');

  // Pantalla completa de proyector
  const isPantalla =
    searchParams.has('pantalla') ||
    hashParams.has('pantalla') ||
    window.location.pathname.includes('/pantalla');

  const slug = searchParams.get('slug') || hashParams.get('slug') || 'divo20';

  // If there's a token, or asistencia query, or not an organizer, it's an attendance request
  const isAsistencia =
    Boolean(token) ||
    searchParams.has('asistencia') ||
    searchParams.has('rsvp') ||
    hashParams.has('asistencia') ||
    hashParams.has('rsvp') ||
    window.location.hash.includes('asistencia') ||
    window.location.hash.includes('rsvp');

  return {
    token: token ? decodeURIComponent(token).trim() : null,
    isAsistencia,
    isOrganizer,
    isMuroInvitado,
    isPantalla,
    slug,
  };
}

export default function App() {
  const initialRoute = parseInitialRoute();
  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [activeTab, setActiveTab] = useState<ViewTab>(
    initialRoute.isPantalla
      ? 'pantalla-proyector'
      : initialRoute.isMuroInvitado
      ? 'muro-invitado'
      : initialRoute.isOrganizer
      ? 'admin'
      : 'rsvp'
  );
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(INITIAL_GUESTS[0] || null);
  const [isGuestModeFromUrl, setIsGuestModeFromUrl] = useState(
    (!initialRoute.isOrganizer || Boolean(initialRoute.token) || initialRoute.isAsistencia) &&
    !initialRoute.isPantalla &&
    !initialRoute.isMuroInvitado
  );
  const [isLoadingToken, setIsLoadingToken] = useState(Boolean(initialRoute.token));
  const [urlToken, setUrlToken] = useState<string | null>(initialRoute.token);

  // Load guests and handle URL ?guest=... parameter
  useEffect(() => {
    // Initial fetch
    GuestService.getAllGuests().then(async (all) => {
      setGuests(all);

      const route = parseInitialRoute();
      if (route.token) {
        setUrlToken(route.token);
        let match: Guest | null | undefined = all.find(
          (g) =>
            g.token.toLowerCase() === route.token!.toLowerCase() ||
            g.id.toLowerCase() === route.token!.toLowerCase()
        );

        if (!match) {
          // Direct API fallback
          match = await GuestService.getGuestByIdOrToken(route.token);
        }

        if (!match) {
          // Self-hydrate from QR URL query params if scanned on another device
          const resolved = GuestService.resolveGuestFromQRText(window.location.href, all);
          if (resolved.guest) {
            match = resolved.guest;
            setGuests((prev) => [match!, ...prev.filter((g) => g.id !== match!.id)]);
          }
        }

        if (match) {
          setSelectedGuest(match);
          setActiveTab('rsvp');
          setIsGuestModeFromUrl(true);
        } else if (all.length > 0) {
          // If token was not found, default to first or let user choose
          setSelectedGuest(all[0]);
        }
        setIsLoadingToken(false);
      } else if (route.isOrganizer) {
        setIsGuestModeFromUrl(false);
        setActiveTab('admin');
      } else if (all.length > 0 && !selectedGuest) {
        setSelectedGuest(all[0]);
      }
    });

    // Real-time synchronization
    const unsubscribe = GuestService.subscribe((updatedGuests) => {
      setGuests(updatedGuests);
      setSelectedGuest((current) => {
        if (!current) return updatedGuests[0] || null;
        return updatedGuests.find((g) => g.id === current.id) || current;
      });
    });

    return () => unsubscribe();
  }, []);

  const handleSelectGuestForPreview = (guest: Guest) => {
    setSelectedGuest(guest);
    setActiveTab('card-preview');
  };

  const handleOpenRSVPPage = (guest: Guest) => {
    setSelectedGuest(guest);
    setActiveTab('rsvp');
  };

  const handleGuestUpdated = (updated: Guest) => {
    setGuests((prev) => {
      const exists = prev.some((g) => g.id === updated.id);
      return exists ? prev.map((g) => (g.id === updated.id ? updated : g)) : [updated, ...prev];
    });
    if (selectedGuest?.id === updated.id) {
      setSelectedGuest(updated);
    }
  };

  // If a guest lands here directly from a WhatsApp invitation link or QR scan
  if (isGuestModeFromUrl) {
    if (isLoadingToken) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
          <DivoLogo size="md" showSubtext={true} showTapeMeasure={true} />
          <div className="mt-6 flex items-center gap-2 text-xs font-montserrat text-[#C5A059] tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-ping"></span>
            <span>Cargando tu invitación exclusiva...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-screen bg-[#0a0a0a] text-[#FAF7F2] flex flex-col justify-between">
        {/* Discrete Luxury Event Top Bar */}
        <header className="bg-black/95 border-b border-[#C5A059]/20 px-4 py-2 flex items-center justify-between text-xs z-50 text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
            <span className="text-[11px] font-montserrat text-white/80">
              {selectedGuest ? (
                <>
                  Invitación oficial:{' '}
                  <strong className="text-white font-semibold">
                    {selectedGuest.firstName} {selectedGuest.lastName}
                  </strong>
                </>
              ) : (
                'Invitación Oficial • DIVO 20 Años'
              )}
            </span>
          </div>

          <button
            onClick={() => {
              setIsGuestModeFromUrl(false);
              setActiveTab('admin');
              window.history.pushState({}, '', window.location.pathname);
            }}
            className="text-[10px] font-montserrat tracking-wider uppercase text-[#C5A059]/70 hover:text-[#E7CF98] transition-colors flex items-center gap-1 cursor-pointer"
            title="Acceso exclusivo para organizadores y staff"
          >
            <span>Panel Organizador</span>
            <span>→</span>
          </button>
        </header>

        {selectedGuest ? (
          <RSVPView
            guest={selectedGuest}
            onUpdateSuccess={handleGuestUpdated}
            onGoToAdmin={() => {
              setIsGuestModeFromUrl(false);
              setActiveTab('admin');
              window.history.pushState({}, '', window.location.pathname);
            }}
          />
        ) : (
          <div className="max-w-md mx-auto my-12 p-6 bg-[#121212] border border-[#C5A059]/40 text-center">
            <DivoLogo size="sm" showSubtext={false} />
            <h3 className="text-lg font-montserrat font-bold text-white mt-4">
              Confirmación de Asistencia
            </h3>
            <p className="text-xs text-white/70 mt-2">
              Selecciona tu nombre para confirmar tu asistencia:
            </p>
            <div className="mt-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
              {guests.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuest(g)}
                  className="p-2.5 text-left text-xs bg-white/5 hover:bg-[#C5A059]/20 hover:border-[#C5A059] border border-white/10 text-white transition-colors"
                >
                  <div className="font-bold">{g.firstName} {g.lastName}</div>
                  <div className="text-[10px] text-white/50">{g.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-white/5 py-4 px-4 text-center text-[10px] font-montserrat text-white/40">
          <span>DIVO Trajes y Etiqueta • 20 Años Vistiendo Momentos • Capilla Buen Pastor, Córdoba</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#FAF7F2] flex flex-col justify-between selection:bg-[#C5A059] selection:text-black">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-[#C5A059]/30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand Logo & Event Badge */}
          <div
            onClick={() => setActiveTab('admin')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <DivoLogo size="sm" showSubtext={false} showTapeMeasure={false} />
            <div className="hidden sm:flex flex-col border-l border-[#C5A059]/30 pl-3">
              <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
                VISTIENDO MOMENTOS
              </span>
              <span className="font-montserrat text-[9px] text-white/60">
                22 Oct 2026 • Capilla Buen Pastor, Cba
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {/* Panel Admin */}
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Invitaciones</span>
            </button>

            {/* Escáner Puerta */}
            <button
              onClick={() => setActiveTab('scanner')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'scanner'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Escáner Puerta</span>
            </button>

            {/* Tarjeta Digital */}
            <button
              onClick={() => setActiveTab('card-preview')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'card-preview'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Ver Tarjeta</span>
            </button>

            {/* RSVP Guest Experience */}
            <button
              onClick={() => setActiveTab('rsvp')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'rsvp'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vista RSVP</span>
            </button>

            {/* Pantalla Escenario */}
            <button
              onClick={() => setActiveTab('stage')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'stage'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Escenario</span>
            </button>

            {/* Muro en Vivo Moderación */}
            <button
              onClick={() => setActiveTab('muro-admin')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'muro-admin'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Muro en Vivo</span>
            </button>

            {/* Pantalla Gigante Proyector */}
            <button
              onClick={() => setActiveTab('pantalla-proyector')}
              className={`py-2 px-3 sm:px-4 text-xs font-montserrat tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'pantalla-proyector'
                  ? 'bg-[#C5A059] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Pantalla Proyector</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Guest Selector Dropdown when in 'card-preview' or 'rsvp' */}
      {(activeTab === 'card-preview' || activeTab === 'rsvp') && (
        <div className="bg-[#121212] border-b border-white/10 py-2.5 px-4">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#C5A059] font-montserrat uppercase font-bold tracking-wider">
                Simulando Invitado:
              </span>
              <select
                value={selectedGuest?.id || ''}
                onChange={(e) => {
                  const found = guests.find((g) => g.id === e.target.value);
                  if (found) setSelectedGuest(found);
                }}
                className="bg-[#1e1e1e] border border-[#C5A059]/40 text-[#FAF7F2] font-montserrat text-xs px-3 py-1.5 focus:outline-none focus:border-[#C5A059]"
              >
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.firstName} {g.lastName} ({g.category} - {g.status === 'confirmed' ? 'Confirmó' : g.status === 'declined' ? 'No asiste' : 'Pendiente'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-white/50">
              <span>Token: {selectedGuest?.token}</span>
              {selectedGuest && (
                <a
                  href={GuestService.getRSVPUrl(selectedGuest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C5A059] hover:underline flex items-center gap-1"
                >
                  <span>Link Público</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Views Container */}
      <main className="flex-1 py-4">
        {/* TAB 1: ADMIN DASHBOARD */}
        {activeTab === 'admin' && (
          <AdminDashboard
            guests={guests}
            onSelectGuestForPreview={handleSelectGuestForPreview}
            onOpenRSVPPage={handleOpenRSVPPage}
            onGoToScanner={() => setActiveTab('scanner')}
            onGoToLiveWall={() => setActiveTab('muro-admin')}
          />
        )}

        {/* TAB 2: DOOR SCANNER */}
        {activeTab === 'scanner' && (
          <DoorScanner
            guests={guests}
            onGuestUpdated={handleGuestUpdated}
          />
        )}

        {/* TAB 3: INVITATION CARD PREVIEW */}
        {activeTab === 'card-preview' && (
          <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col items-center">
            <div className="text-center mb-6">
              <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
                DISEÑO OFICIAL DE INVITACIÓN (SLIDE 7)
              </span>
              <h2 className="font-montserrat text-2xl font-bold text-white mt-1">
                Tarjeta Digital con QR Único
              </h2>
              <p className="text-xs text-white/60 mt-1 max-w-md">
                Cada invitado posee su tarjeta personalizada con código QR que enlaza a su formulario RSVP y valida su ingreso en puerta.
              </p>
            </div>

            {selectedGuest ? (
              <div className="w-full flex flex-col lg:flex-row items-start justify-center gap-8">
                <InvitationCard guest={selectedGuest} showActions={true} />

                {/* Inline Live Editor for Selected Guest */}
                <div className="w-full max-w-md bg-[#121212] border border-[#C5A059]/40 p-5 rounded-sm shadow-xl text-left">
                  <div className="border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <span className="font-montserrat text-[10px] tracking-[0.2em] text-[#C5A059] uppercase font-bold block">
                        EDICIÓN EN TIEMPO REAL
                      </span>
                      <h3 className="font-montserrat text-sm font-bold text-white mt-0.5">
                        Editar Campos del Invitado
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-white/50">
                      {selectedGuest.token}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          value={selectedGuest.firstName}
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              firstName: e.target.value,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Apellido
                        </label>
                        <input
                          type="text"
                          value={selectedGuest.lastName}
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              lastName: e.target.value,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Categoría
                        </label>
                        <select
                          value={selectedGuest.category}
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              category: e.target.value as any,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        >
                          <option value="Invitado General">Invitado General</option>
                          <option value="VIP">VIP</option>
                          <option value="Prensa">Prensa</option>
                          <option value="Cliente Distinguido">Cliente Distinguido</option>
                          <option value="Familia & Amigos">Familia & Amigos</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Ubicación / Sector
                        </label>
                        <input
                          type="text"
                          value={selectedGuest.tableOrSeat || ''}
                          placeholder="Ej: Fila 1 - Capilla"
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              tableOrSeat: e.target.value || undefined,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Estado RSVP
                        </label>
                        <select
                          value={selectedGuest.status}
                          onChange={(e) => {
                            const nextStatus = e.target.value as any;
                            GuestService.updateGuest(selectedGuest.id, {
                              status: nextStatus,
                              confirmedCompanions:
                                nextStatus === 'confirmed'
                                  ? selectedGuest.confirmedCompanions || selectedGuest.companionsAllowed
                                  : 0,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        >
                          <option value="confirmed">✓ Confirmado</option>
                          <option value="pending">⏳ Pendiente</option>
                          <option value="declined">✕ No Asiste</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Acompañantes
                        </label>
                        <select
                          value={
                            selectedGuest.status === 'confirmed'
                              ? selectedGuest.confirmedCompanions
                              : selectedGuest.companionsAllowed
                          }
                          onChange={(e) => {
                            const count = Number(e.target.value);
                            GuestService.updateGuest(selectedGuest.id, {
                              companionsAllowed: count,
                              confirmedCompanions: selectedGuest.status === 'confirmed' ? count : 0,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        >
                          <option value={0}>0 (Individual)</option>
                          <option value={1}>+1 Acompañante</option>
                          <option value={2}>+2 Acompañantes</option>
                          <option value={3}>+3 Acompañantes</option>
                          <option value={4}>+4 Acompañantes</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                        Nombre del Acompañante
                      </label>
                      <input
                        type="text"
                        value={selectedGuest.companionName || ''}
                        placeholder="Opcional"
                        onChange={(e) => {
                          GuestService.updateGuest(selectedGuest.id, {
                            companionName: e.target.value || undefined,
                          }).then(handleGuestUpdated);
                        }}
                        className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Teléfono / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={selectedGuest.phone || ''}
                          placeholder="+54 9 351..."
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              phone: e.target.value || undefined,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-montserrat text-white/70 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={selectedGuest.email || ''}
                          placeholder="correo@ejemplo.com"
                          onChange={(e) => {
                            GuestService.updateGuest(selectedGuest.id, {
                              email: e.target.value || undefined,
                            }).then(handleGuestUpdated);
                          }}
                          className="w-full bg-[#1c1c1c] border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-white/50">
                Selecciona un invitado para previsualizar su tarjeta digital.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RSVP PAGE FOR GUEST */}
        {activeTab === 'rsvp' && selectedGuest && (
          <RSVPView
            guest={selectedGuest}
            onUpdateSuccess={handleGuestUpdated}
            onGoToAdmin={() => setActiveTab('admin')}
          />
        )}

        {/* TAB 5: STAGE & PRESS VISUALS */}
        {activeTab === 'stage' && <StageScreen />}

        {/* TAB 6: MURO EN VIVO - PANEL DE MODERACIÓN ADMIN */}
        {activeTab === 'muro-admin' && (
          <LiveWallAdmin
            onOpenProjectionScreen={() => setActiveTab('pantalla-proyector')}
            onOpenGuestUpload={() => setActiveTab('muro-invitado')}
          />
        )}

        {/* TAB 7: MURO EN VIVO - INTERFAZ MOBILE PARA SUBIR FOTO */}
        {activeTab === 'muro-invitado' && (
          <GuestUploadView
            slug="divo20"
            defaultGuestName={selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : ''}
            onGoBackToInvitation={() => setActiveTab('rsvp')}
            onOpenLiveWallScreen={() => setActiveTab('pantalla-proyector')}
          />
        )}

        {/* TAB 8: PANTALLA GIGANTE PROYECTOR (FONDO OSCURO, REALTIME, SIN CONTROLES MOLESTOS) */}
        {activeTab === 'pantalla-proyector' && (
          <div className="fixed inset-0 z-50 bg-[#070707]">
            <ProjectionScreen
              slug="divo20"
              onExit={() => setActiveTab('muro-admin')}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-white/10 py-6 px-4 text-center text-xs text-white/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-montserrat font-bold text-white tracking-widest text-xs">
              DIVO TRAJES Y ETIQUETA
            </span>
            <span className="text-[#C5A059] font-serif italic text-sm">20 años</span>
          </div>

          <div className="font-montserrat text-[11px] text-white/50 tracking-wider">
            Capilla Paseo del Buen Pastor • 22 de Octubre de 2026, 19:00 hs • Córdoba, Argentina
          </div>

          <div className="font-mono text-[10px] text-neutral-500">
            DIVO 20 Años • Vistiendo Momentos
          </div>
        </div>
      </footer>
    </div>
  );
}
