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
  ChevronDown
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

type ViewTab = 'admin' | 'scanner' | 'card-preview' | 'rsvp' | 'stage';

export default function App() {
  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [activeTab, setActiveTab] = useState<ViewTab>('admin');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(INITIAL_GUESTS[0] || null);
  const [isGuestModeFromUrl, setIsGuestModeFromUrl] = useState(false);
  const [urlToken, setUrlToken] = useState<string | null>(null);

  // Load guests and handle URL ?guest=... parameter
  useEffect(() => {
    // Initial fetch
    GuestService.getAllGuests().then((all) => {
      setGuests(all);
      
      // Check query param
      const params = new URLSearchParams(window.location.search);
      const guestParam = params.get('guest');

      if (guestParam) {
        setUrlToken(guestParam);
        const match = all.find(
          (g) =>
            g.token.toLowerCase() === guestParam.toLowerCase() ||
            g.id.toLowerCase() === guestParam.toLowerCase()
        );
        if (match) {
          setSelectedGuest(match);
          setActiveTab('rsvp');
          setIsGuestModeFromUrl(true);
        }
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
    setGuests((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    if (selectedGuest?.id === updated.id) {
      setSelectedGuest(updated);
    }
  };

  // If a guest lands here directly from a WhatsApp invitation link or QR scan
  if (isGuestModeFromUrl && selectedGuest) {
    return (
      <div className="relative">
        {/* Floating organizer switch bar at top */}
        <header className="bg-black/90 border-b border-white/10 px-4 py-2 flex items-center justify-between text-xs z-50 text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-montserrat">
              Invitación exclusiva: <strong>{selectedGuest.firstName} {selectedGuest.lastName}</strong>
            </span>
          </div>

          <button
            onClick={() => {
              setIsGuestModeFromUrl(false);
              setActiveTab('admin');
              // Remove query param from browser address bar smoothly
              window.history.pushState({}, '', window.location.pathname);
            }}
            className="text-[10px] font-montserrat tracking-wider uppercase text-[#C5A059] hover:underline"
          >
            Modo Organizador / Panel →
          </button>
        </header>

        <RSVPView
          guest={selectedGuest}
          onUpdateSuccess={handleGuestUpdated}
          onGoToAdmin={() => {
            setIsGuestModeFromUrl(false);
            setActiveTab('admin');
            window.history.pushState({}, '', window.location.pathname);
          }}
        />
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
              <InvitationCard guest={selectedGuest} showActions={true} />
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
            DIVO Gala System • 20 Años
          </div>
        </div>
      </footer>
    </div>
  );
}
