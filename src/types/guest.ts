export type RSVPStatus = 'pending' | 'confirmed' | 'declined';
export type GuestCategory = 'VIP' | 'Prensa' | 'Staff' | 'Familia & Amigos' | 'Cliente Distinguido' | 'Invitado General';

export interface Guest {
  id: string;
  token: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  category: GuestCategory;
  tableOrSeat?: string;
  companionsAllowed: number;
  
  // RSVP details
  status: RSVPStatus;
  confirmedCompanions: number;
  companionName?: string;
  dietaryRestrictions?: string;
  congratulationMessage?: string;
  respondedAt?: string;

  // Door check-in details
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  checkInNotes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface EventStats {
  totalInvitations: number;
  confirmedGuests: number;
  confirmedCompanions: number;
  totalAttendingPeople: number;
  declinedGuests: number;
  pendingGuests: number;
  checkedInGuests: number;
  totalCheckedInPeople: number;
  attendancePercentage: number;
}
