import { Guest, EventStats, RSVPStatus } from '../types/guest';
import { INITIAL_GUESTS } from '../data/initialGuests';

const STORAGE_KEY = 'divo_20_guests_data_v1';
const QR_MODE_STORAGE_KEY = 'divo_20_qr_mode_v1';
const CUSTOM_DOMAIN_STORAGE_KEY = 'divo_20_custom_domain_v1';

export type QRContentMode = 'pass' | 'url' | 'whatsapp';

export function calculateStats(guests: Guest[]): EventStats {
  const totalInvitations = guests.length;
  const confirmedList = guests.filter((g) => g.status === 'confirmed');
  const confirmedGuests = confirmedList.length;
  const confirmedCompanions = confirmedList.reduce((acc, g) => acc + (g.confirmedCompanions || 0), 0);
  const totalAttendingPeople = confirmedGuests + confirmedCompanions;
  const declinedGuests = guests.filter((g) => g.status === 'declined').length;
  const pendingGuests = guests.filter((g) => g.status === 'pending').length;

  const checkedInList = guests.filter((g) => g.checkedIn);
  const checkedInGuests = checkedInList.length;
  const totalCheckedInPeople = checkedInList.reduce(
    (acc, g) => acc + 1 + (g.confirmedCompanions || 0),
    0
  );

  const attendancePercentage = totalInvitations > 0 
    ? Math.round((confirmedGuests / totalInvitations) * 100) 
    : 0;

  return {
    totalInvitations,
    confirmedGuests,
    confirmedCompanions,
    totalAttendingPeople,
    declinedGuests,
    pendingGuests,
    checkedInGuests,
    totalCheckedInPeople,
    attendancePercentage,
  };
}

export class GuestService {
  private static listeners: Set<(guests: Guest[]) => void> = new Set();
  private static eventSource: EventSource | null = null;
  private static isInitialized = false;

