import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, Share2, Copy, Check, Calendar, MapPin, Sparkles, Shirt } from 'lucide-react';
import { Guest } from '../../types/guest';
import { DivoLogo } from '../brand/DivoLogo';
import { GuestService } from '../../services/guestService';

interface InvitationCardProps {
  guest: Guest;
  showActions?: boolean;
  onSelectForEdit?: (guest: Guest) => void;
  scale?: number;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  guest,
  showActions = true,
  scale = 1,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const rsvpUrl = GuestService.getRSVPUrl(guest);
  const waUrl = GuestService.getWhatsAppShareUrl(guest);

  useEffect(() => {
    // Generate QR code for the specific guest's unique link
    QRCode.toDataURL(rsvpUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR', err));
  }, [rsvpUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(rsvpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2.5,
        backgroundColor: '#0a0a0a',
      });
      const link = document.createElement('a');
      link.download = `Invitacion-Divo-20-Anos-${guest.lastName}-${guest.firstName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });
      
      // Vertical A5 or standard luxury card format
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [120, 195],
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, 120, 195);
      pdf.save(`Invitacion-Divo-20-Anos-${guest.lastName}-${guest.firstName}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* The Printable / Exportable Invitation Card */}
      <div
        ref={cardRef}
        id={`invitation-card-${guest.id}`}
        style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }}
        className="relative w-[340px] sm:w-[380px] h-[600px] sm:h-[640px] bg-[#0d0d0d] text-[#FAF7F2] p-6 sm:p-7 rounded-sm shadow-2xl flex flex-col justify-between overflow-hidden border border-[#C5A059]/40 select-none print-card-only transition-transform duration-300"
      >
        {/* Luxury subtle background glow & texture */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        {/* Subtle decorative damask corner accents */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-[#C5A059]/40 pointer-events-none"></div>
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[#C5A059]/40 pointer-events-none"></div>
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[#C5A059]/40 pointer-events-none"></div>
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-[#C5A059]/40 pointer-events-none"></div>

        {/* Ambient top-left gold shimmer */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#C5A059]/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* TOP SECTION: "INVITACION ESPECIAL" and QR CODE (Matching Slide 7 layout) */}
        <div className="relative z-10 flex justify-between items-start gap-3">
          {/* Left Title block with vertical bar */}
          <div className="flex items-stretch gap-2.5 pt-1">
            <div className="w-[1.5px] bg-[#C5A059] rounded-full"></div>
            <div className="flex flex-col">
              <span className="font-montserrat text-[9px] sm:text-[10px] tracking-[0.28em] text-[#C5A059] uppercase font-semibold">
                INVITACIÓN ESPECIAL
              </span>
              <span className="font-montserrat text-[12px] sm:text-[13px] tracking-wider text-white font-medium mt-0.5">
                {guest.firstName} {guest.lastName}
              </span>
              <span className="font-montserrat text-[7.5px] tracking-[0.18em] text-[#FAF7F2]/60 uppercase mt-0.5">
                {guest.companionsAllowed > 0
                  ? `Pase: Titular + ${guest.companionsAllowed} Acompañante`
                  : 'Pase Exclusivo Individual'}
              </span>
              {guest.category && guest.category !== 'Invitado General' && (
                <span className="inline-block mt-1 self-start px-1.5 py-[1px] bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E7CF98] text-[7px] font-mono tracking-widest uppercase">
                  {guest.category}
                </span>
              )}
            </div>
          </div>

          {/* Right QR Code with clean luxury framing */}
          <div className="flex flex-col items-center bg-white p-1.5 rounded-sm shadow-md border border-[#C5A059]/60 shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Invitación ${guest.firstName} ${guest.lastName}`}
                className="w-16 h-16 sm:w-[72px] sm:h-[72px] block"
              />
            ) : (
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] bg-neutral-200 animate-pulse"></div>
            )}
            <span className="font-mono text-[6px] tracking-tighter text-black font-semibold mt-0.5 uppercase">
              {guest.token.substring(0, 10)}
            </span>
          </div>
        </div>

        {/* MIDDLE SECTION: "20 años" + "VISTIENDO MOMENTOS" (Slide 7 dominant typography) */}
        <div className="relative z-10 my-auto py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-old-standard text-5xl sm:text-6xl font-bold text-[#C5A059] leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(197,160,89,0.2)]">
              20
            </span>
            <span className="font-old-standard italic text-3xl sm:text-4xl text-[#C5A059] leading-none">
              años
            </span>
          </div>
          
          <div className="mt-1">
            <span className="font-montserrat text-[8.5px] sm:text-[9.5px] tracking-[0.38em] text-[#FAF7F2] uppercase font-medium block">
              VISTIENDO MOMENTOS
            </span>
          </div>

          {/* Event Details (Date, Location, Dress Code) */}
          <div className="mt-5 space-y-2 border-l border-[#C5A059]/30 pl-3">
            <div>
              <div className="font-montserrat text-[8px] tracking-[0.2em] text-[#C5A059] uppercase font-semibold">
                Lugar
              </div>
              <div className="font-montserrat text-[10px] sm:text-[11px] tracking-wider text-white font-medium">
                CAPILLA PASEO DEL BUEN PASTOR
              </div>
              <div className="font-montserrat text-[8px] text-white/50">
                Córdoba Capital, Argentina
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div>
                <div className="font-montserrat text-[8px] tracking-[0.2em] text-[#C5A059] uppercase font-semibold">
                  Fecha
                </div>
                <div className="font-montserrat text-[10px] sm:text-[11px] tracking-wider text-white font-medium">
                  22 DE OCTUBRE
                </div>
              </div>
              <div className="w-[1px] h-6 bg-white/20"></div>
              <div>
                <div className="font-montserrat text-[8px] tracking-[0.2em] text-[#C5A059] uppercase font-semibold">
                  Hora
                </div>
                <div className="font-montserrat text-[10px] sm:text-[11px] tracking-wider text-white font-medium">
                  19:00 HS
                </div>
              </div>
            </div>

            {/* Dress code badge (Slide 7: DRESS CODE: GALA PRENDAS DIVO) */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none border border-[#C5A059]/70 bg-gradient-to-r from-[#C5A059]/10 to-transparent">
                <Shirt className="w-3 h-3 text-[#C5A059]" />
                <span className="font-montserrat text-[7.5px] sm:text-[8px] tracking-[0.22em] text-[#E7CF98] uppercase font-semibold">
                  DRESS CODE: GALA (PRENDAS DIVO)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Show en Vivo + Logo DIVO at the foot */}
        <div className="relative z-10 pt-3 border-t border-white/10 flex flex-col items-center">
          <div className="mb-2 text-center">
            <span className="font-montserrat text-[7px] sm:text-[8px] tracking-[0.3em] text-[#FAF7F2]/80 uppercase font-medium block">
              SHOW EN VIVO — DESFILE EXCLUSIVO
            </span>
          </div>

          <DivoLogo
            size="card-foot"
            showSubtext={false}
            showTapeMeasure={true}
            className="w-full"
          />
        </div>
      </div>

      {/* Action Buttons underneath card (Share WhatsApp, Download PNG, PDF, Copy Link) */}
      {showActions && (
        <div className="w-full max-w-[380px] mt-4 flex flex-col gap-2 no-print">
          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp Direct Share */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#25D366]/90 hover:bg-[#25D366] text-black font-montserrat text-xs font-semibold tracking-wider uppercase transition-colors shadow-sm"
              title="Compartir invitación por WhatsApp con mensaje cordial personalizado"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>

            {/* Copy RSVP Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#1c1c1c] hover:bg-[#282828] text-[#FAF7F2] border border-[#C5A059]/40 font-montserrat text-xs font-medium tracking-wider uppercase transition-colors"
              title="Copiar enlace de confirmación para este invitado"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#C5A059]" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Link'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Download Image (PNG) */}
            <button
              onClick={handleDownloadPng}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-[#141414] hover:bg-[#222222] text-[#FAF7F2]/90 border border-white/10 font-montserrat text-[11px] font-medium tracking-wider transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>{isExporting ? 'Generando...' : 'Descargar PNG'}</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-[#141414] hover:bg-[#222222] text-[#FAF7F2]/90 border border-white/10 font-montserrat text-[11px] font-medium tracking-wider transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Descargar PDF</span>
            </button>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-black/40 border border-white/5 text-neutral-400 font-mono">
            <span>Estado RSVP:</span>
            <span
              className={
                guest.status === 'confirmed'
                  ? 'text-emerald-400 font-bold'
                  : guest.status === 'declined'
                  ? 'text-rose-400 font-bold'
                  : 'text-amber-400 font-bold'
              }
            >
              {guest.status === 'confirmed'
                ? `CONFIRMADO (${1 + (guest.confirmedCompanions || 0)} pers.)`
                : guest.status === 'declined'
                ? 'NO ASISTE'
                : 'PENDIENTE'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
