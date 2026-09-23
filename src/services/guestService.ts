import { Guest, EventStats, RSVPStatus } from '../types/guest';
import { INITIAL_GUESTS } from '../data/initialGuests';

const STORAGE_KEY = 'divo_20_guests_data_v1';

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
        return JSON.parse(data);
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
    try {
      const response = await fetch('/api/guests');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          this.setLocalGuests(data);
          return data;
        }
      }
    } catch {
      // Offline / dev fallback
    }
    return this.getLocalGuests();
  }

  public static async getGuestByIdOrToken(idOrToken: string): Promise<Guest | null> {
    const guests = await this.getAllGuests();
    return (
      guests.find(
        (g) =>
          g.id.toLowerCase() === idOrToken.toLowerCase() ||
          g.token.toLowerCase() === idOrToken.toLowerCase()
      ) || null
    );
  }

  public static async addGuest(
    guestData: Omit<Guest, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'checkedIn' | 'status' | 'confirmedCompanions'>
  ): Promise<Guest> {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const slugName = guestData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newId = `divo-${slugName}-${randomSuffix}`;
    const newToken = `tk-${Math.random().toString(36).substring(2, 9)}`;

    const newGuest: Guest = {
      ...guestData,
      id: newId,
      token: newToken,
      status: 'pending',
      confirmedCompanions: 0,
      checkedIn: false,
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
    guestsData: Array<Omit<Guest, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'checkedIn' | 'status' | 'confirmedCompanions'>>
  ): Promise<Guest[]> {
    const createdList: Guest[] = [];
    for (const g of guestsData) {
      const added = await this.addGuest(g);
      createdList.push(added);
    }
    return createdList;
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

  public static getRSVPUrl(guest: Guest): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}?guest=${guest.token}`;
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
      `👔 Dress Code: Gala (prendas Divo)\n\n` +
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
}
