export type AppointmentStatus = 'new' | 'confirmed' | 'completed' | 'cancelled';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Doctor {
  id: string;
  name: string;
  role: string;
  experience: string;
  cabinet: string;
  bio: string;
  imageUrl: string;
  availableDays: DayKey[];
  timeSlots: string[];
  dateOverrides?: Record<string, string[]>;
}

export interface BookedSlot {
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  appointmentId: string;
}

export interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  requestDetails: string;
  toothZone: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  slotId: string;
  status: AppointmentStatus;
  telegramSent: boolean;
  telegramPreview: string;
  telegramError?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ToothZone {
  fdi: string;
  jaw: 'upper' | 'lower';
  side: 'left' | 'right';
  label: string;
  shortTitle: string;
  commonConcern: string;
  suggestedText: string;
  recommendedDoctorId: string;
  durationLabel: string;
  cx: number;
  cy: number;
}

export interface SymptomPreset {
  id: string;
  title: string;
  duration: string;
  description: string;
  suggestedText: string;
  recommendedDoctorId: string;
}

export interface DayOption {
  dateStr: string;
  dayKey: DayKey;
  weekdayShort: string;
  dateLabel: string;
  fullLabel: string;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
  slotId: string;
}

export interface BookingFormInput {
  firstName: string;
  lastName: string;
  phone: string;
  requestDetails: string;
  toothZone: string;
  doctorId: string;
  date: string;
  time: string;
}

export interface BookingValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof BookingFormInput, string>>;
}

export interface ClinicLocation {
  name: string;
  address: string;
  searchQuery: string;
  placeId?: string;
  lat: number;
  lng: number;
  workingHoursNote: string;
  updatedAtIso?: string;
}

