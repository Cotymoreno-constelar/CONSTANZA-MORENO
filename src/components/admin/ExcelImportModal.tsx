import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ClipboardPaste,
  Check,
  Sparkles,
  Users
} from 'lucide-react';
import { Guest, GuestCategory, RSVPStatus } from '../../types/guest';
import { GuestService } from '../../services/guestService';

interface ParsedRow {
  tempId: string;
  selected: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  category: GuestCategory;
  companionsAllowed: number;
  tableOrSeat: string;
  status: RSVPStatus;
  companionName: string;
  isDuplicate: boolean;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingGuests: Guest[];
  onOpenQRGenerator?: () => void;
}

const VALID_CATEGORIES: GuestCategory[] = [
  'VIP',
  'Prensa',
  'Staff',
  'Cliente Distinguido',
  'Familia & Amigos',
  'Invitado General',
];

function normalizeHeader(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchCategory(raw: string, fallback: GuestCategory = 'Invitado General'): GuestCategory {
  if (!raw) return fallback;
  const clean = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.includes('vip') || clean.includes('celebridad') || clean.includes('especial')) return 'VIP';
  if (clean.includes('prensa') || clean.includes('medio') || clean.includes('periodista') || clean.includes('influencer')) return 'Prensa';
  if (clean.includes('staff') || clean.includes('equipo') || clean.includes('organizacion') || clean.includes('modelo')) return 'Staff';
  if (clean.includes('cliente') || clean.includes('distinguido') || clean.includes('embajador')) return 'Cliente Distinguido';
  if (clean.includes('familia') || clean.includes('amigo')) return 'Familia & Amigos';
  if (clean.includes('general') || clean.includes('invitado')) return 'Invitado General';

  return fallback;
}

function matchStatus(raw: string): RSVPStatus {
  if (!raw) return 'pending';
  const clean = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    clean === 'confirmado' ||
    clean === 'confirmed' ||
    clean === 'si' ||
    clean === 'asiste' ||
    clean === 'confirmada'
  ) {
    return 'confirmed';
  }
  if (
    clean === 'no asiste' ||
    clean === 'declined' ||
    clean === 'cancelado' ||
    clean === 'no' ||
    clean === 'rechazado'
  ) {
    return 'declined';
  }
  return 'pending';
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: '', lastName: '' };

  // Handle "Apellido, Nombre" format if comma exists
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map((s) => s.trim());
    return {
      firstName: first || last || 'Invitado',
      lastName: first ? last : '',
    };
  }

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  // 3 or more words: e.g. "Juan Carlos Pérez" -> firstName: "Juan Carlos", lastName: "Pérez"
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

