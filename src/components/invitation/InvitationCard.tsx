import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Download, Share2, Copy, Check, QrCode as QrCodeIcon, Shirt, Edit2 } from 'lucide-react';
import { Guest } from '../../types/guest';
import { DivoLogo } from '../brand/DivoLogo';
import { GuestService } from '../../services/guestService';
import { generateQRDataUrl, renderInvitationCardToDataUrl } from '../../utils/qrCardRenderer';

interface InvitationCardProps {
  guest: Guest;
  showActions?: boolean;
  onSelectForEdit?: (guest: Guest) => void;
  scale?: number;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  guest,
  showActions = true,
  onSelectForEdit,
  scale = 1,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const qrPayload = GuestService.getQRPayload(guest);
  const rsvpUrl = GuestService.getRSVPUrl(guest);
  const waUrl = GuestService.getWhatsAppShareUrl(guest);

  useEffect(() => {
    let mounted = true;
    generateQRDataUrl(qrPayload, 440, 3).then((url) => {
      if (mounted && url) setQrDataUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [qrPayload]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(rsvpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadOnlyQr = async () => {
    try {
      const highResQr = (await generateQRDataUrl(qrPayload, 900, 4)) || qrDataUrl;
      if (!highResQr) return;
      const link = document.createElement('a');
      link.download = `QR-DIVO-20-Anos-${guest.lastName || ''}-${guest.firstName}.png`;
      link.href = highResQr;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading QR only', err);
    }
  };

  const handleDownloadPng = async () => {
    try {
      setIsExporting(true);
      const dataUrl = await renderInvitationCardToDataUrl(guest);
      const fileName = `Invitacion-Divo-20-Anos-${guest.lastName || ''}-${guest.firstName}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      const dataUrl = await renderInvitationCardToDataUrl(guest);

      // Vertical A5 or standard luxury card format
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [120, 195],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 120, 195);
      pdf.save(`Invitacion-Divo-20-Anos-${guest.lastName || ''}-${guest.firstName}.pdf`);
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
                {guest.status === 'confirmed'
                  ? guest.confirmedCompanions > 0
                    ? `Pase: Titular + ${guest.confirmedCompanions} (${guest.companionName || 'Acompañante'})`
                    : 'Pase Exclusivo Individual'
                  : guest.companionsAllowed > 0
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

          {/* Right QR Code with clean luxury framing and optimal quiet zone for cameras */}
          <div className="flex flex-col items-center bg-white p-2 rounded-sm shadow-md border border-[#C5A059]/70 shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Invitación ${guest.firstName} ${guest.lastName}`}
                className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] block"
              />
            ) : (
              <div className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] bg-neutral-200 animate-pulse"></div>
            )}
            <span className="font-mono text-[7px] tracking-tight text-black font-bold mt-1 uppercase">
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

            {/* Dress code badge */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none border border-[#C5A059]/70 bg-gradient-to-r from-[#C5A059]/10 to-transparent">
                <Shirt className="w-3 h-3 text-[#C5A059]" />
                <span className="font-montserrat text-[7.5px] sm:text-[8px] tracking-[0.22em] text-[#E7CF98] uppercase font-semibold">
                  DRESS CODE: ELEGANTE
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
        <div className="w-full max-w-[380px] mt-4 flex flex-col gap-2.5 no-print">
          {/* Primary Download Button (PNG Image for mobile photos / desktop) */}
          <button
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-[#C5A059] via-[#E7CF98] to-[#C5A059] hover:from-[#d4af37] hover:to-[#b89344] text-black font-montserrat text-xs font-bold tracking-wider uppercase shadow-xl transition-all transform active:scale-98 disabled:opacity-50 cursor-pointer"
            title="Descargar imagen en alta resolución para guardar en el celular"
          >
            <Download className="w-4 h-4 text-black shrink-0" />
            <span>{isExporting ? 'Generando invitación...' : 'Descargar Tarjeta con QR (Imagen)'}</span>
          </button>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Download Only QR */}
            <button
              onClick={handleDownloadOnlyQr}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#161616] hover:bg-[#242424] text-[#FAF7F2] border border-[#C5A059]/40 font-montserrat text-[11px] font-medium tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer"
              title="Descargar únicamente el código QR en alta resolución (PNG)"
            >
              <QrCodeIcon className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Solo QR</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#161616] hover:bg-[#242424] text-[#FAF7F2] border border-[#C5A059]/40 font-montserrat text-[11px] font-medium tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer"
              title="Descargar en formato PDF listo para imprimir o guardar"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>PDF</span>
            </button>

            {/* WhatsApp Direct Share */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#25D366]/90 hover:bg-[#25D366] text-black font-montserrat text-[11px] font-semibold tracking-wider uppercase transition-colors shadow-sm"
              title="Compartir invitación por WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Copy link option & Edit Guest */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyLink}
                className="text-[11px] font-montserrat text-white/60 hover:text-[#C5A059] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copiar enlace web de esta invitación"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#C5A059]" />}
                <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace digital'}</span>
              </button>

              {onSelectForEdit && (
                <button
                  onClick={() => onSelectForEdit(guest)}
                  className="text-[11px] font-montserrat text-[#C5A059] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  title="Editar datos de este invitado"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Editar datos</span>
                </button>
              )}
            </div>

            {/* Status Pill */}
            <div className="text-[10px] text-neutral-400 font-mono">
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
                  ? `✓ CONFIRMADO (${1 + (guest.confirmedCompanions || 0)} pers.)`
                  : guest.status === 'declined'
                  ? '✕ NO ASISTE'
                  : '⏳ PENDIENTE'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
