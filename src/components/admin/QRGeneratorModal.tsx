import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import {
  QrCode,
  Download,
  Archive,
  FileText,
  Search,
  Share2,
  Eye,
  UserPlus,
  Check,
  Copy,
  Sparkles,
  Edit2
} from 'lucide-react';
import { Guest, GuestCategory } from '../../types/guest';
import { GuestService, QRContentMode } from '../../services/guestService';
import { generateQRDataUrl, renderInvitationCardToDataUrl } from '../../utils/qrCardRenderer';

interface QRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  guests: Guest[];
  onSelectGuestForCard: (guest: Guest) => void;
  onEditGuest?: (guest: Guest) => void;
}

const GuestQRItem: React.FC<{
  guest: Guest;
  qrMode: QRContentMode;
  onOpenFullCard: (g: Guest) => void;
  onEditGuest?: (g: Guest) => void;
}> = ({ guest, qrMode, onOpenFullCard, onEditGuest }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [copied, setCopied] = useState(false);

  const qrPayload = GuestService.getQRPayload(guest, qrMode);
  const rsvpUrl = GuestService.getRSVPUrl(guest);
  const waUrl = GuestService.getWhatsAppShareUrl(guest);

  useEffect(() => {
    let active = true;
    generateQRDataUrl(qrPayload, 440, 3).then((url) => {
      if (active && url) setQrUrl(url);
    });
    return () => {
      active = false;
    };
  }, [qrPayload]);

  const handleDownloadQrPng = async () => {
    const highRes = (await generateQRDataUrl(qrPayload, 900, 4)) || qrUrl;
    if (!highRes) return;
    const a = document.createElement('a');
    a.href = highRes;
    a.download = `QR-${guest.lastName || ''}-${guest.firstName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadFullCardPng = async () => {
    setIsDownloadingCard(true);
    try {
      const cardDataUrl = await renderInvitationCardToDataUrl(guest, qrMode);
      const a = document.createElement('a');
      a.href = cardDataUrl;
      a.download = `Tarjeta-QR-DIVO-${guest.lastName || ''}-${guest.firstName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsDownloadingCard(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#161616] border border-[#C5A059]/30 hover:border-[#C5A059] p-3.5 rounded-sm flex flex-col items-center text-center justify-between transition-all shadow-md">
      <div className="w-full flex items-center justify-between text-[9px] font-mono text-white/50 mb-2">
        <span className="px-1.5 py-0.5 bg-[#C5A059]/15 text-[#E7CF98] border border-[#C5A059]/30 uppercase">
          {guest.category}
        </span>
        <span>{guest.token.substring(0, 9)}</span>
      </div>

      {/* QR Image Box */}
      <div
        onClick={() => onOpenFullCard(guest)}
        className="bg-white p-2 rounded-sm border border-[#C5A059] shadow-sm cursor-pointer group relative"
        title="Clic para abrir tarjeta completa"
      >
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`QR ${guest.firstName} ${guest.lastName}`}
            className="w-28 h-28 block mx-auto"
          />
        ) : (
          <div className="w-28 h-28 bg-neutral-200 animate-pulse flex items-center justify-center text-[10px] text-black">
            Generando...
          </div>
        )}
      </div>

      {/* Guest Info */}
      <div className="mt-2.5 w-full">
        <div className="flex items-center justify-center gap-1">
          <div className="font-montserrat font-bold text-xs text-white truncate">
            {guest.firstName} {guest.lastName}
          </div>
          {onEditGuest && (
            <button
              type="button"
              onClick={() => onEditGuest(guest)}
              className="text-[#C5A059] hover:text-white p-0.5 transition-colors cursor-pointer shrink-0"
              title="Editar datos del invitado"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="text-[10px] text-white/50 font-montserrat mt-0.5">
          {guest.companionsAllowed > 0
            ? `Titular + ${guest.companionsAllowed} acomp.`
            : 'Individual'}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="w-full mt-3 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={handleDownloadQrPng}
          className="py-1.5 px-2 bg-[#222222] hover:bg-[#C5A059] text-white hover:text-black font-montserrat text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Descargar imagen PNG solo del código QR"
        >
          <QrCode className="w-3 h-3" />
          <span>Bajar QR</span>
        </button>

        <button
          type="button"
          disabled={isDownloadingCard}
          onClick={handleDownloadFullCardPng}
          className="py-1.5 px-2 bg-[#C5A059]/20 hover:bg-[#C5A059] text-[#E7CF98] hover:text-black border border-[#C5A059]/50 font-montserrat text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Descargar Tarjeta Digital completa con QR en PNG"
        >
          <Download className="w-3 h-3" />
          <span>{isDownloadingCard ? '...' : 'Tarjeta'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenFullCard(guest)}
          className="py-1.5 px-2 bg-white/5 hover:bg-white/15 text-white/80 font-montserrat text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Eye className="w-3 h-3 text-[#C5A059]" />
          <span>Ver</span>
        </button>

        <div className="flex gap-1">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-black font-montserrat text-[10px] font-bold uppercase flex items-center justify-center transition-colors"
            title="Enviar por WhatsApp"
          >
            <Share2 className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-1.5 bg-white/5 hover:bg-white/20 text-[#C5A059] flex items-center justify-center transition-colors cursor-pointer"
            title="Copiar link del QR"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export const QRGeneratorModal: React.FC<QRGeneratorModalProps> = ({
  isOpen,
  onClose,
  guests,
  onSelectGuestForCard,
  onEditGuest,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [qrMode, setQrMode] = useState<QRContentMode>(() => GuestService.getQRMode());

  // Express Quick QR Generator State
  const [quickFullName, setQuickFullName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCategory, setQuickCategory] = useState<GuestCategory>('Invitado General');
  const [quickCompanions, setQuickCompanions] = useState<number>(1);
  const [justCreatedGuest, setJustCreatedGuest] = useState<Guest | null>(null);

  // Batch Export State
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChangeQrMode = (mode: QRContentMode) => {
    setQrMode(mode);
    GuestService.setQRMode(mode);
  };

  const filteredGuests = guests.filter((g) => {
    const matchesSearch = `${g.firstName} ${g.lastName} ${g.token} ${g.category}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || g.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleQuickGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickFullName.trim();
    if (!cleaned) return;

    const parts = cleaned.split(/\s+/);
    const firstName = parts[0] || 'Invitado';
    const lastName = parts.slice(1).join(' ') || '';

    const created = await GuestService.addGuest({
      firstName,
      lastName,
      phone: quickPhone.trim() || undefined,
      category: quickCategory,
      companionsAllowed: quickCompanions,
      status: 'confirmed',
      confirmedCompanions: quickCompanions,
    });

    setQuickFullName('');
    setQuickPhone('');
    setJustCreatedGuest(created);
  };

  // 1. Download ZIP of all QR codes (PNGs)
  const handleDownloadAllQRsZip = async () => {
    if (filteredGuests.length === 0) return;
    setBatchProgress(`Generando ${filteredGuests.length} códigos QR...`);
    try {
      const zip = new JSZip();
      const folder = zip.folder('Codigos-QR-DIVO-20-Anos');

      for (let i = 0; i < filteredGuests.length; i++) {
        const g = filteredGuests[i];
        setBatchProgress(`Generando QR ${i + 1} de ${filteredGuests.length}...`);
        const qrPayload = GuestService.getQRPayload(g, qrMode);
        const dataUrl = await generateQRDataUrl(qrPayload, 900, 4);
        if (dataUrl && dataUrl.includes(',')) {
          const base64 = dataUrl.split(',')[1];
          const safeName = `${g.firstName}-${g.lastName || ''}`
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_');
          folder?.file(`QR-${i + 1}-${safeName}.png`, base64, { base64: true });
        }
      }

      setBatchProgress('Empaquetando archivo ZIP...');
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `Codigos-QR-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('Error generating QR ZIP:', err);
    } finally {
      setBatchProgress(null);
    }
  };

  // 2. Download ZIP of all complete Luxury Invitation Cards with QR (PNGs)
  const handleDownloadAllCardsZip = async () => {
    if (filteredGuests.length === 0) return;
    setBatchProgress(`Diseñando ${filteredGuests.length} tarjetas con QR...`);
    try {
      const zip = new JSZip();
      const folder = zip.folder('Tarjetas-Con-QR-DIVO-20-Anos');

      for (let i = 0; i < filteredGuests.length; i++) {
        const g = filteredGuests[i];
        setBatchProgress(`Generando tarjeta ${i + 1} de ${filteredGuests.length} (${g.firstName})...`);
        const cardDataUrl = await renderInvitationCardToDataUrl(g, qrMode);
        if (cardDataUrl && cardDataUrl.includes(',')) {
          const base64 = cardDataUrl.split(',')[1];
          const safeName = `${g.firstName}-${g.lastName || ''}`
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_');
          folder?.file(`Invitacion-DIVO-${i + 1}-${safeName}.png`, base64, { base64: true });
        }
      }

      setBatchProgress('Descargando archivo ZIP...');
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `Tarjetas-QR-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('Error generating Cards ZIP:', err);
    } finally {
      setBatchProgress(null);
    }
  };

  // 3. Download Multi-Page Printable PDF of all Cards with QR
  const handleDownloadBatchPdf = async () => {
    if (filteredGuests.length === 0) return;
    setBatchProgress(`Armando catálogo PDF con ${filteredGuests.length} tarjetas...`);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [120, 195],
      });

      for (let i = 0; i < filteredGuests.length; i++) {
        const g = filteredGuests[i];
        setBatchProgress(`Renderizando página ${i + 1} de ${filteredGuests.length} (${g.firstName})...`);
        if (i > 0) {
          pdf.addPage([120, 195], 'portrait');
        }
        const cardDataUrl = await renderInvitationCardToDataUrl(g, qrMode);
        pdf.addImage(cardDataUrl, 'PNG', 0, 0, 120, 195);
      }

      pdf.save(`Lote-Tarjetas-QR-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error generating batch PDF:', err);
    } finally {
      setBatchProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#121212] border-2 border-[#C5A059] max-w-6xl w-full p-6 rounded-sm shadow-2xl relative text-left my-8 max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C5A059] text-black">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-montserrat text-base sm:text-lg tracking-[0.15em] text-[#C5A059] uppercase font-bold">
                Centro Generador de Códigos QR & Tarjetas
              </h3>
              <p className="text-xs text-white/60 font-montserrat">
                Generá un nuevo QR al instante o descargá en lote todos los códigos QR y tarjetas de tus invitados ({filteredGuests.length} activos).
              </p>
            </div>
          </div>

          {/* Bulk Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(batchProgress) || filteredGuests.length === 0}
              onClick={handleDownloadAllCardsZip}
              className="py-2 px-3.5 bg-gradient-to-r from-[#C5A059] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9a783e] text-black font-montserrat text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              title="Descargar un archivo ZIP con todas las tarjetas completas con QR en formato imagen PNG"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>ZIP Tarjetas con QR ({filteredGuests.length})</span>
            </button>

            <button
              type="button"
              disabled={Boolean(batchProgress) || filteredGuests.length === 0}
              onClick={handleDownloadAllQRsZip}
              className="py-2 px-3 bg-[#1d1d1d] hover:bg-[#2a2a2a] border border-[#C5A059]/60 text-[#E7CF98] font-montserrat text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Descargar un archivo ZIP únicamente con los códigos QR individuales en alta resolución"
            >
              <QrCode className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>ZIP Solo QRs</span>
            </button>

            <button
              type="button"
              disabled={Boolean(batchProgress) || filteredGuests.length === 0}
              onClick={handleDownloadBatchPdf}
              className="py-2 px-3 bg-[#1d1d1d] hover:bg-[#2a2a2a] border border-white/20 text-white font-montserrat text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Descargar un único archivo PDF multipágina con todas las tarjetas y QRs listas para imprimir"
            >
              <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>PDF Imprimible</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white font-mono text-sm cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Batch Progress Banner */}
        {batchProgress && (
          <div className="my-3 p-3 bg-[#C5A059]/20 border border-[#C5A059] text-[#E7CF98] text-xs font-montserrat font-bold flex items-center justify-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 text-[#C5A059]" />
            <span>{batchProgress}</span>
          </div>
        )}

        {/* Instant Single QR Generator Bar */}
        <form
          onSubmit={handleQuickGenerateQR}
          className="my-4 p-3.5 bg-[#181818] border border-[#C5A059]/40 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-xs font-montserrat font-bold text-[#C5A059] uppercase tracking-wider shrink-0">
            <UserPlus className="w-4 h-4" />
            <span>Generador Rápido de QR:</span>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              value={quickFullName}
              onChange={(e) => setQuickFullName(e.target.value)}
              placeholder="Nombre y Apellido (Ej: Juan Pérez)"
              className="sm:col-span-2 bg-[#101010] border border-white/20 px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#C5A059]"
            />
            <input
              type="text"
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              placeholder="WhatsApp (Opcional)"
              className="bg-[#101010] border border-white/20 px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#C5A059]"
            />
            <div className="flex gap-1.5">
              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value as GuestCategory)}
                className="flex-1 bg-[#101010] border border-white/20 px-2 py-2 text-xs text-[#E7CF98] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="Invitado General">General</option>
                <option value="VIP">VIP</option>
                <option value="Prensa">Prensa</option>
                <option value="Cliente Distinguido">Cliente</option>
                <option value="Familia & Amigos">Familia</option>
                <option value="Staff">Staff</option>
              </select>
              <select
                value={quickCompanions}
                onChange={(e) => setQuickCompanions(Number(e.target.value))}
                className="w-16 bg-[#101010] border border-white/20 px-1.5 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                title="Acompañantes permitidos"
              >
                <option value={0}>Solo</option>
                <option value={1}>+1</option>
                <option value={2}>+2</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="py-2 px-4 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Crear & Generar QR</span>
          </button>
        </form>

        {/* Banner if a guest was just created */}
        {justCreatedGuest && (
          <div className="mb-3 p-3 bg-emerald-950/60 border border-emerald-500/60 flex items-center justify-between gap-3">
            <div className="text-xs font-montserrat text-emerald-200">
              ✓ Código QR generado para{' '}
              <strong className="text-white">
                {justCreatedGuest.firstName} {justCreatedGuest.lastName}
              </strong>{' '}
              (Token: <span className="font-mono">{justCreatedGuest.token}</span>)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectGuestForCard(justCreatedGuest);
                }}
                className="py-1 px-3 bg-[#C5A059] text-black font-montserrat text-[11px] font-bold uppercase cursor-pointer"
              >
                Abrir Tarjeta Grande
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedGuest(null)}
                className="text-white/50 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Filter & QR Mode Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-3">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar QR por nombre o código..."
              className="w-full bg-[#1a1a1a] border border-white/15 pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-[#C5A059] font-montserrat font-bold uppercase">
              Modo de QR:
            </span>
            <select
              value={qrMode}
              onChange={(e) => handleChangeQrMode(e.target.value as QRContentMode)}
              className="bg-[#1a1a1a] border border-[#C5A059]/60 px-2.5 py-1.5 text-xs text-[#E7CF98] font-montserrat font-semibold focus:outline-none focus:border-[#C5A059]"
              title="Elige qué muestra el código QR al escanearlo con cualquier celular"
            >
              <option value="pass">
                ✓ Credencial Oficial de Puerta (Sin errores en cualquier cámara)
              </option>
              <option value="whatsapp">
                💬 Pase Directo por WhatsApp (Abre pase en el celular)
              </option>
              <option value="url">
                🌐 Enlace Web RSVP (Para dominio propio o app publicada)
              </option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#1a1a1a] border border-white/15 px-2.5 py-1.5 text-xs text-[#FAF7F2] font-montserrat focus:outline-none focus:border-[#C5A059]"
            >
              <option value="all">Todas las categorías ({guests.length})</option>
              <option value="VIP">VIP</option>
              <option value="Prensa">Prensa</option>
              <option value="Cliente Distinguido">Cliente Distinguido</option>
              <option value="Familia & Amigos">Familia & Amigos</option>
              <option value="Staff">Staff</option>
              <option value="Invitado General">Invitado General</option>
            </select>
          </div>
        </div>

        {/* Scrollable Grid of Generated QRs */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0 max-h-[50vh]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredGuests.map((guest) => (
              <GuestQRItem
                key={guest.id}
                guest={guest}
                qrMode={qrMode}
                onOpenFullCard={(g) => {
                  onClose();
                  onSelectGuestForCard(g);
                }}
                onEditGuest={onEditGuest}
              />
            ))}
          </div>

          {filteredGuests.length === 0 && (
            <div className="py-12 text-center text-white/40 font-montserrat text-xs">
              No se encontraron invitados con ese filtro.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