export function exportGuestsToExcel(guests: Guest[]) {
  const mainData = guests.map((g, idx) => ({
    '#': idx + 1,
    'ID Invitación': g.id,
    'Nombre': g.firstName,
    'Apellido': g.lastName,
    'Categoría': g.category,
    'Teléfono / WhatsApp': g.phone || '',
    'Email': g.email || '',
    'Ubicación / Sector': g.tableOrSeat || '',
    'Acompañantes Permitidos': g.companionsAllowed,
    'Estado RSVP':
      g.status === 'confirmed'
        ? 'Confirmado'
        : g.status === 'declined'
        ? 'No Asiste'
        : 'Pendiente',
    'Acompañantes Confirmados': g.confirmedCompanions || 0,
    'Nombre Acompañante': g.companionName || '',
    'Total Personas': g.status === 'confirmed' ? 1 + (g.confirmedCompanions || 0) : 0,
    'Ingresó en Puerta': g.checkedIn ? 'SÍ' : 'NO',
    'Hora de Ingreso': g.checkedInAt
      ? new Date(g.checkedInAt).toLocaleString('es-AR')
      : '',
    'Mensaje / Dedicatoria': g.congratulationMessage || '',
    'Link Personalizado RSVP': GuestService.getRSVPUrl(g),
  }));

  const confirmedData = mainData.filter((r) => r['Estado RSVP'] === 'Confirmado');
  const checkedInData = mainData.filter((r) => r['Ingresó en Puerta'] === 'SÍ');

  const wb = XLSX.utils.book_new();

  const wsAll = XLSX.utils.json_to_sheet(mainData);
  wsAll['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 25 },
    { wch: 24 },
    { wch: 14 },
    { wch: 15 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 30 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Padrón Completo');

  if (confirmedData.length > 0) {
    const wsConfirmed = XLSX.utils.json_to_sheet(confirmedData);
    wsConfirmed['!cols'] = wsAll['!cols'];
    XLSX.utils.book_append_sheet(wb, wsConfirmed, 'Confirmados');
  }

  if (checkedInData.length > 0) {
    const wsCheckedIn = XLSX.utils.json_to_sheet(checkedInData);
    wsCheckedIn['!cols'] = wsAll['!cols'];
    XLSX.utils.book_append_sheet(wb, wsCheckedIn, 'Ingresados Puerta');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `DIVO-20-Anos-Invitados-${dateStr}.xlsx`);
}

export function downloadExcelTemplate() {
  const sampleRows = [
    {
      'Nombre': 'Agustín',
      'Apellido': 'Cremona',
      'Teléfono / WhatsApp': '+5493515550101',
      'Email': 'agustin@ejemplo.com',
      'Categoría': 'VIP',
      'Acompañantes Permitidos': 1,
      'Sector / Ubicación': 'Fila 1 - Capilla Central',
      'Estado RSVP': 'Pendiente',
      'Nombre Acompañante': '',
    },
    {
      'Nombre': 'Martina',
      'Apellido': 'Sánchez',
      'Teléfono / WhatsApp': '+5493515550202',
      'Email': 'martina@prensa.com',
      'Categoría': 'Prensa',
      'Acompañantes Permitidos': 1,
      'Sector / Ubicación': 'Sector Prensa & Medios',
      'Estado RSVP': 'Confirmado',
      'Nombre Acompañante': 'Lucas Gómez',
    },
    {
      'Nombre': 'Federico',
      'Apellido': 'Almada',
      'Teléfono / WhatsApp': '+5493515550303',
      'Email': 'fede@correo.com',
      'Categoría': 'Cliente Distinguido',
      'Acompañantes Permitidos': 1,
      'Sector / Ubicación': 'Sector Preferencial B',
      'Estado RSVP': 'Pendiente',
      'Nombre Acompañante': '',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 26 },
    { wch: 22 },
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Invitados');
  XLSX.writeFile(wb, 'Plantilla-Invitados-DIVO-20-Anos.xlsx');
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingGuests,
  onOpenQRGenerator,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<GuestCategory>('Invitado General');
  const [defaultCompanions, setDefaultCompanions] = useState<number>(1);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const checkIsDuplicate = (firstName: string, lastName: string, phone: string, email: string): boolean => {
    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanEmail = email.trim().toLowerCase();

    return existingGuests.some((g) => {
      const existingName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      const existingPhone = (g.phone || '').replace(/[^0-9]/g, '');
      const existingEmail = (g.email || '').trim().toLowerCase();

      if (fullName && existingName === fullName) return true;
      if (cleanPhone.length >= 7 && existingPhone === cleanPhone) return true;
      if (cleanEmail && existingEmail === cleanEmail) return true;
      return false;
    });
  };

  const processRawRows = (rows: any[][]) => {
    setErrorMessage(null);
    setImportSuccessCount(null);

    const nonEmptyRows = rows.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim().length > 0)
    );

    if (nonEmptyRows.length === 0) {
      setErrorMessage('El archivo o texto está vacío.');
      return;
    }

    // Detect if first row is a header row
    const firstRowNorm = nonEmptyRows[0].map((c) => normalizeHeader(String(c ?? '')));
    const headerKeywords = [
      'nombre',
      'firstname',
      'name',
      'invitado',
      'titular',
      'apellido',
      'lastname',
      'telefono',
      'whatsapp',
      'celular',
      'phone',
      'email',
      'correo',
      'mail',
      'categoria',
      'category',
      'tipo',
      'mesa',
      'sector',
      'ubicacion',
    ];

    const hasHeader = firstRowNorm.some((col) =>
      headerKeywords.some((kw) => col.includes(kw))
    );

    const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;

    // Map column indices
    let idxFirstName = -1;
    let idxLastName = -1;
    let idxFullName = -1;
    let idxPhone = -1;
    let idxEmail = -1;
    let idxCategory = -1;
    let idxCompanions = -1;
    let idxTable = -1;
    let idxStatus = -1;
    let idxCompanionName = -1;

    if (hasHeader) {
      firstRowNorm.forEach((col, i) => {
        if (!col) return;
        if (
          col === 'nombrecompleto' ||
          col === 'nombreyapellido' ||
          col === 'apellidoynombre' ||
          col === 'invitado' ||
          col === 'titular'
        ) {
          idxFullName = i;
        } else if ((col.includes('nombre') || col === 'name' || col === 'firstname') && !col.includes('acompanante')) {
          if (idxFirstName === -1) idxFirstName = i;
        } else if (col.includes('apellido') || col === 'lastname' || col === 'surname') {
          if (idxLastName === -1) idxLastName = i;
        } else if (
          col.includes('tel') ||
          col.includes('whatsapp') ||
          col.includes('cel') ||
          col.includes('movil') ||
          col.includes('phone')
        ) {
          if (idxPhone === -1) idxPhone = i;
        } else if (col.includes('mail') || col.includes('correo')) {
          if (idxEmail === -1) idxEmail = i;
        } else if (col.includes('categ') || col.includes('tipo') || col.includes('grupo') || col.includes('rol')) {
          if (idxCategory === -1) idxCategory = i;
        } else if (col.includes('acompanante') && (col.includes('nombre') || col.includes('invitado'))) {
          if (idxCompanionName === -1) idxCompanionName = i;
        } else if (
          col.includes('acomp') ||
          col.includes('cupo') ||
          col.includes('pase') ||
          col.includes('cantidad') ||
          col.includes('guests')
        ) {
          if (idxCompanions === -1) idxCompanions = i;
        } else if (
          col.includes('sector') ||
          col.includes('mesa') ||
          col.includes('ubicacion') ||
          col.includes('fila') ||
          col.includes('asiento')
        ) {
          if (idxTable === -1) idxTable = i;
        } else if (col.includes('estado') || col.includes('rsvp') || col.includes('confirm')) {
          if (idxStatus === -1) idxStatus = i;
        }
      });
    }

    const result: ParsedRow[] = [];

    dataRows.forEach((row, index) => {
      const getVal = (colIdx: number) =>
        colIdx >= 0 && colIdx < row.length ? String(row[colIdx] ?? '').trim() : '';

      let firstName = '';
      let lastName = '';

      if (hasHeader) {
        if (idxFirstName !== -1 && idxLastName !== -1) {
          firstName = getVal(idxFirstName);
          lastName = getVal(idxLastName);
          // If lastName is empty and firstName has multiple words, split it automatically
          if (!lastName && firstName.includes(' ')) {
            const split = splitFullName(firstName);
            firstName = split.firstName;
            lastName = split.lastName;
          }
        } else if (idxFullName !== -1) {
          const split = splitFullName(getVal(idxFullName));
          firstName = split.firstName;
          lastName = split.lastName;
        } else if (idxFirstName !== -1) {
          const split = splitFullName(getVal(idxFirstName));
          firstName = split.firstName;
          lastName = split.lastName;
        } else {
          // Fallback to first column
          const split = splitFullName(getVal(0));
          firstName = split.firstName;
          lastName = split.lastName;
        }
      } else {
        // Positional parsing when there is no header
        if (row.length === 1) {
          const split = splitFullName(getVal(0));
          firstName = split.firstName;
          lastName = split.lastName;
        } else {
          // Check if col 0 is full name and col 1 is phone/category/email
          const col0 = getVal(0);
          const col1 = getVal(1);
          const col1LooksLikeMeta =
            col1.includes('@') ||
            /^[+\d\s()-]{6,}$/.test(col1) ||
            VALID_CATEGORIES.some((c) => c.toLowerCase() === col1.toLowerCase());

          if (col1LooksLikeMeta) {
            const split = splitFullName(col0);
            firstName = split.firstName;
            lastName = split.lastName;
          } else {
            firstName = col0;
            lastName = col1;
          }
        }
      }

      if (!firstName && !lastName) return;
      if (!firstName) {
        firstName = lastName;
        lastName = '';
      }

      let phone = hasHeader ? getVal(idxPhone) : getVal(2);
      let email = hasHeader ? getVal(idxEmail) : getVal(3);
      let rawCategory = hasHeader ? getVal(idxCategory) : getVal(4);
      let rawCompanions = hasHeader ? getVal(idxCompanions) : getVal(5);
      let tableOrSeat = hasHeader ? getVal(idxTable) : getVal(6);
      let rawStatus = hasHeader ? getVal(idxStatus) : '';
      let companionName = hasHeader ? getVal(idxCompanionName) : '';

      // Smart scan if headerless
      if (!hasHeader) {
        phone = '';
        email = '';
        rawCategory = '';
        for (let c = 1; c < row.length; c++) {
          const cellVal = getVal(c);
          if (!cellVal) continue;
          if (cellVal.includes('@') && !email) {
            email = cellVal;
          } else if (/^[+\d\s()-]{6,}$/.test(cellVal) && !phone) {
            phone = cellVal;
          } else if (
            VALID_CATEGORIES.some((cat) =>
              cellVal.toLowerCase().includes(cat.toLowerCase().split(' ')[0])
            )
          ) {
            rawCategory = cellVal;
          }
        }
      }

      const category = matchCategory(rawCategory, defaultCategory);
      const parsedComp = parseInt(rawCompanions, 10);
      const companionsAllowed = !isNaN(parsedComp) && parsedComp >= 0 ? parsedComp : defaultCompanions;
      const status = matchStatus(rawStatus);
      const isDuplicate = checkIsDuplicate(firstName, lastName, phone, email);

      result.push({
        tempId: `row-${index}-${Math.random().toString(36).slice(2, 7)}`,
        selected: !isDuplicate || !skipDuplicates,
        firstName,
        lastName,
        phone,
        email,
        category,
        companionsAllowed,
        tableOrSeat,
        status,
        companionName,
        isDuplicate,
      });
    });

    if (result.length === 0) {
      setErrorMessage('No se encontraron filas válidas de invitados en el archivo.');
      return;
    }

    setParsedRows(result);
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: '',
        });
        processRawRows(jsonRows);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setErrorMessage('No se pudo leer el archivo. Asegurate de subir un archivo Excel (.xlsx, .xls) o CSV válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      setErrorMessage('Pegá al menos una fila de invitados para previsualizar.');
      return;
    }
    const lines = pasteText
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);

    const rows = lines.map((line) => {
      if (line.includes('\t')) {
        return line.split('\t').map((c) => c.trim());
      }
      if (line.includes(';')) {
        return line.split(';').map((c) => c.trim());
      }
      if (line.includes(',')) {
        return line.split(',').map((c) => c.trim());
      }
      return [line.trim()];
    });

    setFileName('Datos pegados desde portapapeles');
    processRawRows(rows);
  };

  const handleToggleRow = (tempId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleUpdateRowField = (
    tempId: string,
    field: keyof ParsedRow,
    value: any
  ) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveRow = (tempId: string) => {
    setParsedRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleToggleSkipDuplicates = (checked: boolean) => {
    setSkipDuplicates(checked);
    setParsedRows((prev) =>
      prev.map((r) => (r.isDuplicate ? { ...r, selected: !checked } : r))
    );
  };

  const selectedRows = parsedRows.filter((r) => r.selected);

  const handleConfirmImport = async () => {
    if (selectedRows.length === 0) return;
    setIsImporting(true);
    try {
      await GuestService.addMultipleGuests(
        selectedRows.map((r) => ({
          firstName: r.firstName.trim() || 'Invitado',
          lastName: r.lastName.trim(),
          phone: r.phone.trim() || undefined,
          email: r.email.trim() || undefined,
          category: r.category,
          companionsAllowed: r.companionsAllowed,
          tableOrSeat: r.tableOrSeat.trim() || undefined,
          status: r.status,
          companionName: r.companionName.trim() || undefined,
        })),
        replaceExisting
      );
      setImportSuccessCount(selectedRows.length);
      setParsedRows([]);
      setFileName(null);
      setPasteText('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Ocurrió un error al importar los invitados.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#121212] border border-[#C5A059] max-w-5xl w-full p-6 rounded-sm shadow-2xl relative text-left my-8 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#C5A059]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-montserrat text-base tracking-[0.15em] text-[#C5A059] uppercase font-bold">
                  Importación Masiva en Excel / CSV
                </h3>
                {onOpenQRGenerator && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenQRGenerator();
                    }}
                    className="px-2.5 py-1 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
                    title="Abrir el Centro Generador de Códigos QR y Tarjetas"
                  >
                    Abrir Generador de QR →
                  </button>
                )}
              </div>
              <p className="text-xs text-white/60 font-montserrat mt-0.5">
                Subí tu planilla Excel (.xlsx, .xls, .csv) o copiá y pegá las celdas directamente desde Excel o Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="py-2 px-3.5 bg-[#1b1b1b] hover:bg-[#262626] border border-[#C5A059]/50 text-[#E7CF98] font-montserrat text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar archivo Excel de ejemplo con las columnas listas para completar"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Descargar Plantilla Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white font-mono text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {importSuccessCount !== null && (
          <div className="my-6 p-6 bg-emerald-950/60 border border-emerald-500/60 text-center flex flex-col items-center justify-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <h4 className="font-montserrat text-lg font-bold text-white uppercase tracking-wider">
              ¡{importSuccessCount} Invitados Importados con Éxito!
            </h4>
            <p className="text-xs text-emerald-200/80 font-montserrat max-w-md">
              Se generaron automáticamente sus pases individuales y códigos QR únicos de acceso. Podés descargar todas las tarjetas o códigos QR desde el Generador de QR.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              {onOpenQRGenerator && (
                <button
                  type="button"
                  onClick={() => {
                    setImportSuccessCount(null);
                    onClose();
                    onOpenQRGenerator();
                  }}
                  className="py-2.5 px-5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg"
                >
                  Ver y Descargar QRs Generados →
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setImportSuccessCount(null);
                  onClose();
                }}
                className="py-2.5 px-5 bg-white/10 hover:bg-white/20 text-white font-montserrat text-xs uppercase tracking-wider cursor-pointer"
              >
                Volver al Padrón
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Upload or Paste (shown when no rows parsed yet) */}
        {parsedRows.length === 0 && importSuccessCount === null && (
          <div className="py-4 space-y-4 overflow-y-auto">
            {/* Mode Tabs & Default Options */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#181818] p-3 border border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`py-2 px-4 font-montserrat text-xs uppercase tracking-wider font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'file'
                      ? 'bg-[#C5A059] text-black'
                      : 'bg-black/40 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Subir Archivo Excel (.xlsx / .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`py-2 px-4 font-montserrat text-xs uppercase tracking-wider font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-[#C5A059] text-black'
                      : 'bg-black/40 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Copiar y Pegar desde Excel</span>
                </button>
              </div>

              {/* Default values if not specified in Excel */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 font-montserrat text-[11px]">Categoría por defecto:</span>
                  <select
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value as GuestCategory)}
                    className="bg-[#101010] border border-white/20 px-2.5 py-1 text-xs text-[#E7CF98] font-montserrat focus:outline-none focus:border-[#C5A059]"
                  >
                    {VALID_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 font-montserrat text-[11px]">Acompañantes:</span>
                  <select
                    value={defaultCompanions}
                    onChange={(e) => setDefaultCompanions(Number(e.target.value))}
                    className="bg-[#101010] border border-white/20 px-2.5 py-1 text-xs text-white font-montserrat focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value={0}>0 (Solo titular)</option>
                    <option value={1}>+1 Acompañante</option>
                    <option value={2}>+2 Acompañantes</option>
                  </select>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-montserrat flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {activeTab === 'file' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-[#C5A059] bg-[#C5A059]/10'
                    : 'border-white/20 hover:border-[#C5A059]/70 bg-[#161616]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059]">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-montserrat text-sm font-bold text-white uppercase tracking-wider">
                    Arrastrá tu archivo Excel (.xlsx / .xls / .csv) aquí o hacé clic para buscarlo
                  </p>
                  <p className="text-xs text-white/50 font-montserrat mt-1">
                    Detecta automáticamente las columnas: <span className="text-[#E7CF98]">Nombre, Apellido, Teléfono/WhatsApp, Email, Categoría, Acompañantes y Sector</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/70 font-montserrat">
                  Seleccioná las celdas en tu planilla de <strong>Excel</strong> o <strong>Google Sheets</strong>, copialas (<kbd className="px-1.5 py-0.5 bg-white/10 text-[#E7CF98] font-mono">Ctrl+C</kbd>) y pegalas acá abajo (<kbd className="px-1.5 py-0.5 bg-white/10 text-[#E7CF98] font-mono">Ctrl+V</kbd>):
                </p>
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Nombre\tApellido\tTeléfono\tEmail\tCategoría\tAcompañantes\tSector\nGuillermo\tFrancella\t+5491155550101\tguillermo@mail.com\tVIP\t1\tFila 1 Capilla\nValeria\tMazza\t+5491155550202\tvaleria@mail.com\tVIP\t1\tFila 1 Capilla`}
                  className="w-full bg-[#181818] border border-white/20 p-3.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParsePaste}
                    className="py-2.5 px-6 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Previsualizar Datos Pegados
                  </button>
                </div>
              </div>
            )}

            {/* Column Guide */}
            <div className="bg-black/50 border border-white/10 p-4 text-xs">
              <div className="flex items-center gap-2 text-[#C5A059] font-montserrat font-bold uppercase tracking-wider text-[11px] mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Reconocimiento Inteligente de Columnas</span>
              </div>
              <p className="text-white/60 font-montserrat text-[11px] leading-relaxed">
                No hace falta que tu Excel tenga un orden estricto. El sistema reconoce tanto columnas separadas (<strong>Nombre</strong> y <strong>Apellido</strong>) como una sola columna de <strong>Nombre Completo / Invitado</strong>, además de <strong>Teléfono / WhatsApp / Celular</strong>, <strong>Email</strong>, <strong>Categoría</strong> (VIP, Prensa, Cliente Distinguido, Familia & Amigos, Staff, Invitado General), <strong>Acompañantes</strong> y <strong>Sector / Ubicación</strong>. Podrás revisar y editar cada fila antes de confirmar.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Preview & Validation Table */}
        {parsedRows.length > 0 && importSuccessCount === null && (
          <div className="flex-1 flex flex-col min-h-0 pt-4">
            {/* Toolbar above table */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#181818] p-3 border border-white/10 mb-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-montserrat text-xs font-bold text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#C5A059]" />
                  <span>
                    {selectedRows.length} de {parsedRows.length} invitados seleccionados para importar
                  </span>
                </span>
                {fileName && (
                  <span className="text-[11px] font-mono text-[#E7CF98] bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5">
                    📄 {fileName}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {existingGuests.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-950/30 border border-rose-500/30 px-2.5 py-1 font-montserrat cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setReplaceExisting(checked);
                        if (checked) {
                          setParsedRows((prev) => prev.map((r) => ({ ...r, selected: true })));
                        }
                      }}
                      className="accent-rose-500"
                    />
                    <span>
                      Reemplazar padrón actual (eliminar los {existingGuests.length} existentes)
                    </span>
                  </label>
                )}

                {!replaceExisting && parsedRows.some((r) => r.isDuplicate) && (
                  <label className="flex items-center gap-1.5 text-xs text-amber-300 font-montserrat cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => handleToggleSkipDuplicates(e.target.checked)}
                      className="accent-[#C5A059]"
                    />
                    <span>
                      Omitir duplicados detectados ({parsedRows.filter((r) => r.isDuplicate).length})
                    </span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setFileName(null);
                  }}
                  className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white font-montserrat text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Cambiar Archivo
                </button>
              </div>
            </div>

            {/* Scrollable Preview Table */}
            <div className="flex-1 overflow-y-auto border border-white/10 bg-[#0e0e0e] max-h-[48vh]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#1a1a1a] border-b border-white/15 text-neutral-300 font-montserrat text-[10px] uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === parsedRows.length && parsedRows.length > 0}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setParsedRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
                        }}
                        className="accent-[#C5A059]"
                      />
                    </th>
                    <th className="py-2.5 px-2">Nombre *</th>
                    <th className="py-2.5 px-2">Apellido</th>
                    <th className="py-2.5 px-2">Teléfono / WhatsApp</th>
                    <th className="py-2.5 px-2">Categoría</th>
                    <th className="py-2.5 px-2 w-20">Acomp.</th>
                    <th className="py-2.5 px-2">Sector / Ubicación</th>
                    <th className="py-2.5 px-2">Estado</th>
                    <th className="py-2.5 px-2 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.tempId}
                      className={`transition-colors ${
                        !row.selected
                          ? 'opacity-40 bg-black/40'
                          : row.isDuplicate
                          ? 'bg-amber-950/20 hover:bg-amber-950/30'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => handleToggleRow(row.tempId)}
                          className="accent-[#C5A059]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.firstName}
                          onChange={(e) =>
                            handleUpdateRowField(row.tempId, 'firstName', e.target.value)
                          }
                          className="w-full bg-[#181818] border border-white/15 px-2 py-1 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                        />
                        {row.isDuplicate && (
                          <span className="inline-block mt-0.5 text-[9px] font-mono text-amber-400">
                            ⚠ Ya existe en el padrón
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.lastName}
                          onChange={(e) =>
                            handleUpdateRowField(row.tempId, 'lastName', e.target.value)
                          }
                          className="w-full bg-[#181818] border border-white/15 px-2 py-1 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.phone}
                          placeholder="+549351..."
                          onChange={(e) =>
                            handleUpdateRowField(row.tempId, 'phone', e.target.value)
                          }
                          className="w-full bg-[#181818] border border-white/15 px-2 py-1 text-xs font-mono text-white focus:border-[#C5A059] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={row.category}
                          onChange={(e) =>
                            handleUpdateRowField(
                              row.tempId,
                              'category',
                              e.target.value as GuestCategory
                            )
                          }
                          className="bg-[#181818] border border-white/15 px-2 py-1 text-xs text-[#E7CF98] focus:border-[#C5A059] focus:outline-none"
                        >
                          {VALID_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={row.companionsAllowed}
                          onChange={(e) =>
                            handleUpdateRowField(
                              row.tempId,
                              'companionsAllowed',
                              Number(e.target.value)
                            )
                          }
                          className="w-full bg-[#181818] border border-white/15 px-2 py-1 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                        >
                          <option value={0}>0</option>
                          <option value={1}>+1</option>
                          <option value={2}>+2</option>
                          <option value={3}>+3</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.tableOrSeat}
                          placeholder="Ej: Fila 1"
                          onChange={(e) =>
                            handleUpdateRowField(row.tempId, 'tableOrSeat', e.target.value)
                          }
                          className="w-full bg-[#181818] border border-white/15 px-2 py-1 text-xs text-white focus:border-[#C5A059] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleUpdateRowField(
                              row.tempId,
                              'status',
                              e.target.value as RSVPStatus
                            )
                          }
                          className="bg-[#181818] border border-white/15 px-2 py-1 text-[11px] text-white focus:border-[#C5A059] focus:outline-none"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="declined">No Asiste</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.tempId)}
                          className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer"
                          title="Quitar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Confirmation */}
            <div className="pt-4 mt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-white/60 font-montserrat">
                Se crearán <strong className="text-[#C5A059]">{selectedRows.length}</strong> tarjetas digitales con código QR único listas para enviar por WhatsApp.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 bg-transparent border border-white/20 text-white font-montserrat text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedRows.length === 0 || isImporting}
                  onClick={handleConfirmImport}
                  className="py-2.5 px-6 bg-gradient-to-r from-[#C5A059] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9a783e] disabled:opacity-40 text-black font-montserrat text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isImporting
                      ? 'Importando...'
                      : `Confirmar e Importar (${selectedRows.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
