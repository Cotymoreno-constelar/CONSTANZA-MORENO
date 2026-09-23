import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Utensils,
  Sparkles,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Share2,
  Download,
  AlertCircle
} from 'lucide-react';
import { Guest, RSVPStatus } from '../../types/guest';
import { DivoLogo } from '../brand/DivoLogo';
import { GuestService } from '../../services/guestService';

interface RSVPViewProps {
  guest: Guest;
  onUpdateSuccess?: (updated: Guest) => void;
  onGoToAdmin?: () => void;
}

export const RSVPView: React.FC<RSVPViewProps> = ({
  guest,
  onUpdateSuccess,
  onGoToAdmin,
}) => {
  const [status, setStatus] = useState<RSVPStatus>(guest.status);
  const [confirmedCompanions, setConfirmedCompanions] = useState<number>(
    guest.confirmedCompanions || (guest.companionsAllowed > 0 ? 1 : 0)
  );
  const [companionName, setCompanionName] = useState<string>(guest.companionName || '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>(
    guest.dietaryRestrictions || 'Sin restricciones'
  );
  const [customDietary, setCustomDietary] = useState<string>('');
  const [congratulationMessage, setCongratulationMessage] = useState<string>(
    guest.congratulationMessage || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(guest.status !== 'pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerCelebration = () => {
    const end = Date.now() + 2.5 * 1000;
    const colors = ['#C5A059', '#E7CF98', '#FFFFFF', '#8C6E38'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  };

  const handleConfirmSubmit = async (chosenStatus: RSVPStatus) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const finalDietary =
        dietaryRestrictions === 'Otro'
          ? customDietary || 'Otro régimen especial'
          : dietaryRestrictions;

      const updated = await GuestService.submitRSVP(guest.id, {
        status: chosenStatus,
        confirmedCompanions: chosenStatus === 'confirmed' ? confirmedCompanions : 0,
        companionName: chosenStatus === 'confirmed' && confirmedCompanions > 0 ? companionName : undefined,
        dietaryRestrictions: chosenStatus === 'confirmed' ? finalDietary : undefined,
        congratulationMessage: congratulationMessage.trim() || undefined,
      });

      setStatus(chosenStatus);
      setHasSubmitted(true);
      if (onUpdateSuccess) {
        onUpdateSuccess(updated);
      }

      if (chosenStatus === 'confirmed') {
        triggerCelebration();
      }
    } catch (err) {
      console.error('Error submitting RSVP', err);
      setErrorMsg('No pudimos guardar tu respuesta. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCalendar = () => {
    // 22 de Octubre 2026, 19:00 a 23:30 (UTC-3 Argentina)
    // 19:00 ART = 22:00 UTC
    const startTime = '20261022T220000Z';
    const endTime = '20261023T023000Z';
    const title = encodeURIComponent('DIVO 20 años — Vistiendo Momentos');
    const details = encodeURIComponent(
      'Celebración Aniversario 20 Años DIVO Trajes y Etiqueta.\nShow en Vivo + Desfile Exclusivo.\nDress Code: Gala (prendas Divo).'
    );
    const location = encodeURIComponent('Capilla Paseo del Buen Pastor, Hipólito Yrigoyen 325, Córdoba, Argentina');
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${location}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const handleOpenMaps = () => {
    window.open(
      'https://www.google.com/maps/search/?api=1&query=Capilla+Paseo+del+Buen+Pastor+Cordoba',
      '_blank'
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#FAF7F2] py-8 px-4 sm:px-6 flex flex-col justify-between items-center relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 bg-gradient-to-b from-[#C5A059]/10 to-transparent blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto relative z-10">
        {/* Top Header Logo */}
        <div className="text-center mb-8">
          <DivoLogo size="lg" showSubtext={true} showTapeMeasure={true} />
        </div>

        {/* Personalized Welcome Card */}
        <div className="bg-[#111111] border border-[#C5A059]/40 shadow-2xl p-6 sm:p-8 rounded-sm relative overflow-hidden">
          {/* Subtle gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent"></div>

          {/* Invitation Badge */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
            <div>
              <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold block">
                INVITACIÓN PERSONALIZADA
              </span>
              <h2 className="font-montserrat text-xl sm:text-2xl font-semibold text-white tracking-wide mt-1">
                {guest.firstName} {guest.lastName}
              </h2>
              {guest.tableOrSeat && (
                <span className="text-[11px] font-mono text-[#E7CF98]/80 block mt-0.5">
                  Ubicación sugerida: {guest.tableOrSeat}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="font-old-standard italic text-lg sm:text-xl text-[#C5A059] font-medium block">
                20 Años
              </span>
              <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase">
                {guest.token.substring(0, 8)}
              </span>
            </div>
          </div>

          {/* Event description quote */}
          <div className="my-5 text-center px-2">
            <p className="font-old-standard italic text-base sm:text-lg text-[#E7CF98] leading-relaxed">
              "Te invitamos a celebrar dos décadas de historia, evolución y estilo vistiendo los momentos más trascendentes de Córdoba."
            </p>
          </div>

          {/* Event Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6 text-left">
            <div className="bg-black/60 border border-white/5 p-3 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <span className="font-montserrat text-[8px] tracking-wider text-[#C5A059] uppercase block font-semibold">
                  Fecha
                </span>
                <span className="font-montserrat text-xs text-white font-medium">
                  22 de Octubre, 2026
                </span>
              </div>
            </div>

            <div className="bg-black/60 border border-white/5 p-3 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <span className="font-montserrat text-[8px] tracking-wider text-[#C5A059] uppercase block font-semibold">
                  Hora
                </span>
                <span className="font-montserrat text-xs text-white font-medium">
                  19:00 hs puntual
                </span>
              </div>
            </div>

            <div className="bg-black/60 border border-white/5 p-3 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <span className="font-montserrat text-[8px] tracking-wider text-[#C5A059] uppercase block font-semibold">
                  Lugar
                </span>
                <span className="font-montserrat text-xs text-white font-medium">
                  Capilla Buen Pastor
                </span>
                <span className="text-[9px] text-white/50 block">Córdoba</span>
              </div>
            </div>
          </div>

          {/* Dress Code & Program Notice */}
          <div className="p-3.5 bg-gradient-to-r from-[#181510] to-[#121212] border-l-2 border-[#C5A059] my-5 flex items-center justify-between gap-3">
            <div>
              <div className="font-montserrat text-[9px] tracking-widest text-[#C5A059] uppercase font-bold">
                Dress Code: Gala (Prendas Divo)
              </div>
              <div className="font-montserrat text-[11px] text-white/80 mt-0.5">
                Aniversario + Show en Vivo + Desfile Exclusivo de Alta Costura
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddToCalendar}
                className="px-2.5 py-1.5 bg-[#222222] hover:bg-[#333333] text-[#FAF7F2] border border-white/10 text-[10px] font-montserrat tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5"
                title="Añadir a Google Calendar"
              >
                <Calendar className="w-3 h-3 text-[#C5A059]" />
                <span className="hidden sm:inline">Agendar</span>
              </button>
              <button
                onClick={handleOpenMaps}
                className="px-2.5 py-1.5 bg-[#222222] hover:bg-[#333333] text-[#FAF7F2] border border-white/10 text-[10px] font-montserrat tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5"
                title="Abrir ubicación en Google Maps"
              >
                <MapPin className="w-3 h-3 text-[#C5A059]" />
                <span className="hidden sm:inline">Mapa</span>
              </button>
            </div>
          </div>

          {/* Current RSVP Status Banner if already answered */}
          {hasSubmitted && (
            <div
              className={`p-4 my-5 border rounded-none flex items-start gap-3 ${
                status === 'confirmed'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300'
              }`}
            >
              {status === 'confirmed' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
              )}
              <div className="text-left">
                <div className="font-montserrat text-xs tracking-wider uppercase font-bold">
                  {status === 'confirmed' ? '¡Asistencia Confirmada!' : 'Respuesta Registrada: No podrás asistir'}
                </div>
                <div className="font-montserrat text-xs text-white/80 mt-1">
                  {status === 'confirmed'
                    ? `Te esperamos el 22 de Octubre a las 19:00 hs. Pase registrado para ${1 + confirmedCompanions} persona(s).`
                    : 'Gracias por avisarnos. ¡Lamentamos no contar con tu presencia en esta ocasión!'}
                </div>
                {guest.respondedAt && (
                  <div className="font-mono text-[9px] text-white/40 mt-1">
                    Respondido el: {new Date(guest.respondedAt).toLocaleString('es-AR')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RSVP Interactive Form */}
          <div className="mt-6 pt-5 border-t border-white/10 text-left">
            <h3 className="font-montserrat text-xs tracking-[0.2em] text-[#C5A059] uppercase font-bold mb-4">
              {hasSubmitted ? 'Modificar o Actualizar Respuesta' : 'Confirma tu Asistencia'}
            </h3>

            {/* Companion Section if allowed */}
            {guest.companionsAllowed > 0 && (
              <div className="mb-5 p-3.5 bg-black/40 border border-white/10">
                <label className="flex items-center justify-between text-xs font-montserrat font-medium text-white mb-2">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#C5A059]" />
                    ¿Vendrás con acompañante?
                  </span>
                  <span className="text-[10px] text-[#C5A059] font-mono">
                    (Máx. {guest.companionsAllowed})
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-montserrat cursor-pointer">
                    <input
                      type="radio"
                      name="companions"
                      checked={confirmedCompanions === 0}
                      onChange={() => setConfirmedCompanions(0)}
                      className="accent-[#C5A059]"
                    />
                    <span>Asistiré solo/a</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-montserrat cursor-pointer">
                    <input
                      type="radio"
                      name="companions"
                      checked={confirmedCompanions === 1}
                      onChange={() => setConfirmedCompanions(1)}
                      className="accent-[#C5A059]"
                    />
                    <span>Asistiré con 1 acompañante</span>
                  </label>
                </div>

                {confirmedCompanions > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <label className="block text-[11px] font-montserrat text-white/70 mb-1">
                      Nombre y Apellido del Acompañante:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Laura Gómez"
                      value={companionName}
                      onChange={(e) => setCompanionName(e.target.value)}
                      className="w-full bg-[#181818] border border-white/20 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Dietary restrictions */}
            <div className="mb-5">
              <label className="flex items-center gap-1.5 text-xs font-montserrat font-medium text-white mb-2">
                <Utensils className="w-3.5 h-3.5 text-[#C5A059]" />
                Preferencia o restricción alimentaria:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Sin restricciones', 'Vegetariano', 'Celíaco (Sin TACC)', 'Otro'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDietaryRestrictions(option)}
                    className={`py-2 px-2.5 text-[11px] font-montserrat text-center border transition-all ${
                      dietaryRestrictions === option
                        ? 'bg-[#C5A059] text-black font-semibold border-[#C5A059]'
                        : 'bg-[#181818] text-white/80 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {dietaryRestrictions === 'Otro' && (
                <input
                  type="text"
                  placeholder="Por favor indícanos tu requerimiento (vegano, intolerancias, etc.)"
                  value={customDietary}
                  onChange={(e) => setCustomDietary(e.target.value)}
                  className="w-full mt-2 bg-[#181818] border border-white/20 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]"
                />
              )}
            </div>

            {/* Congratulatory note */}
            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-xs font-montserrat font-medium text-white mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#C5A059]" />
                Mensaje de felicitación para DIVO en sus 20 años (opcional):
              </label>
              <textarea
                rows={2}
                placeholder="Dedícale unas palabras a Pablo y al equipo de Divo Trajes..."
                value={congratulationMessage}
                onChange={(e) => setCongratulationMessage(e.target.value)}
                className="w-full bg-[#181818] border border-white/20 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059] resize-none"
              />
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Decision Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Confirmo mi Asistencia */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleConfirmSubmit('confirmed')}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#C5A059] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9c7b41] text-black font-montserrat text-xs tracking-wider uppercase font-bold shadow-lg transition-all transform active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>
                  {isSubmitting ? 'Guardando...' : 'Confirmo mi asistencia'}
                </span>
              </button>

              {/* No podré asistir */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleConfirmSubmit('declined')}
                className="w-full py-3.5 px-4 bg-transparent hover:bg-white/5 border border-white/20 text-[#FAF7F2]/70 hover:text-white font-montserrat text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>No podré asistir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Access Instructions note */}
        <div className="mt-6 text-center text-[11px] text-white/50 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Presenta tu código QR o invitación digital en el ingreso de la Capilla.</span>
          </p>
          <p>
            Divo Trajes y Etiqueta — Córdoba, Argentina. Celebrando 20 años de excelencia.
          </p>
        </div>

        {/* Quick link back to admin panel if user is host/operator */}
        {onGoToAdmin && (
          <div className="mt-8 text-center">
            <button
              onClick={onGoToAdmin}
              className="text-xs font-montserrat text-[#C5A059]/70 hover:text-[#C5A059] underline underline-offset-4 tracking-wider uppercase"
            >
              ← Volver al Panel de Administración y Escáner
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
