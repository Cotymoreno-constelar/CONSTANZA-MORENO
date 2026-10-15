import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageCircle,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  CheckCircle2,
  Clock,
  Download,
  Copy,
  Check,
  Send,
  Sparkles,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Info,
  Code,
  ShieldCheck,
  Zap,
  Edit2
} from 'lucide-react';
import { Guest, GuestCategory } from '../../types/guest';
import { GuestService } from '../../services/guestService';
import {
  cleanAndFormatPhoneNumber,
  buildWhatsAppUrl,
  openWhatsAppInSingleTab,
  generateVCardFile,
  generateWhatsAppWebConsoleScript,
} from '../../utils/whatsappUtils';

interface WhatsAppAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  guests: Guest[];
  onEditGuest?: (guest: Guest) => void;
}

type DispatchTab = 'runner' | 'broadcast' | 'webhook' | 'script';
type MessageType = 'invitation' | 'reminder';

export const WhatsAppAutomationModal: React.FC<WhatsAppAutomationModalProps> = ({
  isOpen,
  onClose,
  guests,
  onEditGuest,
}) => {
  const [activeTab, setActiveTab] = useState<DispatchTab>('runner');
  const [messageType, setMessageType] = useState<MessageType>('invitation');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyPending, setOnlyPending] = useState(true);

  // Runner State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(6);
  const [countdown, setCountdown] = useState(6);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedBroadcastText, setCopiedBroadcastText] = useState(false);
  const [selectedAltPhone, setSelectedAltPhone] = useState<string | null>(null);

  // Inline Phone Edit for missing phone
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  // Webhook background dispatch state
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem('divo_wa_webhook_url') || '';
    } catch {
      return '';
    }
  });
  const [webhookToken, setWebhookToken] = useState(() => {
    try {
      return localStorage.getItem('divo_wa_webhook_token') || '';
    } catch {
      return '';
    }
  });
  const [isSimulatingApi, setIsSimulatingApi] = useState(true);
  const [isBackgroundSending, setIsBackgroundSending] = useState(false);
  const [backgroundProgress, setBackgroundProgress] = useState(0);
  const [backgroundLogs, setBackgroundLogs] = useState<string[]>([]);

  const timerRef = useRef<any>(null);

  // Filtered queue of guests
  const queue = useMemo(() => {
    return guests.filter((g) => {
      const matchCat = categoryFilter === 'all' || g.category === categoryFilter;
      const matchPending = onlyPending ? !g.whatsappSent : true;
      return matchCat && matchPending;
    });
  }, [guests, categoryFilter, onlyPending]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = guests.length;
    let withPhone = 0;
    let withoutPhone = 0;
    let sentCount = 0;

    guests.forEach((g) => {
      const p = cleanAndFormatPhoneNumber(g.phone);
      if (p.isValid) {
        withPhone++;
      } else {
        withoutPhone++;
      }
      if (g.whatsappSent) {
        sentCount++;
      }
    });

    return {
      total,
      withPhone,
      withoutPhone,
      sentCount,
      pendingCount: total - sentCount,
    };
  }, [guests]);

  // Current active guest in queue
  const currentGuest: Guest | undefined = queue[currentIndex] || queue[0];
  const currentPhoneData = useMemo(() => {
    return cleanAndFormatPhoneNumber(selectedAltPhone || currentGuest?.phone);
  }, [currentGuest, selectedAltPhone]);

  // Reset selected alt phone when switching guest
  useEffect(() => {
    setSelectedAltPhone(null);
    setIsEditingPhone(false);
    setPhoneInput(currentGuest?.phone || '');
  }, [currentGuest?.id]);

  // Make sure currentIndex stays within bounds
  useEffect(() => {
    if (currentIndex >= queue.length && queue.length > 0) {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex]);

  // Autoplay countdown timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (queue.length === 0 || currentIndex >= queue.length) {
      setIsPlaying(false);
      return;
    }

    setCountdown(autoDelaySeconds);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up -> Dispatch current & advance!
          handleDispatchAndAdvance(true);
          return autoDelaySeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentIndex, queue.length, autoDelaySeconds, currentGuest?.id]);

  // Spacebar and Arrow keyboard shortcuts
  useEffect(() => {
    if (!isOpen || activeTab !== 'runner') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleDispatchAndAdvance(false);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, currentGuest, currentIndex, queue.length]);

  if (!isOpen) return null;

  // Single-Tab Opener & Dispatch
  const handleOpenCurrentInSingleTab = () => {
    if (!currentGuest) return;
    const url = buildWhatsAppUrl(currentGuest, messageType, selectedAltPhone || undefined);
    openWhatsAppInSingleTab(url);
  };

  const handleMarkSent = async (guest: Guest) => {
    await GuestService.markWhatsAppSent(guest.id, true);
  };

  const handleDispatchAndAdvance = async (autoTriggered: boolean = false) => {
    if (!currentGuest) return;

    // 1. Open/Update the single WhatsApp tab
    const url = buildWhatsAppUrl(currentGuest, messageType, selectedAltPhone || undefined);
    openWhatsAppInSingleTab(url);

    // 2. Mark current as sent
    await GuestService.markWhatsAppSent(currentGuest.id, true);

    // 3. Advance to next in queue
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleSavePhone = async () => {
    if (!currentGuest) return;
    await GuestService.updateGuest(currentGuest.id, {
      phone: phoneInput.trim() || undefined,
    });
    setIsEditingPhone(false);
  };

  // VCF Download
  const handleDownloadVCard = () => {
    const vcfContent = generateVCardFile(guests);
    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Contactos-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Broadcast text copy
  const handleCopyBroadcastText = () => {
    const sampleGuest = guests[0] || {
      id: 'demo',
      token: 'tk-divo20-001',
      firstName: '[Nombre]',
      lastName: '',
      category: 'Invitado General' as GuestCategory,
      companionsAllowed: 1,
      status: 'confirmed' as const,
      confirmedCompanions: 1,
      checkedIn: false,
      createdAt: '',
      updatedAt: '',
    };
    const rsvpUrl = GuestService.getPublicOrigin() + '/?asistencia=true';
    const text =
      `Estimado/a invitado/a:\n\n` +
      `DIVO Trajes y Etiqueta tiene el inmenso agrado de invitarte a celebrar nuestros 20 Años en el evento:\n` +
      `"DIVO 20 años — Vistiendo Momentos"\n\n` +
      `📅 Jueves 22 de Octubre de 2026\n` +
      `⏰ 19:00 hs puntual\n` +
      `📍 Capilla Paseo del Buen Pastor, Córdoba\n` +
      `✨ Aniversario + Show en Vivo + Desfile Exclusivo\n` +
      `👔 Dress Code: Elegante\n\n` +
      `Por favor, confirma tu asistencia y consulta tu pase con código QR en tu enlace exclusivo o en:\n` +
      `${rsvpUrl}\n\n` +
      `¡Esperamos contar con tu distinguida presencia! 🥂`;

    navigator.clipboard.writeText(text);
    setCopiedBroadcastText(true);
    setTimeout(() => setCopiedBroadcastText(false), 2500);
  };

  // Copy Web Console Script
  const handleCopyConsoleScript = () => {
    const script = generateWhatsAppWebConsoleScript(guests, messageType, autoDelaySeconds);
    navigator.clipboard.writeText(script);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  // Background Webhook Simulation / Dispatch
  const handleStartBackgroundDispatch = async () => {
    const recipients = guests.filter((g) => {
      const p = cleanAndFormatPhoneNumber(g.phone);
      return p.isValid && !g.whatsappSent;
    });

    if (recipients.length === 0) {
      alert('No hay invitados pendientes con número de teléfono válido para enviar.');
      return;
    }

    setIsBackgroundSending(true);
    setBackgroundProgress(0);
    setBackgroundLogs([
      `Iniciando despacho masivo en segundo plano para ${recipients.length} contactos...`,
      isSimulatingApi ? 'Modo Simulación activo (Validación de entrega y guardado en base de datos)' : `Conectando con Gateway Webhook: ${webhookUrl}`,
    ]);

    for (let i = 0; i < recipients.length; i++) {
      const guest = recipients[i];
      const p = cleanAndFormatPhoneNumber(guest.phone);

      // Simulate network latency / rate limit
      await new Promise((r) => setTimeout(r, 600));

      if (!isSimulatingApi && webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
            },
            body: JSON.stringify({
              phone: p.formatted,
              message: buildWhatsAppUrl(guest, messageType),
              guestId: guest.id,
              name: `${guest.firstName} ${guest.lastName}`,
            }),
          });
        } catch (e: any) {
          setBackgroundLogs((prev) => [
            ...prev,
            `⚠️ Error enviando a ${guest.firstName} (${p.display}): ${e.message}`,
          ]);
        }
      }

      await GuestService.markWhatsAppSent(guest.id, true);
      const pct = Math.round(((i + 1) / recipients.length) * 100);
      setBackgroundProgress(pct);
      setBackgroundLogs((prev) => [
        ...prev.slice(-8),
        `✓ [${i + 1}/${recipients.length}] Entregado a ${guest.firstName} ${guest.lastName} (${p.display})`,
      ]);
    }

    setBackgroundLogs((prev) => [...prev, `🎉 ¡Despacho completado con éxito! Se actualizaron todos los registros.`]);
    setIsBackgroundSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative bg-[#111111] border border-[#C5A059] max-w-4xl w-full rounded-sm shadow-2xl flex flex-col my-auto max-h-[95vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#25D366]/20 border border-[#25D366]/50 flex items-center justify-center text-[#25D366]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
                  SISTEMA DE DESPACHO
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[9px] font-mono font-semibold">
                  Pestaña Única Inteligente
                </span>
              </div>
              <h2 className="font-montserrat text-lg sm:text-xl font-bold text-white tracking-tight">
                Automatización de Envíos WhatsApp
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              setIsPlaying(false);
              onClose();
            }}
            className="text-white/60 hover:text-white font-mono text-sm p-2 hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Global KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-black/60 border-b border-white/10 text-center font-montserrat">
          <div className="bg-[#181818] border border-white/10 p-2 rounded-sm">
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Padrón Total</div>
            <div className="text-lg font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-[#181818] border border-emerald-500/30 p-2 rounded-sm">
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider">Con Teléfono</div>
            <div className="text-lg font-bold text-emerald-400">{stats.withPhone}</div>
          </div>
          <div className="bg-[#181818] border border-[#C5A059]/40 p-2 rounded-sm">
            <div className="text-[10px] text-[#C5A059] uppercase tracking-wider">Ya Enviados</div>
            <div className="text-lg font-bold text-[#E7CF98]">
              {stats.sentCount} <span className="text-xs text-white/40">({Math.round((stats.sentCount / (stats.total || 1)) * 100)}%)</span>
            </div>
          </div>
          <div className="bg-[#181818] border border-amber-500/30 p-2 rounded-sm">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider">Pendientes</div>
            <div className="text-lg font-bold text-amber-400">{stats.pendingCount}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-[#141414] px-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('runner')}
            className={`py-3 px-4 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'runner'
                ? 'border-[#C5A059] text-[#E7CF98] bg-[#C5A059]/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-[#C5A059]" />
            <span>1. Piloto Automático (Pestaña Única)</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('broadcast');
            }}
            className={`py-3 px-4 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'broadcast'
                ? 'border-[#C5A059] text-[#E7CF98] bg-[#C5A059]/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>2. Lista de Difusión (1 toque para los {stats.withPhone})</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('webhook');
            }}
            className={`py-3 px-4 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'webhook'
                ? 'border-[#C5A059] text-[#E7CF98] bg-[#C5A059]/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>3. API / Gateway Directo</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('script');
            }}
            className={`py-3 px-4 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'script'
                ? 'border-[#C5A059] text-[#E7CF98] bg-[#C5A059]/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4 text-purple-400" />
            <span>4. Script Consola WhatsApp Web</span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0f0f0f]">
          
          {/* TAB 1: PILOTO AUTOMÁTICO SECUENCIAL */}
          {activeTab === 'runner' && (
            <div className="space-y-5">
              
              {/* Configuration Bar */}
              <div className="bg-[#161616] border border-white/10 p-3 sm:p-4 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                
                {/* Message type selector */}
                <div className="flex items-center gap-2">
                  <span className="text-white/60 font-montserrat uppercase font-semibold">Tipo de mensaje:</span>
                  <select
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value as MessageType)}
                    className="bg-[#1f1f1f] border border-[#C5A059]/50 text-[#E7CF98] py-1 px-2.5 font-montserrat font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="invitation">🎟️ Invitación Oficial 20 Años</option>
                    <option value="reminder">🔔 Recordatorio Hoy (19:00 hs)</option>
                  </select>
                </div>

                {/* Delay between contacts */}
                <div className="flex items-center gap-2">
                  <span className="text-white/60 font-montserrat uppercase font-semibold">Tiempo por contacto:</span>
                  <select
                    value={autoDelaySeconds}
                    onChange={(e) => setAutoDelaySeconds(Number(e.target.value))}
                    disabled={isPlaying}
                    className="bg-[#1f1f1f] border border-white/20 text-white py-1 px-2.5 font-mono focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value={3}>3 segundos (Rápido)</option>
                    <option value={5}>5 segundos (Recomendado)</option>
                    <option value={8}>8 segundos (Tranquilo)</option>
                    <option value={12}>12 segundos (Lento)</option>
                  </select>
                </div>

                {/* Queue Filters */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-white/80 cursor-pointer font-montserrat select-none">
                    <input
                      type="checkbox"
                      checked={onlyPending}
                      onChange={(e) => {
                        setOnlyPending(e.target.checked);
                        setCurrentIndex(0);
                      }}
                      className="accent-[#C5A059]"
                    />
                    <span>Solo pendientes ({stats.pendingCount})</span>
                  </label>

                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentIndex(0);
                    }}
                    className="bg-[#1f1f1f] border border-white/15 text-white/80 py-1 px-2 font-mono text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas las categorías</option>
                    <option value="VIP">VIP</option>
                    <option value="Staff">Staff</option>
                    <option value="Familia & Amigos">Familia & Amigos</option>
                    <option value="Invitado General">Invitado General</option>
                  </select>
                </div>
              </div>

              {/* Solución a la saturación de pestañas: Explicación y Status */}
              <div className="bg-emerald-950/30 border border-emerald-500/40 p-3 rounded-sm flex items-start gap-2.5 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300 font-bold">Tecnología de Pestaña Única:</strong> Este sistema abre y reutiliza <em>una única ventana de WhatsApp</em>. No se abrirán 120 pestañas en tu navegador. Al presionar <strong>"Iniciar Piloto Automático"</strong> o <strong>"Espacio"</strong>, la misma ventana carga automáticamente el siguiente chat listo para enviar.
                </div>
              </div>

              {/* Runner Active Contact Card */}
              {queue.length > 0 && currentGuest ? (
                <div className="bg-[#151515] border-2 border-[#C5A059] p-5 rounded-sm shadow-xl relative">
                  
                  {/* Top Bar: Progress & Counter */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-[#C5A059] text-black font-montserrat text-xs font-black tracking-wider uppercase rounded-xs">
                        {currentIndex + 1} de {queue.length}
                      </span>
                      <span className="font-mono text-xs text-white/60">
                        ({Math.round(((currentIndex + 1) / queue.length) * 100)}% de la cola)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentGuest.whatsappSent ? (
                        <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-montserrat text-[10px] font-bold uppercase flex items-center gap-1 rounded-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ya Enviado ({currentGuest.whatsappSentAt ? new Date(currentGuest.whatsappSentAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''})</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-950/80 border border-amber-500/50 text-amber-300 font-montserrat text-[10px] font-bold uppercase flex items-center gap-1 rounded-sm">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pendiente de Envío</span>
                        </span>
                      )}

                      {isPlaying && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/80 border border-red-500/50 text-red-300 font-mono text-xs font-bold animate-pulse rounded-sm">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span>Auto-envío en: {countdown}s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Guest Identity & Phone Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[#C5A059] bg-[#C5A059]/15 px-2 py-0.5 border border-[#C5A059]/30">
                          {currentGuest.category}
                        </span>
                        {currentGuest.tableOrSeat && (
                          <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 border border-white/10">
                            {currentGuest.tableOrSeat}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-white/40">
                          {currentGuest.companionsAllowed > 0 ? `+${currentGuest.companionsAllowed} Acomp.` : 'Individual'}
                        </span>
                      </div>

                      <h3 className="font-montserrat text-xl sm:text-2xl font-black text-white mt-1">
                        {currentGuest.firstName} {currentGuest.lastName}
                      </h3>

                      {/* Phone Display / Inline Edit */}
                      <div className="mt-2 flex items-center gap-2">
                        {isEditingPhone ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={phoneInput}
                              onChange={(e) => setPhoneInput(e.target.value)}
                              placeholder="+54 9 351..."
                              className="bg-[#1f1f1f] border border-[#C5A059] px-2 py-1 text-xs text-white font-mono focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleSavePhone}
                              className="px-2 py-1 bg-[#C5A059] text-black font-montserrat text-[10px] font-bold uppercase"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingPhone(false)}
                              className="px-2 py-1 bg-white/10 text-white font-montserrat text-[10px] uppercase"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-mono text-xs px-2.5 py-1 rounded-sm border ${
                              currentPhoneData.isValid
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            }`}>
                              📞 {currentPhoneData.display}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setPhoneInput(currentGuest.phone || '');
                                setIsEditingPhone(true);
                              }}
                              className="text-[10px] text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                              title="Editar o agregar número de teléfono"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{currentPhoneData.isValid ? 'Cambiar número' : 'Agregar teléfono'}</span>
                            </button>

                            {/* Alternatives dropdown if guest had 2 numbers (e.g. 3516538287/ 3513093756) */}
                            {currentPhoneData.alternatives.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-white/60">
                                <span>2do número:</span>
                                {currentPhoneData.alternatives.map((alt) => (
                                  <button
                                    key={alt}
                                    type="button"
                                    onClick={() => setSelectedAltPhone(alt)}
                                    className={`px-1.5 py-0.5 border text-[9px] ${
                                      selectedAltPhone === alt
                                        ? 'bg-[#C5A059] text-black font-bold border-[#C5A059]'
                                        : 'bg-white/5 border-white/20 text-white/70 hover:text-white'
                                    }`}
                                  >
                                    +{alt}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR Code Pass info preview */}
                    <div className="bg-black/50 border border-white/10 p-3 rounded-sm text-xs font-mono text-white/70">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-[#C5A059] uppercase tracking-wider font-bold">Pase Oficial Digital:</span>
                        <span className="text-[10px] text-[#E7CF98]">{currentGuest.token}</span>
                      </div>
                      <div className="text-[11px] text-white/90 truncate">
                        Link: {GuestService.getRSVPUrl(currentGuest)}
                      </div>
                    </div>
                  </div>

                  {/* Message Preview Box */}
                  <div className="mt-4 bg-[#0d0d0d] border border-white/10 p-3 rounded-sm text-xs text-neutral-300 font-sans max-h-32 overflow-y-auto whitespace-pre-wrap relative leading-relaxed">
                    <span className="absolute top-2 right-2 text-[9px] font-mono uppercase bg-white/10 text-white/50 px-1.5 py-0.5 rounded">
                      Mensaje WhatsApp a Enviar
                    </span>
                    {messageType === 'invitation' ? (
                      <div>
                        Estimado/a <strong>{currentGuest.firstName} {currentGuest.lastName}</strong>:<br /><br />
                        DIVO Trajes y Etiqueta tiene el agrado de invitarte a celebrar nuestros 20 Años en el evento:<br />
                        <strong>"DIVO 20 años — Vistiendo Momentos"</strong><br /><br />
                        📅 Jueves 22 de Octubre de 2026 • ⏰ 19:00 hs • 📍 Capilla Buen Pastor<br />
                        🔑 Código de Acreditación QR: <strong>{currentGuest.token}</strong>
                      </div>
                    ) : (
                      <div>
                        ¡Hola <strong>{currentGuest.firstName}</strong>! ✨<br /><br />
                        ¡Hoy es el gran día! Te esperamos esta tarde (19:00 hs puntual) en la Capilla Paseo del Buen Pastor para celebrar juntos los 20 Años de DIVO Trajes y Etiqueta.<br />
                        🔑 Tu Código QR de Puerta: <strong>{currentGuest.token}</strong>
                      </div>
                    )}
                  </div>

                  {/* Large Primary Actions Toolbar */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                    
                    {/* Left: Auto-runner Play / Pause */}
                    <div className="flex items-center gap-2">
                      {!isPlaying ? (
                        <button
                          type="button"
                          onClick={() => setIsPlaying(true)}
                          disabled={!currentPhoneData.isValid}
                          className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-montserrat text-xs font-black tracking-wider uppercase flex items-center gap-2 rounded-xs shadow-lg transition-transform active:scale-98 disabled:opacity-40 cursor-pointer"
                          title="Inicia el envío secuencial automático con recarga en una única pestaña"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Iniciar Piloto Automático</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsPlaying(false)}
                          className="py-3 px-5 bg-amber-600 hover:bg-amber-500 text-black font-montserrat text-xs font-black tracking-wider uppercase flex items-center gap-2 rounded-xs shadow-lg cursor-pointer"
                          title="Pausa el envío automático"
                        >
                          <Pause className="w-4 h-4 fill-black" />
                          <span>Pausar Piloto Automático</span>
                        </button>
                      )}

                      {/* Manual Send & Advance */}
                      <button
                        type="button"
                        onClick={() => handleDispatchAndAdvance(false)}
                        disabled={!currentPhoneData.isValid}
                        className="py-3 px-5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-black tracking-wider uppercase flex items-center gap-2 rounded-xs shadow-md transition-colors disabled:opacity-40 cursor-pointer"
                        title="Envía el mensaje en la pestaña única de WhatsApp y avanza inmediatamente al siguiente contacto (o presioná barra espaciadora)"
                      >
                        <Send className="w-4 h-4" />
                        <span>Enviar y Avanzar [Espacio]</span>
                      </button>
                    </div>

                    {/* Right: Step Navigation & Single Tab Direct Opening */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="p-2.5 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 disabled:opacity-30 cursor-pointer"
                        title="Contacto anterior"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenCurrentInSingleTab}
                        disabled={!currentPhoneData.isValid}
                        className="py-2.5 px-3 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-black border border-[#25D366]/40 font-montserrat text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        title="Abrir o recargar este contacto en la pestaña única de WhatsApp sin avanzar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkSent(currentGuest)}
                        className="py-2.5 px-3 bg-white/5 hover:bg-emerald-950/60 border border-white/15 text-white/70 hover:text-emerald-300 font-montserrat text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Marcar como enviado sin abrir chat"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marcar Enviado</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentIndex === queue.length - 1}
                        className="p-2.5 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 disabled:opacity-30 cursor-pointer"
                        title="Saltear al siguiente contacto"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mini Contact Queue Strip */}
                  <div className="mt-5 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-montserrat uppercase tracking-wider text-white/50 mb-2 flex items-center justify-between">
                      <span>Próximos en cola:</span>
                      <span>Clic en cualquier invitado para seleccionarlo</span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {queue.slice(Math.max(0, currentIndex - 2), currentIndex + 15).map((g) => {
                        const isCurrent = g.id === currentGuest.id;
                        const p = cleanAndFormatPhoneNumber(g.phone);
                        const actualIdx = queue.findIndex((q) => q.id === g.id);

                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setCurrentIndex(actualIdx)}
                            className={`shrink-0 py-1.5 px-2.5 text-left rounded-sm border transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold shadow-md'
                                : g.whatsappSent
                                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                                : !p.isValid
                                ? 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:bg-rose-900/40'
                                : 'bg-[#181818] border-white/10 text-white/70 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <div className="text-[10px] font-montserrat truncate max-w-[120px]">
                              {actualIdx + 1}. {g.firstName} {g.lastName}
                            </div>
                            <div className="text-[9px] font-mono opacity-70">
                              {g.whatsappSent ? '✓ Enviado' : p.isValid ? p.display.slice(-8) : 'Sin tel'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141414] border border-white/10 p-12 text-center text-white/60">
                  <div className="text-emerald-400 font-bold font-montserrat text-base mb-1">
                    ¡Todos los invitados en este filtro ya fueron procesados!
                  </div>
                  <p className="text-xs text-white/50 mb-4">
                    Podés desactivar la opción "Solo pendientes" para revisar o reenviar a toda la lista.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnlyPending(false)}
                    className="py-2 px-4 bg-[#C5A059] text-black font-montserrat text-xs font-bold uppercase tracking-wider"
                  >
                    Mostrar todos los contactos ({guests.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LISTA DE DIFUSIÓN WHATSAPP (1 SOLO TOQUE) */}
          {activeTab === 'broadcast' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="text-center">
                <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
                  LA FORMA MÁS DIRECTA Y SIN PESTAÑAS
                </span>
                <h3 className="font-montserrat text-xl font-bold text-white mt-1">
                  Lista de Difusión Oficial de WhatsApp
                </h3>
                <p className="font-montserrat text-xs text-white/70 mt-1 max-w-lg mx-auto">
                  Enviá la invitación a los <strong>{stats.withPhone} invitados</strong> de una sola vez, en mensajes privados 1 a 1, sin abrir pestañas y directamente desde tu aplicación de WhatsApp.
                </p>
              </div>

              {/* 3 Steps Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#161616] border border-[#C5A059]/40 p-4 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-[#C5A059] text-black font-montserrat font-bold flex items-center justify-center text-xs mb-3">
                      1
                    </div>
                    <h4 className="font-montserrat text-sm font-bold text-white mb-1">
                      Descargar Libreta .VCF
                    </h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Generá el archivo que guarda los {stats.withPhone} números en tu celular automáticamente con el prefijo "DIVO 20".
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadVCard}
                    className="mt-4 w-full py-2.5 px-3 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Bajar Contactos (.vcf)</span>
                  </button>
                </div>

                <div className="bg-[#161616] border border-white/10 p-4 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-montserrat font-bold flex items-center justify-center text-xs mb-3">
                      2
                    </div>
                    <h4 className="font-montserrat text-sm font-bold text-white mb-1">
                      Crear Difusión en WhatsApp
                    </h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      En WhatsApp tocá <strong>"Nueva difusión"</strong>, buscá "DIVO 20" y seleccioná a todos los invitados.
                    </p>
                  </div>

                  <div className="mt-4 py-2 px-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono text-center rounded-sm">
                    ✓ Sin grupos públicos
                  </div>
                </div>

                <div className="bg-[#161616] border border-white/10 p-4 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-purple-500 text-white font-montserrat font-bold flex items-center justify-center text-xs mb-3">
                      3
                    </div>
                    <h4 className="font-montserrat text-sm font-bold text-white mb-1">
                      Pegar y Enviar 1 Sola Vez
                    </h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Copiá el texto oficial con el enlace RSVP general y envialo. Cada invitado lo recibe en su chat privado.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyBroadcastText}
                    className="mt-4 w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white font-montserrat text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedBroadcastText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#C5A059]" />}
                    <span>{copiedBroadcastText ? '¡Texto Copiado!' : 'Copiar Texto Oficial'}</span>
                  </button>
                </div>
              </div>

              {/* Mark all as dispatched option */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/50 font-montserrat">
                  ¿Ya enviaste tu lista de difusión en WhatsApp?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`¿Marcar los ${stats.withPhone} invitados con teléfono como ENVIADOS?`)) {
                      const ids = guests.filter((g) => cleanAndFormatPhoneNumber(g.phone).isValid).map((g) => g.id);
                      await GuestService.markMultipleWhatsAppSent(ids, true);
                      alert('¡Todos los contactos fueron marcados como enviados!');
                    }
                  }}
                  className="py-2 px-4 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-montserrat text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Marcar los {stats.withPhone} como Enviados</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: API / GATEWAY WEBHOOK (CERO PESTAÑAS) */}
          {activeTab === 'webhook' && (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              <div className="text-center">
                <span className="font-montserrat text-[10px] tracking-[0.25em] text-blue-400 uppercase font-bold">
                  DESPACHO 100% EN SEGUNDO PLANO
                </span>
                <h3 className="font-montserrat text-xl font-bold text-white mt-1">
                  Envío Directo por API / Webhook (Sin Abrir el Navegador)
                </h3>
                <p className="font-montserrat text-xs text-white/70 mt-1 max-w-lg mx-auto">
                  Si disponés de un gateway de WhatsApp (como UltraMsg, GreenAPI, Evolution API o CallMeBot), el sistema puede despachar los mensajes por HTTP en segundo plano.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="bg-[#161616] border border-white/10 p-4 rounded-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="simMode"
                      checked={isSimulatingApi}
                      onChange={(e) => setIsSimulatingApi(e.target.checked)}
                      className="accent-[#C5A059]"
                    />
                    <label htmlFor="simMode" className="font-montserrat text-xs text-white font-bold cursor-pointer">
                      Modo Simulación & Verificación
                    </label>
                  </div>
                  <span className="text-[10px] font-mono text-[#C5A059]">
                    {isSimulatingApi ? 'Prueba segura sin costo' : 'Modo Webhook Real'}
                  </span>
                </div>

                {!isSimulatingApi && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-montserrat text-white/70 mb-1">
                        URL del Endpoint Webhook / Gateway:
                      </label>
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => {
                          setWebhookUrl(e.target.value);
                          try {
                            localStorage.setItem('divo_wa_webhook_url', e.target.value);
                          } catch {}
                        }}
                        placeholder="https://api.ultramsg.com/instance.../messages/chat"
                        className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-montserrat text-white/70 mb-1">
                        API Token / Clave Secreta (Opcional):
                      </label>
                      <input
                        type="password"
                        value={webhookToken}
                        onChange={(e) => {
                          setWebhookToken(e.target.value);
                          try {
                            localStorage.setItem('divo_wa_webhook_token', e.target.value);
                          } catch {}
                        }}
                        placeholder="Bearer token o secret key..."
                        className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {isBackgroundSending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono text-emerald-400">
                      <span>Despachando mensajes...</span>
                      <span>{backgroundProgress}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${backgroundProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Log display */}
                {backgroundLogs.length > 0 && (
                  <div className="bg-black/80 border border-white/10 p-3 rounded-sm font-mono text-[10px] text-neutral-300 max-h-40 overflow-y-auto space-y-1">
                    {backgroundLogs.map((log, i) => (
                      <div key={i} className="leading-tight">
                        {log}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStartBackgroundDispatch}
                    disabled={isBackgroundSending}
                    className="py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-montserrat text-xs font-black tracking-wider uppercase flex items-center gap-2 rounded-xs shadow-lg transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isBackgroundSending ? 'Despachando...' : `Despachar a los ${stats.pendingCount} Pendientes`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCRIPT PARA CONSOLA DE WHATSAPP WEB */}
          {activeTab === 'script' && (
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              <div className="text-center">
                <span className="font-montserrat text-[10px] tracking-[0.25em] text-purple-400 uppercase font-bold">
                  AUTOMATIZACIÓN LOCAL DIRECTA
                </span>
                <h3 className="font-montserrat text-xl font-bold text-white mt-1">
                  Script de Envío para la Consola de WhatsApp Web
                </h3>
                <p className="font-montserrat text-xs text-white/70 mt-1 max-w-lg mx-auto">
                  Si usás WhatsApp Web en tu computadora, podés pegar este script en la consola de tu navegador. El script enviará a los {stats.withPhone} contactos sin abrir ninguna pestaña nueva.
                </p>
              </div>

              <div className="bg-[#161616] border border-white/10 p-4 rounded-sm space-y-4">
                <ol className="list-decimal list-inside space-y-2 text-xs text-white/80 font-montserrat leading-relaxed">
                  <li>Abrí tu WhatsApp Web habitual en <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="text-[#C5A059] underline">web.whatsapp.com</a>.</li>
                  <li>Presioná la tecla <strong>F12</strong> (o clic derecho -&gt; "Inspeccionar") y hacé clic en la pestaña <strong>Console</strong>.</li>
                  <li>Hacé clic en el botón de abajo para <strong>Copiar Script</strong>.</li>
                  <li>Pegalo en la consola de WhatsApp Web y presioná <strong>Enter</strong>. ¡Listo! El script recorre los contactos y envía las invitaciones automáticamente.</li>
                </ol>

                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={handleCopyConsoleScript}
                    className="py-3 px-6 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-montserrat text-xs font-black tracking-wider uppercase flex items-center gap-2 rounded-xs shadow-lg cursor-pointer"
                  >
                    {copiedSnippet ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSnippet ? '¡Script Copiado al Portapapeles!' : 'Copiar Script para Consola (WhatsApp Web)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-[#141414] border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-white/50">
          <div>
            Tip: Al usar el <strong>Piloto Automático</strong>, podés presionar la tecla <strong>Espacio</strong> para despachar y avanzar.
          </div>
          <div>
            DIVO 20 Años • Capilla Buen Pastor
          </div>
        </div>

      </div>
    </div>
  );
};
