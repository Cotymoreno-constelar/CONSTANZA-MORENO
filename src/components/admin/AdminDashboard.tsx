import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  Filter,
  Sparkles,
  FileText,
  RotateCcw,
  Check,
  Calendar,
  Layers,
  Printer,
  Copy,
  Bell,
  MessageCircle,
  Image as ImageIcon,
  FileSpreadsheet,
  QrCode
} from 'lucide-react';
import { Guest, EventStats, GuestCategory, RSVPStatus } from '../../types/guest';
import { GuestService, calculateStats } from '../../services/guestService';
import { InvitationCard } from '../invitation/InvitationCard';
import { DivoLogo, getCustomLogoUrl, setCustomLogoUrl } from '../brand/DivoLogo';
import { ExcelImportModal, exportGuestsToExcel } from './ExcelImportModal';
import { QRGeneratorModal } from './QRGeneratorModal';

interface AdminDashboardProps {
  guests: Guest[];
  onSelectGuestForPreview: (guest: Guest) => void;
  onOpenRSVPPage: (guest: Guest) => void;
  onGoToScanner: () => void;
  onGoToLiveWall?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  guests,
  onSelectGuestForPreview,
  onOpenRSVPPage,
  onGoToScanner,
  onGoToLiveWall,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBatchDownloadModalOpen, setIsBatchDownloadModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [customLogoPreview, setCustomLogoPreview] = useState<string | null>(() => getCustomLogoUrl());
  const [selectedGuestForCard, setSelectedGuestForCard] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  // Single Add Guest Form
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState<GuestCategory>('Invitado General');
  const [newTable, setNewTable] = useState('');
  const [newCompanionsAllowed, setNewCompanionsAllowed] = useState(1);

  // Bulk Add Form
  const [bulkText, setBulkText] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  const stats = calculateStats(guests);

  // Filtering
  const filteredGuests = guests.filter((g) => {
    const matchesSearch =
      `${g.firstName} ${g.lastName} ${g.email || ''} ${g.phone || ''} ${g.tableOrSeat || ''}`
        .toLowerCase()
        .includes(searchFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'checkedIn' && g.checkedIn) ||
      (statusFilter === 'confirmed' && g.status === 'confirmed' && !g.checkedIn) ||
      (statusFilter === 'pending' && g.status === 'pending') ||
      (statusFilter === 'declined' && g.status === 'declined');

    const matchesCategory =
      categoryFilter === 'all' || g.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleAddSingleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim()) return;

    let firstName = newFirstName.trim();
    let lastName = newLastName.trim();
    if (!lastName && firstName.includes(' ')) {
      const parts = firstName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    const created = await GuestService.addGuest({
      firstName,
      lastName,
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      category: newCategory,
      tableOrSeat: newTable.trim() || undefined,
      companionsAllowed: newCompanionsAllowed,
    });

    // Reset form
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
    setNewTable('');
    setNewCompanionsAllowed(1);
    setIsAddModalOpen(false);
    // Open the generated QR & Invitation Card immediately
    setSelectedGuestForCard(created);
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
    const parsedGuests: any[] = [];

    for (const line of lines) {
      // Support CSV: "Nombre, Apellido, Email, Teléfono, Categoría" OR simple "Nombre Apellido"
      if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim());
        parsedGuests.push({
          firstName: parts[0] || 'Invitado',
          lastName: parts[1] || '',
          email: parts[2] || undefined,
          phone: parts[3] || undefined,
          category: (parts[4] as GuestCategory) || 'Invitado General',
          companionsAllowed: 1,
        });
      } else {
        const parts = line.trim().split(' ');
        const firstName = parts[0] || 'Invitado';
        const lastName = parts.slice(1).join(' ') || '';
        parsedGuests.push({
          firstName,
          lastName,
          category: 'Invitado General',
          companionsAllowed: 1,
        });
      }
    }