  private static getLocalGuests(): Guest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: Guest[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const existingTokens = new Set(parsed.map((g) => (g.token || '').toLowerCase()));
          const missingInitial = INITIAL_GUESTS.filter(
            (ig) => !existingTokens.has(ig.token.toLowerCase())
          );
          if (missingInitial.length > 0) {
            const merged = [...missingInitial, ...parsed];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
    // Initialize with default
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GUESTS));
    return INITIAL_GUESTS;
  }

  private static setLocalGuests(guests: Guest[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
      this.notifyListeners(guests);
    } catch (e) {
      console.warn('Error writing to localStorage', e);
    }
  }

  private static notifyListeners(guests: Guest[]): void {
    this.listeners.forEach((listener) => listener(guests));
  }

  public static subscribe(callback: (guests: Guest[]) => void): () => void {
    this.listeners.add(callback);
    if (!this.isInitialized) {
      this.initRealtime();
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static initRealtime(): void {
    this.isInitialized = true;
    try {
      // Connect to Server-Sent Events if available
      if (typeof window !== 'undefined' && window.EventSource) {
        this.eventSource = new EventSource('/api/events');
        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC_ALL' || data.type === 'GUEST_UPDATED') {
              if (Array.isArray(data.guests)) {
                this.setLocalGuests(data.guests);
              }
            }
          } catch (err) {
            console.error('SSE message parse error', err);
          }
        };

        this.eventSource.onerror = () => {
          // SSE reconnects automatically
        };
      }
    } catch (e) {
      console.warn('SSE not initialized, relying on local sync', e);
    }

    // Also support multi-tab synchronization via BroadcastChannel or storage event
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            const updated = JSON.parse(e.newValue);
            this.notifyListeners(updated);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public static async getAllGuests(): Promise<Guest[]> {
    const local = this.getLocalGuests();
    try {
      const response = await fetch('/api/guests');
      if (response.ok) {
        const serverGuests = await response.json();
        if (Array.isArray(serverGuests)) {
          // Merge local guests that might not have been persisted to server yet
          const serverTokens = new Set(serverGuests.map((g: Guest) => g.token.toLowerCase()));
          const serverIds = new Set(serverGuests.map((g: Guest) => g.id.toLowerCase()));
          const unsyncedLocal = local.filter(
            (lg) =>
              lg &&
              lg.id &&
              lg.token &&
              !serverIds.has(lg.id.toLowerCase()) &&
              !serverTokens.has(lg.token.toLowerCase())
          );

          if (unsyncedLocal.length > 0) {
            const merged = [...unsyncedLocal, ...serverGuests];
            this.setLocalGuests(merged);
            fetch('/api/guests/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ guests: unsyncedLocal }),
            }).catch(() => {});
            return merged;
          }

          this.setLocalGuests(serverGuests);
          return serverGuests;
        }
      }
    } catch {
      // Offline / dev fallback
    }
    return local;
  }

  public static async getGuestByIdOrToken(idOrToken: string): Promise<Guest | null> {
    const cleanQuery = idOrToken.trim().toLowerCase();
    const guests = await this.getAllGuests();
    const found = guests.find(
      (g) =>
        g.id.toLowerCase() === cleanQuery ||
        g.token.toLowerCase() === cleanQuery ||
        `${g.firstName} ${g.lastName}`.toLowerCase() === cleanQuery
    );

    if (found) return found;

    // Direct API fallback
    try {
      const res = await fetch(`/api/guests/${encodeURIComponent(cleanQuery)}`);
      if (res.ok) {
        const directGuest: Guest = await res.json();
        const current = this.getLocalGuests();
        this.setLocalGuests([directGuest, ...current.filter((g) => g.id !== directGuest.id)]);
        return directGuest;
      }
    } catch {
      // offline
    }

    return null;
  }

  public static async addGuest(
    guestData: Omit<Guest, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'checkedIn' | 'status' | 'confirmedCompanions'> & {
      status?: RSVPStatus;
      confirmedCompanions?: number;
    }
  ): Promise<Guest> {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const slugName = guestData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newId = `divo-${slugName || 'inv'}-${randomSuffix}`;
    const newToken = `tk-${Math.random().toString(36).substring(2, 9)}`;
    const status: RSVPStatus = guestData.status || 'confirmed';
    const confirmedCompanions =
      status === 'confirmed'
        ? guestData.confirmedCompanions ?? guestData.companionsAllowed ?? 0
        : 0;

    const newGuest: Guest = {
      ...guestData,
      id: newId,
      token: newToken,
      status,
      confirmedCompanions,
      checkedIn: false,
      respondedAt: status !== 'pending' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGuest),
      });
      if (response.ok) {
        const created = await response.json();
        const current = this.getLocalGuests();
        const updated = [created, ...current.filter((g) => g.id !== created.id)];
        this.setLocalGuests(updated);
        return created;
      }
    } catch {
      // Local fallback
    }

    const current = this.getLocalGuests();
    const updated = [newGuest, ...current];
    this.setLocalGuests(updated);
    return newGuest;
  }

  public static async addMultipleGuests(
    guestsData: Array<
      Omit<Guest, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'checkedIn' | 'status' | 'confirmedCompanions'> & {
        status?: RSVPStatus;
        confirmedCompanions?: number;
      }
    >
  ): Promise<Guest[]> {
    const now = new Date().toISOString();
    const newGuests: Guest[] = guestsData.map((guestData) => {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const slugName = (guestData.firstName || 'invitado')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      const newId = `divo-${slugName || 'inv'}-${randomSuffix}`;
      const newToken = `tk-${Math.random().toString(36).substring(2, 9)}`;
      const status: RSVPStatus = guestData.status || 'confirmed';
      const confirmedCompanions =
        status === 'confirmed'
          ? guestData.confirmedCompanions ?? guestData.companionsAllowed ?? (guestData.companionName ? 1 : 0)
          : 0;

      return {
        ...guestData,
        id: newId,
        token: newToken,
        status,
        confirmedCompanions,
        checkedIn: false,
        respondedAt: status !== 'pending' ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };
    });

    const current = this.getLocalGuests();
    const updated = [...newGuests, ...current];
    this.setLocalGuests(updated);

    try {
      await fetch('/api/guests/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: newGuests }),
      });
    } catch {
      // Local storage already updated
    }

    return newGuests;
  }

  public static async updateGuest(id: string, updates: Partial<Guest>): Promise<Guest> {
    const current = this.getLocalGuests();
    const index = current.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Invitado no encontrado');

    const updatedGuest: Guest = {
      ...current[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`/api/guests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedGuest),
      });
    } catch {
      // Local fallback
    }

    const next = [...current];
    next[index] = updatedGuest;
    this.setLocalGuests(next);
    return updatedGuest;
  }

  public static async submitRSVP(
    idOrToken: string,
    rsvp: {
      status: RSVPStatus;
      confirmedCompanions: number;
      companionName?: string;
      dietaryRestrictions?: string;
      congratulationMessage?: string;
    }
  ): Promise<Guest> {
    const guests = this.getLocalGuests();
    const guest = guests.find((g) => g.id === idOrToken || g.token === idOrToken);
    if (!guest) throw new Error('Invitación no válida');

    const updatedGuest: Guest = {
      ...guest,
      status: rsvp.status,
      confirmedCompanions: rsvp.status === 'confirmed' ? rsvp.confirmedCompanions : 0,
      companionName: rsvp.status === 'confirmed' ? rsvp.companionName : undefined,
      dietaryRestrictions: rsvp.dietaryRestrictions,
      congratulationMessage: rsvp.congratulationMessage,
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`/api/guests/${guest.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rsvp),
      });
    } catch {
      // Local fallback
    }

    const next = guests.map((g) => (g.id === guest.id ? updatedGuest : g));
    this.setLocalGuests(next);
    return updatedGuest;
  }

  public static async registerCheckIn(
    idOrToken: string,
    doorStaffName: string = 'Acceso Puerta Principal',
    forceAdmit: boolean = false
  ): Promise<{ success: boolean; guest: Guest; alreadyCheckedIn: boolean; previousTime?: string }> {
    const guests = this.getLocalGuests();
    const guest = guests.find((g) => g.id === idOrToken || g.token === idOrToken);
    if (!guest) throw new Error('Código QR no reconocido en la base de datos');

    if (guest.checkedIn && !forceAdmit) {
      return {
        success: false,
        guest,
        alreadyCheckedIn: true,
        previousTime: guest.checkedInAt,
      };
    }

    const updatedGuest: Guest = {
      ...guest,
      status: 'confirmed',
      confirmedCompanions: guest.status === 'confirmed' ? guest.confirmedCompanions : guest.companionsAllowed,
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
      checkedInBy: doorStaffName,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedInBy: doorStaffName, forceAdmit }),
      });
    } catch {
      // Local fallback
    }

    const next = guests.map((g) => (g.id === guest.id ? updatedGuest : g));
    this.setLocalGuests(next);

    return {
      success: true,
      guest: updatedGuest,
      alreadyCheckedIn: false,
    };
  }

  public static async undoCheckIn(guestId: string): Promise<Guest> {
    const guests = this.getLocalGuests();
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) throw new Error('Invitado no encontrado');

    const updatedGuest: Guest = {
      ...guest,
      checkedIn: false,
      checkedInAt: undefined,
      checkedInBy: undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`/api/guests/${guestId}/undo-checkin`, { method: 'POST' });
    } catch {
      // fallback
    }

    const next = guests.map((g) => (g.id === guestId ? updatedGuest : g));
    this.setLocalGuests(next);
    return updatedGuest;
  }

  public static async deleteGuest(guestId: string): Promise<void> {
    try {
      await fetch(`/api/guests/${guestId}`, { method: 'DELETE' });
    } catch {
      // fallback
    }
    const current = this.getLocalGuests();
    const next = current.filter((g) => g.id !== guestId);
    this.setLocalGuests(next);
  }

  public static resetToDefault(): Guest[] {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GUESTS));
    this.notifyListeners(INITIAL_GUESTS);
    try {
      fetch('/api/guests/reset', { method: 'POST' });
    } catch {
      // fallback
    }
    return INITIAL_GUESTS;
  }

  public static getQRMode(): QRContentMode {
    try {
      const saved = localStorage.getItem(QR_MODE_STORAGE_KEY) as QRContentMode | null;
      if (saved === 'pass' || saved === 'url' || saved === 'whatsapp') {
        return saved;
      }
    } catch {}
    return 'pass';
  }

  public static setQRMode(mode: QRContentMode): void {
    try {
      localStorage.setItem(QR_MODE_STORAGE_KEY, mode);
    } catch {}
  }

  public static getCustomDomain(): string {
    try {
      return localStorage.getItem(CUSTOM_DOMAIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  public static setCustomDomain(domain: string): void {
    try {
      localStorage.setItem(CUSTOM_DOMAIN_STORAGE_KEY, domain.trim().replace(/\/+$/, ''));
    } catch {}
  }

  public static getPublicOrigin(): string {
    const custom = this.getCustomDomain();
    if (custom) {
      return custom.startsWith('http') ? custom : `https://${custom}`;
    }
    if (typeof window === 'undefined') return '';
    // Always use ais-pre- (Shared App URL) instead of ais-dev- (locked dev container URL)
    return window.location.origin.replace('//ais-dev-', '//ais-pre-');
  }

  public static getRSVPUrl(guest: Guest): string {
    const origin = this.getPublicOrigin();
    const pathname = typeof window !== 'undefined' && !this.getCustomDomain() ? window.location.pathname : '/';
    const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
    const fullName = `${guest.firstName} ${guest.lastName}`.trim();
    return `${origin}${base}?asistencia=true&guest=${encodeURIComponent(guest.token)}&n=${encodeURIComponent(fullName)}&cat=${encodeURIComponent(guest.category)}&c=${guest.companionsAllowed}`;
  }

  /**
   * Generates the real QR code payload according to the selected mode:
   * - 'pass' (default): Official self-contained DIVO 20 Años credential (scans instantly on ANY phone camera or DoorScanner with zero server/auth errors).
   * - 'whatsapp': Direct WhatsApp pass link (opens WhatsApp natively on iPhone/Android with the guest's pass).
   * - 'url': Web RSVP URL with self-hydrating guest params.
   */
  public static getQRPayload(guest: Guest, modeOverride?: QRContentMode): string {
    const mode = modeOverride || this.getQRMode();
    const fullName = `${guest.firstName} ${guest.lastName}`.trim();
    const companionsCount =
      guest.status === 'confirmed' ? guest.confirmedCompanions : guest.companionsAllowed;
    const passDesc =
      companionsCount > 0
        ? `Titular + ${companionsCount} Acomp.${guest.companionName ? ` (${guest.companionName})` : ''}`
        : 'Individual (1 Persona)';

    if (mode === 'whatsapp') {
      const msg =
        `✨ PASE OFICIAL ACREDITADO — DIVO 20 AÑOS ✨\n` +
        `👤 Invitado: ${fullName}\n` +
        `🏷️ Categoría: ${guest.category}${guest.tableOrSeat ? ` (${guest.tableOrSeat})` : ''}\n` +
        `🎟️ Pase: ${passDesc}\n` +
        `📅 22 Oct 2026 - 19:00 hs | Capilla Buen Pastor\n` +
        `🔑 Código: ${guest.token}`;
      return `https://wa.me/?text=${encodeURIComponent(msg)}`;
    }

    if (mode === 'url') {
      return this.getRSVPUrl(guest);
    }

    // Default 'pass' mode: Real Official Event Pass Credential (100% immune to browser/proxy errors)
    const lines = [
      'PASE OFICIAL - DIVO 20 ANOS',
      `Invitado: ${fullName}`,
      `Categoria: ${guest.category}${guest.tableOrSeat ? ` | ${guest.tableOrSeat}` : ''}`,
      `Pase: ${passDesc}`,
      `Evento: 22/10/2026 19:00hs - Capilla Buen Pastor`,
      `Estado: ACREDITADO`,
      `COD: ${guest.token}`,
    ];
    return lines.join('\n');
  }

  /**
   * Universal QR Payload Parser & Self-Hydrator:
   * Recognizes Official Pass Credentials, Web URLs (?guest=...&n=...), WhatsApp links, raw tokens, IDs, or names.
   * If a valid DIVO QR was generated on another device and isn't in local storage yet, it automatically hydrates it!
   */
  public static resolveGuestFromQRText(
    rawText: string,
    currentGuests?: Guest[]
  ): { guest: Guest | null; tokenOrQuery: string } {
    const guests = currentGuests || this.getLocalGuests();
    const trimmed = (rawText || '').trim();
    if (!trimmed) return { guest: null, tokenOrQuery: '' };

    // 1. Try decoding if it's a wa.me link with ?text=...
    let workingText = trimmed;
    if (trimmed.includes('wa.me/') && trimmed.includes('text=')) {
      try {
        const u = new URL(trimmed);
        const t = u.searchParams.get('text');
        if (t) workingText = t;
      } catch {}
    }

    // 2. Extract token from COD: tk-..., Código: tk-..., ?guest=tk-..., or any tk-... / divo-... pattern
    let extractedToken = '';
    const codMatch = workingText.match(/(?:COD|C[oó]digo|Token|ID)\s*:\s*([a-zA-Z0-9_-]+)/i);
    if (codMatch && codMatch[1]) {
      extractedToken = codMatch[1].trim();
    }
    if (!extractedToken) {
      const guestParamMatch = workingText.match(/[?&]guest=([^&#\s]+)/i);
      if (guestParamMatch && guestParamMatch[1]) {
        extractedToken = decodeURIComponent(guestParamMatch[1]).trim();
      }
    }
    if (!extractedToken) {
      const tkPattern = workingText.match(/\b(tk-[a-zA-Z0-9_-]+|divo-[a-zA-Z0-9_-]+)\b/i);
      if (tkPattern && tkPattern[1]) {
        extractedToken = tkPattern[1].trim();
      }
    }

    const searchKey = (extractedToken || workingText).toLowerCase();

    // 3. Look up in current guests list
    const existing = guests.find((g) => {
      const token = g.token.toLowerCase();
      const id = g.id.toLowerCase();
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      return (
        token === searchKey ||
        id === searchKey ||
        fullName === searchKey ||
        (token.length >= 5 && workingText.toLowerCase().includes(token))
      );
    });

    if (existing) {
      return { guest: existing, tokenOrQuery: existing.token };
    }

    // 4. Self-Hydration: If the scanned QR is an official DIVO QR (Pass or URL) from another device/session, reconstruct the guest!
    let parsedName = '';
    let parsedCategory: any = 'Invitado General';
    let parsedCompanions = 1;
    let parsedSeat = '';

    // Check URL query params (?guest=...&n=...&cat=...&c=...)
    if (workingText.startsWith('http://') || workingText.startsWith('https://')) {
      try {
        const url = new URL(workingText);
        parsedName = url.searchParams.get('n') || '';
        parsedCategory = url.searchParams.get('cat') || 'Invitado General';
        const cParam = url.searchParams.get('c');
        if (cParam !== null && !isNaN(Number(cParam))) {
          parsedCompanions = Number(cParam);
        }
      } catch {}
    }

    // Check Official Pass lines (Invitado: ..., Categoria: ..., Pase: ...)
    if (!parsedName && /Invitado\s*:\s*(.+)/i.test(workingText)) {
      const m = workingText.match(/Invitado\s*:\s*([^\r\n]+)/i);
      if (m && m[1]) parsedName = m[1].trim();
    }
    if (/Categor[ií]a\s*:\s*([^\r\n]+)/i.test(workingText)) {
      const m = workingText.match(/Categor[ií]a\s*:\s*([^\r\n]+)/i);
      if (m && m[1]) {
        const parts = m[1].split('|').map((s) => s.trim());
        parsedCategory = parts[0] || 'Invitado General';
        if (parts[1]) parsedSeat = parts[1];
      }
    }
    if (/Pase\s*:\s*([^\r\n]+)/i.test(workingText)) {
      const m = workingText.match(/Pase\s*:\s*([^\r\n]+)/i);
      if (m && m[1]) {
        const plusMatch = m[1].match(/\+\s*(\d+)/);
        parsedCompanions = plusMatch ? Number(plusMatch[1]) : m[1].toLowerCase().includes('individual') ? 0 : 1;
      }
    }

    if (extractedToken && (parsedName || extractedToken.startsWith('tk-') || extractedToken.startsWith('divo-'))) {
      const nameParts = (parsedName || 'Invitado Acreditado').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Invitado';
      const lastName = nameParts.slice(1).join(' ') || '';
      const now = new Date().toISOString();

      const hydrated: Guest = {
        id: extractedToken.startsWith('divo-') ? extractedToken : `divo-qr-${extractedToken}`,
        token: extractedToken,
        firstName,
        lastName,
        category: parsedCategory,
        tableOrSeat: parsedSeat || undefined,
        companionsAllowed: parsedCompanions,
        status: 'confirmed',
        confirmedCompanions: parsedCompanions,
        checkedIn: false,
        respondedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const next = [hydrated, ...this.getLocalGuests()];
      this.setLocalGuests(next);
      fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hydrated),
      }).catch(() => {});

      return { guest: hydrated, tokenOrQuery: hydrated.token };
    }

    return { guest: null, tokenOrQuery: extractedToken || trimmed };
  }

  public static getWhatsAppShareUrl(guest: Guest): string {
    const rsvpUrl = this.getRSVPUrl(guest);
    const message = `Estimado/a ${guest.firstName} ${guest.lastName}:\n\n` +
      `DIVO Trajes y Etiqueta tiene el agrado de invitarte a celebrar nuestros 20 Años en el evento:\n` +
      `"DIVO 20 años — Vistiendo Momentos"\n\n` +
      `📅 Jueves 22 de Octubre de 2026\n` +
      `⏰ 19:00 hs\n` +
      `📍 Capilla Paseo del Buen Pastor, Córdoba\n` +
      `✨ Aniversario + Show en Vivo + Desfile Exclusivo\n` +
      `👔 Dress Code: Elegante\n` +
      `🔑 Código de Acreditación QR: ${guest.token}\n\n` +
      `Por favor, confirma tu asistencia y la de tu acompañante en el siguiente enlace exclusivo:\n` +
      `${rsvpUrl}\n\n` +
      `¡Esperamos contar con tu distinguida presencia!`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = guest.phone ? guest.phone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  }

  public static getWhatsAppReminderUrl(guest: Guest): string {
    const rsvpUrl = this.getRSVPUrl(guest);
    const companionsText = guest.confirmedCompanions > 0
      ? ` (Pase válido para vos y tu acompañante${guest.companionName ? `: ${guest.companionName}` : ''})`
      : ' (Pase individual)';

    const message = `¡Hola ${guest.firstName}! ✨\n\n` +
      `¡Hoy es el gran día! Te esperamos esta tarde para celebrar juntos los 20 Años de DIVO Trajes y Etiqueta:\n` +
      `"DIVO 20 años — Vistiendo Momentos"\n\n` +
      `⏰ Horario: 19:00 hs puntual\n` +
      `📍 Lugar: Capilla Paseo del Buen Pastor (Hipólito Yrigoyen 325, Córdoba)\n` +
      `👔 Dress Code: Elegante\n` +
      `🎟️ Tu Pase:${companionsText}\n` +
      `🔑 Tu Código QR de Puerta: ${guest.token}\n\n` +
      `Podés abrir tu tarjeta con tu código QR de acceso desde acá:\n` +
      `${rsvpUrl}\n\n` +
      `Tené a mano tu código QR al ingresar por puerta para una acreditación inmediata. ¡Nos vemos en unas horas! 🥂`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = guest.phone ? guest.phone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  }
}