    if (parsedGuests.length > 0) {
      await GuestService.addMultipleGuests(parsedGuests);
      setBulkText('');
      setIsBulkModalOpen(false);
    }
  };

  const handleDeleteGuest = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar la invitación de ${name}?`)) {
      await GuestService.deleteGuest(id);
      if (selectedGuestForCard?.id === id) {
        setSelectedGuestForCard(null);
      }
    }
  };

  const handleCopyLink = (guest: Guest) => {
    const url = GuestService.getRSVPUrl(guest);
    navigator.clipboard.writeText(url);
    setCopiedId(guest.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Nombre',
      'Apellido',
      'Categoría',
      'Email',
      'Teléfono',
      'Ubicación',
      'Acompañantes Permitidos',
      'Estado RSVP',
      'Acompañantes Confirmados',
      'Nombre Acompañante',
      'Mensaje',
      'Fecha Respuesta',
      'Ingresó en Puerta',
      'Hora Ingreso',
      'Link RSVP',
    ];

    const rows = guests.map((g) => [
      `"${g.id}"`,
      `"${g.firstName}"`,
      `"${g.lastName}"`,
      `"${g.category}"`,
      `"${g.email || ''}"`,
      `"${g.phone || ''}"`,
      `"${g.tableOrSeat || ''}"`,
      g.companionsAllowed,
      `"${g.status}"`,
      g.confirmedCompanions || 0,
      `"${g.companionName || ''}"`,
      `"${(g.congratulationMessage || '').replace(/"/g, '""')}"`,
      `"${g.respondedAt || ''}"`,
      g.checkedIn ? 'SÍ' : 'NO',
      `"${g.checkedInAt || ''}"`,
      `"${GuestService.getRSVPUrl(g)}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DIVO-20-Anos-Padron-Invitados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handlePrintAllCards = () => {
    // Open a printable page with all cards for bulk printing / PDF export
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = filteredGuests
      .map(
        (g) => `
        <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; color: #FAF7F2; padding: 20px; font-family: 'Montserrat', sans-serif;">
          <div style="width: 380px; height: 640px; border: 1px solid #C5A059; background: #0d0d0d; padding: 28px; position: relative; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between;">
              <div style="border-left: 2px solid #C5A059; padding-left: 10px;">
                <div style="font-size: 10px; letter-spacing: 0.25em; color: #C5A059; text-transform: uppercase;">INVITACIÓN ESPECIAL</div>
                <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">${g.firstName} ${g.lastName}</div>
                <div style="font-size: 8px; opacity: 0.7; text-transform: uppercase;">${g.companionsAllowed > 0 ? `Pase: Titular + ${g.companionsAllowed} Acomp.` : 'Pase Individual'}</div>
              </div>
            </div>
            <div style="margin: 40px 0 20px;">
              <div style="font-family: 'Old Standard TT', serif; font-size: 54px; color: #C5A059; font-weight: bold; line-height: 1;">
                20 <span style="font-style: italic; font-size: 32px;">años</span>
              </div>
              <div style="font-size: 9px; letter-spacing: 0.4em; text-transform: uppercase; margin-top: 6px;">VISTIENDO MOMENTOS</div>
              <div style="margin-top: 24px; font-size: 10px; line-height: 1.6; border-left: 1px solid rgba(197,160,89,0.3); padding-left: 12px;">
                <div style="color: #C5A059; font-size: 8px; text-transform: uppercase; letter-spacing: 0.2em;">LUGAR</div>
                <div style="font-weight: 600;">CAPILLA PASEO DEL BUEN PASTOR</div>
                <div style="color: #C5A059; font-size: 8px; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 8px;">FECHA Y HORA</div>
                <div style="font-weight: 600;">22 DE OCTUBRE — 19:00 HS</div>
                <div style="margin-top: 10px; display: inline-block; padding: 4px 8px; border: 1px solid #C5A059; color: #E7CF98; font-size: 8px; letter-spacing: 0.15em;">
                  DRESS CODE: ELEGANTE
                </div>
              </div>
            </div>
            <div style="position: absolute; bottom: 20px; left: 28px; right: 28px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
              <div style="font-size: 8px; letter-spacing: 0.25em; margin-bottom: 6px;">SHOW EN VIVO — DESFILE EXCLUSIVO</div>
              <div style="font-weight: 9px; letter-spacing: 0.2em; color: #fff;">DIVO TRAJES Y ETIQUETA</div>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Invitaciones - DIVO 20 Años</title>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; background: #000; }
            @media print {
              body { background: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 text-[#FAF7F2]">
      {/* Top Welcome Bar & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
              PANEL DE CONTROL GENERAL
            </span>
            <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-semibold">
              ● En Vivo
            </span>
          </div>
          <h1 className="font-montserrat text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Gestión de Invitaciones & Asistencia
          </h1>
          <p className="font-montserrat text-xs text-white/60 mt-0.5">
            Evento "DIVO 20 años — Vistiendo Momentos" • Capilla Paseo del Buen Pastor • 22 Oct 2026
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Scanner shortcut */}
          <button
            onClick={onGoToScanner}
            className="py-2.5 px-4 bg-gradient-to-r from-[#C5A059] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9a783e] text-black font-montserrat text-xs tracking-wider uppercase font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Users className="w-4 h-4 text-black" />
            <span>Abrir Escáner Puerta</span>
          </button>

          {/* Quick Live Wall shortcut */}
          {onGoToLiveWall && (
            <button
              onClick={onGoToLiveWall}
              className="py-2.5 px-3.5 bg-[#181818] hover:bg-[#252525] text-white border border-[#C5A059] font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Abrir moderación y pantalla de fotos en vivo"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Muro en Vivo</span>
            </button>
          )}

          {/* Subir Logo Real */}
          <button
            onClick={() => {
              setCustomLogoPreview(getCustomLogoUrl());
              setIsLogoModalOpen(true);
            }}
            className="py-2.5 px-3.5 bg-[#181818] hover:bg-[#252525] text-[#C5A059] border border-[#C5A059] font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Subir el archivo de logo real (PNG, SVG o JPG) para aplicar en toda la app y tarjetas"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Logo Oficial</span>
          </button>

          {/* Recordatorio Hoy por WhatsApp */}
          <button
            onClick={() => setIsReminderModalOpen(true)}
            className="py-2.5 px-3.5 bg-gradient-to-r from-emerald-950 to-[#181818] hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/50 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Enviar mensaje de recordatorio del día del evento a los invitados confirmados"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recordatorio Hoy ({stats.confirmedGuests})</span>
          </button>

          {/* Centro Generador de QR & Lotes */}
          <button
            onClick={() => setIsBatchDownloadModalOpen(true)}
            className="py-2.5 px-3.5 bg-gradient-to-r from-[#261f12] to-[#181818] hover:from-[#C5A059] hover:to-[#d4af37] text-[#E7CF98] hover:text-black border border-[#C5A059] font-montserrat text-xs tracking-wider uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Abrir Centro Generador de Códigos QR y descarga masiva de tarjetas en ZIP o PDF"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Generador de QR</span>
          </button>

          {/* Add Single Guest */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-3.5 bg-[#181818] hover:bg-[#252525] text-white border border-[#C5A059]/50 font-montserrat text-xs tracking-wider uppercase font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Nuevo Invitado</span>
          </button>

          {/* Bulk Import Excel / CSV */}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="py-2.5 px-3.5 bg-[#181818] hover:bg-[#252525] text-[#E7CF98] border border-[#C5A059]/60 font-montserrat text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Importar lista de invitados desde archivo Excel (.xlsx, .xls, .csv) o copiar y pegar"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Importar Excel</span>
          </button>

          {/* Export Excel (.xlsx) */}
          <button
            onClick={() => exportGuestsToExcel(guests)}
            className="py-2.5 px-3.5 bg-[#181818] hover:bg-[#252525] text-white border border-white/20 font-montserrat text-xs tracking-wider uppercase font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Descargar padrón completo, confirmados e ingresados en formato Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 my-6">
        {/* Total Invitaciones */}
        <div className="bg-[#121212] border border-white/10 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-[#C5A059] uppercase font-bold">
            Padrón Total
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-white mt-1">
            {stats.totalInvitations}
          </div>
          <div className="text-[10px] text-white/50 font-mono mt-0.5">
            Tarjetas emitidas
          </div>
        </div>

        {/* Confirmados */}
        <div className="bg-[#121212] border border-emerald-500/40 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-emerald-400 uppercase font-bold">
            Confirmados
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-emerald-400 mt-1">
            {stats.confirmedGuests}
          </div>
          <div className="text-[10px] text-emerald-200/70 font-mono mt-0.5">
            +{stats.confirmedCompanions} acompañantes
          </div>
        </div>

        {/* Total Personas Esperadas */}
        <div className="bg-gradient-to-br from-[#1c1710] to-[#121212] border border-[#C5A059]/60 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-[#E7CF98] uppercase font-bold">
            Personas Esperadas
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-[#C5A059] mt-1">
            {stats.totalAttendingPeople}
          </div>
          <div className="text-[10px] text-white/60 font-mono mt-0.5">
            Titulares + Acompañantes
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-[#121212] border border-amber-500/40 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-amber-400 uppercase font-bold">
            Pendientes
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-amber-400 mt-1">
            {stats.pendingGuests}
          </div>
          <div className="text-[10px] text-amber-200/70 font-mono mt-0.5">
            Por confirmar
          </div>
        </div>

        {/* No Asisten */}
        <div className="bg-[#121212] border border-rose-500/30 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-rose-400 uppercase font-bold">
            No Asisten
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-rose-400 mt-1">
            {stats.declinedGuests}
          </div>
          <div className="text-[10px] text-rose-200/70 font-mono mt-0.5">
            Cancelaciones
          </div>
        </div>

        {/* Ingresados en Sala */}
        <div className="bg-[#121212] border border-purple-500/40 p-4">
          <div className="text-[10px] font-montserrat tracking-widest text-purple-400 uppercase font-bold">
            Ingresados (Puerta)
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-black text-purple-400 mt-1">
            {stats.checkedInGuests}
          </div>
          <div className="text-[10px] text-purple-200/70 font-mono mt-0.5">
            {stats.totalCheckedInPeople} personas dentro
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#141414] border border-white/10 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o sector..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-white/15 pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#C5A059]"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'confirmed', label: 'Confirmados' },
            { id: 'checkedIn', label: 'Ingresados' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'declined', label: 'No Asisten' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`py-1.5 px-3 text-[11px] font-montserrat tracking-wider uppercase transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#C5A059] text-black font-bold'
                  : 'bg-[#1e1e1e] text-white/70 hover:text-white border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-[11px] text-white/50 font-montserrat uppercase hidden sm:inline">Categoría:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#1c1c1c] border border-white/15 px-2.5 py-1.5 text-xs text-[#FAF7F2] font-montserrat focus:outline-none focus:border-[#C5A059]"
          >
            <option value="all">Todas las categorías</option>
            <option value="VIP">VIP</option>
            <option value="Prensa">Prensa</option>
            <option value="Staff">Staff</option>
            <option value="Cliente Distinguido">Cliente Distinguido</option>
            <option value="Familia & Amigos">Familia & Amigos</option>
            <option value="Invitado General">Invitado General</option>
          </select>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-[#111111] border border-[#C5A059]/30 overflow-hidden shadow-xl rounded-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-black/70 border-b border-white/10 text-neutral-400 font-montserrat text-[10px] tracking-wider uppercase">
                <th className="py-3 px-4">Invitado / Nombre</th>
                <th className="py-3 px-3">Categoría & Ubicación</th>
                <th className="py-3 px-3">Estado RSVP</th>
                <th className="py-3 px-3">Acompañante</th>
                <th className="py-3 px-3">Check-in Puerta</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredGuests.map((guest) => {
                const rsvpUrl = GuestService.getRSVPUrl(guest);
                const waUrl = GuestService.getWhatsAppShareUrl(guest);

                return (
                  <tr key={guest.id} className="hover:bg-white/[0.03] transition-colors">
                    {/* Guest Name & Contact */}
                    <td className="py-3.5 px-4">
                      <div className="font-montserrat font-bold text-white text-sm">
                        {guest.firstName} {guest.lastName}
                      </div>
                      <div className="font-mono text-[10px] text-white/50 flex items-center gap-2 mt-0.5">
                        {guest.phone && <span>📞 {guest.phone}</span>}
                        {guest.email && <span>✉️ {guest.email}</span>}
                      </div>
                    </td>

                    {/* Category & Table */}
                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2 py-0.5 text-[9px] font-mono uppercase bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E7CF98]">
                        {guest.category}
                      </span>
                      {guest.tableOrSeat && (
                        <div className="text-[10px] text-neutral-400 mt-1 font-mono">
                          {guest.tableOrSeat}
                        </div>
                      )}
                    </td>

                    {/* RSVP Status */}
                    <td className="py-3.5 px-3">
                      {guest.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-montserrat text-[10px] font-bold uppercase">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Confirmado
                        </span>
                      ) : guest.status === 'declined' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/60 border border-rose-500/40 text-rose-300 font-montserrat text-[10px] font-bold uppercase">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          No Asiste
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-500/40 text-amber-300 font-montserrat text-[10px] font-semibold uppercase">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Pendiente
                        </span>
                      )}
                      {guest.respondedAt && (
                        <div className="text-[9px] font-mono text-white/40 mt-1">
                          {new Date(guest.respondedAt).toLocaleDateString('es-AR')}
                        </div>
                      )}
                    </td>

                    {/* Companions */}
                    <td className="py-3.5 px-3 text-neutral-300">
                      {guest.status === 'confirmed' ? (
                        <div className="font-semibold text-white">
                          {guest.confirmedCompanions > 0
                            ? `+${guest.confirmedCompanions} (${guest.companionName || 'Acompañante'})`
                            : 'Solo titular'}
                        </div>
                      ) : (
                        <span className="text-white/40 text-[11px]">
                          Permitidos: {guest.companionsAllowed}
                        </span>
                      )}
                    </td>

                    {/* Check-in Door */}
                    <td className="py-3.5 px-3">
                      {guest.checkedIn ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-950/70 border border-purple-500/50 text-purple-300 font-mono text-[10px] font-bold uppercase">
                            ✓ Ingresó
                          </span>
                          <div className="text-[9px] font-mono text-white/50 mt-0.5">
                            {guest.checkedInAt ? new Date(guest.checkedInAt).toLocaleTimeString('es-AR') : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/40 font-mono">No ingresó</span>
                      )}
                    </td>

                    {/* Actions Toolbar */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Invite Button */}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-black transition-colors rounded-sm"
                          title="Enviar invitación personalizada por WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </a>

                        {/* WhatsApp Reminder (Hoy es el evento) */}
                        <a
                          href={GuestService.getWhatsAppReminderUrl(guest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-950/80 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors rounded-sm border border-emerald-500/40"
                          title="Enviar recordatorio matutino del día del evento con QR y horario"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </a>

                        {/* Copy Link */}
                        <button
                          onClick={() => handleCopyLink(guest)}
                          className="p-1.5 bg-white/5 hover:bg-white/20 text-[#C5A059] transition-colors rounded-sm"
                          title="Copiar enlace RSVP"
                        >
                          {copiedId === guest.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* View QR & Card Modal */}
                        <button
                          onClick={() => setSelectedGuestForCard(guest)}
                          className="px-2 py-1 bg-[#C5A059]/20 hover:bg-[#C5A059] border border-[#C5A059]/50 text-[#E7CF98] hover:text-black font-montserrat text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors rounded-sm cursor-pointer"
                          title="Ver y descargar Código QR y Tarjeta Digital"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>

                        {/* Open Guest RSVP View */}
                        <button
                          onClick={() => onOpenRSVPPage(guest)}
                          className="p-1.5 bg-white/5 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors rounded-sm"
                          title="Abrir vista pública de confirmación (RSVP)"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteGuest(guest.id, `${guest.firstName} ${guest.lastName}`)}
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-900 text-rose-400 hover:text-rose-100 transition-colors rounded-sm"
                          title="Eliminar invitado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredGuests.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/40 font-montserrat">
                    No se encontraron invitados con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: View Single Invitation Card */}
      {selectedGuestForCard && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#141414] border border-[#C5A059] p-6 max-w-lg w-full rounded-sm shadow-2xl flex flex-col items-center my-8">
            <button
              onClick={() => setSelectedGuestForCard(null)}
              className="absolute top-3 right-3 text-white/60 hover:text-white font-mono text-sm p-1"
            >
              ✕ Cerrar
            </button>

            <h3 className="font-montserrat text-xs tracking-[0.2em] text-[#C5A059] uppercase font-bold mb-4">
              Tarjeta Digital & QR — DIVO 20 Años
            </h3>

            <InvitationCard guest={selectedGuestForCard} showActions={true} />
          </div>
        </div>
      )}

      {/* MODAL: Add Single Guest */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#C5A059] p-6 max-w-md w-full rounded-sm shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-3 right-3 text-white/60 hover:text-white font-mono text-sm"
            >
              ✕
            </button>

            <h3 className="font-montserrat text-sm tracking-[0.2em] text-[#C5A059] uppercase font-bold mb-4">
              Agregar Nuevo Invitado
            </h3>

            <form onSubmit={handleAddSingleGuest} className="space-y-3.5 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Ej: Marcelo"
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Apellido</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Ej: Tinelli"
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="invitado@correo.com"
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+549351..."
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as GuestCategory)}
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
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
                  <label className="block text-[11px] font-montserrat text-white/70 mb-1">Acompañantes Permitidos</label>
                  <select
                    value={newCompanionsAllowed}
                    onChange={(e) => setNewCompanionsAllowed(Number(e.target.value))}
                    className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value={0}>0 (Individual)</option>
                    <option value={1}>1 Acompañante</option>
                    <option value={2}>2 Acompañantes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-montserrat text-white/70 mb-1">Sector / Mesa sugerida</label>
                <input
                  type="text"
                  value={newTable}
                  onChange={(e) => setNewTable(e.target.value)}
                  placeholder="Ej: Fila 1 - Sector Capilla A"
                  className="w-full bg-[#1e1e1e] border border-white/20 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Guardar & Generar QR
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 bg-transparent border border-white/20 text-white font-montserrat text-xs uppercase"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Import Excel / CSV */}
      <ExcelImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        existingGuests={guests}
        onOpenQRGenerator={() => setIsBatchDownloadModalOpen(true)}
      />

      {/* MODAL: Centro Generador de QR & Descarga en Lote */}
      <QRGeneratorModal
        isOpen={isBatchDownloadModalOpen}
        onClose={() => setIsBatchDownloadModalOpen(false)}
        guests={guests}
        onSelectGuestForCard={(g) => setSelectedGuestForCard(g)}
      />

      {/* MODAL: Recordatorio Día del Evento WhatsApp */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border-2 border-emerald-500/70 p-6 max-w-2xl w-full rounded-sm shadow-2xl relative text-left">
            <button
              onClick={() => setIsReminderModalOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white font-mono text-sm"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-sm">
                <Bell className="w-5 h-5" />
              </span>
              <h3 className="font-montserrat text-base tracking-wider text-emerald-400 uppercase font-bold">
                Recordatorio Matutino del Evento por WhatsApp
              </h3>
            </div>
            <p className="text-xs text-white/70 mb-4">
              Enviá a cada invitado confirmado el recordatorio para hoy con su horario (19:00 hs), ubicación en Capilla Buen Pastor y enlace directo a su tarjeta con código QR.
            </p>

            <div className="bg-black/60 border border-white/10 p-3 mb-4 rounded-sm text-xs font-mono text-neutral-300">
              <span className="text-[#C5A059] font-bold block mb-1">Vista previa del mensaje:</span>
              "¡Hola [Nombre]! ✨ ¡Hoy es el gran día! Te esperamos esta tarde para celebrar juntos los 20 Años de DIVO Trajes y Etiqueta... ⏰ 19:00 hs puntual | 📍 Capilla Buen Pastor | 👔 Dress Code: Elegante | 🎟️ Tu pase y QR: [Link]"
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-white/5 border border-white/10 p-2 bg-[#101010]">
              {guests.filter((g) => g.status === 'confirmed').length === 0 ? (
                <div className="text-center py-6 text-xs text-white/40">
                  No hay invitados confirmados aún.
                </div>
              ) : (
                guests
                  .filter((g) => g.status === 'confirmed')
                  .map((guest) => {
                    const reminderUrl = GuestService.getWhatsAppReminderUrl(guest);
                    return (
                      <div key={guest.id} className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors">
                        <div>
                          <div className="font-montserrat font-bold text-xs text-white">
                            {guest.firstName} {guest.lastName}
                          </div>
                          <div className="text-[10px] text-white/50 font-mono">
                            {guest.phone ? `📞 ${guest.phone}` : 'Sin teléfono'} • {guest.category}
                          </div>
                        </div>

                        <a
                          href={reminderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-montserrat text-[11px] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Enviar Recordatorio</span>
                        </a>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="py-2 px-5 bg-white/10 hover:bg-white/20 text-white font-montserrat text-xs uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBIR LOGO OFICIAL REAL */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#C5A059] max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#C5A059]" />
                <h3 className="font-montserrat text-sm font-bold tracking-widest uppercase text-[#C5A059]">
                  Subir Logo Real — DIVO 20 Años
                </h3>
              </div>
              <button
                onClick={() => setIsLogoModalOpen(false)}
                className="text-white/50 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70 font-montserrat mb-4 leading-relaxed">
              Subí el archivo original del logo (idealmente <strong>PNG con fondo transparente</strong> o <strong>SVG</strong>). Se actualizará automáticamente en la barra superior, tarjetas de invitación, página RSVP, Muro en Vivo y plantillas de Instagram Stories.
            </p>

            {/* Vista previa actual */}
            <div className="bg-black border border-[#C5A059]/30 p-6 flex flex-col items-center justify-center min-h-[160px] mb-4">
              <span className="text-[10px] font-montserrat uppercase tracking-widest text-white/40 mb-3">
                Vista Previa Actual
              </span>
              <DivoLogo size="md" />
            </div>

            {/* Selector de archivo */}
            <div className="flex flex-col gap-3">
              <label className="w-full py-3 px-4 bg-gradient-to-r from-[#C5A059] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9a783e] text-black font-montserrat text-xs font-bold uppercase tracking-widest text-center cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all">
                <Upload className="w-4 h-4" />
                <span>Seleccionar archivo de Logo (PNG / SVG / WEBP)</span>
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const result = reader.result as string;
                      setCustomLogoUrl(result);
                      setCustomLogoPreview(result);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>

              {customLogoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomLogoUrl(null);
                    setCustomLogoPreview(null);
                  }}
                  className="py-2 px-4 bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-300 font-montserrat text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Logo Tipográfico Original</span>
                </button>
              )}
            </div>

            <div className="pt-5 mt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLogoModalOpen(false)}
                className="py-2 px-5 bg-white/10 hover:bg-white/20 text-white font-montserrat text-xs uppercase tracking-wider cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
