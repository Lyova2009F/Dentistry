import type {
  Appointment,
  BookedSlot,
  BookingFormInput,
  BookingValidationResult,
  DayKey,
  DayOption,
  Doctor,
  SlotAvailability,
} from '../types/clinic';

const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const WEEKDAY_SHORT_RU: Record<DayKey, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

const MONTHS_SHORT_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export const BOSS_ACCESS_CODE = '1111';

export const STANDARD_CLINIC_SLOTS = [
  '09:00',
  '10:00',
  '10:30',
  '11:30',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '15:30',
  '16:30',
  '17:00',
  '18:00',
  '19:00',
];

export function makeSlotId(doctorId: string, date: string, time: string): string {
  const safeDoc = doctorId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeTime = time.replace(':', '-');
  return `${safeDoc}__${date}__${safeTime}`;
}

export function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayKeyFromDateStr(dateStr: string): DayKey {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return JS_DAY_TO_KEY[dt.getDay()];
}

export function getUpcomingDays(baseDate: Date = new Date(), count: number = 14): DayOption[] {
  const options: DayOption[] = [];
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  for (let i = 0; i < count; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const dateStr = formatIsoDateLocal(dt);
    const dayKey = JS_DAY_TO_KEY[dt.getDay()];
    const weekdayShort = WEEKDAY_SHORT_RU[dayKey];
    const dayNum = dt.getDate();
    const monthName = MONTHS_SHORT_RU[dt.getMonth()];
    const dateLabel = `${dayNum} ${monthName}`;
    const prefix = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : weekdayShort;

    options.push({
      dateStr,
      dayKey,
      weekdayShort,
      dateLabel,
      fullLabel: `${prefix}, ${dateLabel}`,
    });
  }

  return options;
}

export function getDoctorSlotsForDate(
  doctor: Doctor | undefined,
  dateStr: string,
  bookedSlots: BookedSlot[]
): { isWorkingDay: boolean; slots: SlotAvailability[]; isCustomOverride: boolean } {
  if (!doctor || !dateStr) {
    return { isWorkingDay: false, slots: [], isCustomOverride: false };
  }

  const hasOverride = Boolean(
    doctor.dateOverrides &&
      Object.prototype.hasOwnProperty.call(doctor.dateOverrides, dateStr)
  );

  let configuredTimes: string[] = [];

  if (hasOverride && doctor.dateOverrides) {
    configuredTimes = [...(doctor.dateOverrides[dateStr] || [])].sort();
  } else {
    const dayKey = getDayKeyFromDateStr(dateStr);
    if (!doctor.availableDays.includes(dayKey)) {
      return { isWorkingDay: false, slots: [], isCustomOverride: false };
    }
    configuredTimes = [...doctor.timeSlots].sort();
  }

  if (configuredTimes.length === 0) {
    return { isWorkingDay: false, slots: [], isCustomOverride: hasOverride };
  }

  const occupiedSet = new Set(
    bookedSlots
      .filter((s) => s.doctorId === doctor.id && s.date === dateStr)
      .map((s) => s.time)
  );

  const slots: SlotAvailability[] = configuredTimes.map((time) => ({
    time,
    available: !occupiedSet.has(time),
    slotId: makeSlotId(doctor.id, dateStr, time),
  }));

  return { isWorkingDay: true, slots, isCustomOverride: hasOverride };
}

export function findFirstAvailableDateForDoctor(
  doctor: Doctor | undefined,
  days: DayOption[],
  bookedSlots: BookedSlot[]
): string {
  if (!doctor || days.length === 0) return '';
  for (const day of days) {
    const { isWorkingDay, slots } = getDoctorSlotsForDate(doctor, day.dateStr, bookedSlots);
    if (isWorkingDay && slots.some((s) => s.available)) {
      return day.dateStr;
    }
  }
  const firstWorking = days.find((d) => {
    const res = getDoctorSlotsForDate(doctor, d.dateStr, bookedSlots);
    return res.isWorkingDay;
  });
  return firstWorking ? firstWorking.dateStr : days[0].dateStr;
}

export interface AnyDoctorSlotOption {
  time: string;
  available: boolean;
  doctorId: string;
  doctorName: string;
  slotId: string;
  freeDoctorsCount: number;
}

export function getAnyDoctorSlotsForDate(
  doctors: Doctor[],
  dateStr: string,
  bookedSlots: BookedSlot[],
  preferredDoctorId?: string
): { isWorkingDay: boolean; slots: AnyDoctorSlotOption[] } {
  if (!doctors.length || !dateStr) {
    return { isWorkingDay: false, slots: [] };
  }

  const byTime = new Map<
    string,
    { doctorId: string; doctorName: string; slotId: string; available: boolean }[]
  >();

  for (const doc of doctors) {
    const res = getDoctorSlotsForDate(doc, dateStr, bookedSlots);
    if (!res.isWorkingDay) continue;
    for (const s of res.slots) {
      const list = byTime.get(s.time) || [];
      list.push({
        doctorId: doc.id,
        doctorName: doc.name,
        slotId: s.slotId,
        available: s.available,
      });
      byTime.set(s.time, list);
    }
  }

  if (byTime.size === 0) {
    return { isWorkingDay: false, slots: [] };
  }

  const sortedTimes = Array.from(byTime.keys()).sort();
  const slots: AnyDoctorSlotOption[] = sortedTimes.map((time) => {
    const entries = byTime.get(time) || [];
    const freeEntries = entries.filter((e) => e.available);
    const chosen =
      (preferredDoctorId && freeEntries.find((e) => e.doctorId === preferredDoctorId)) ||
      freeEntries[0] ||
      entries[0];

    return {
      time,
      available: freeEntries.length > 0,
      doctorId: chosen.doctorId,
      doctorName: chosen.doctorName,
      slotId: chosen.slotId,
      freeDoctorsCount: freeEntries.length,
    };
  });

  return { isWorkingDay: true, slots };
}

export function buildCombinedDentalRequest(
  selectedTeeth: { fdi: string; label: string; suggestedText: string; recommendedDoctorId: string }[],
  selectedPresets: { id: string; title: string; suggestedText: string; recommendedDoctorId: string }[]
): {
  toothZone: string;
  requestDetails: string;
  recommendedDoctorId: string | null;
} {
  const zoneParts: string[] = [];
  if (selectedTeeth.length === 1) {
    zoneParts.push(`Зуб ${selectedTeeth[0].fdi}`);
  } else if (selectedTeeth.length > 1) {
    zoneParts.push(`Зубы: ${selectedTeeth.map((t) => t.fdi).join(', ')}`);
  }
  if (selectedPresets.length > 0) {
    zoneParts.push(selectedPresets.map((p) => p.title).join('; '));
  }

  const rawZone = zoneParts.join(' · ');
  const toothZone = rawZone.length > 118 ? `${rawZone.slice(0, 115)}...` : rawZone;

  const detailParts: string[] = [];
  if (selectedTeeth.length > 0) {
    detailParts.push(
      selectedTeeth.length === 1
        ? selectedTeeth[0].suggestedText
        : `Выбраны зубы ${selectedTeeth.map((t) => t.fdi).join(', ')} (требуется диагностика и лечение)`
    );
  }
  if (selectedPresets.length > 0) {
    detailParts.push(selectedPresets.map((p) => p.title).join(', '));
  }

  const recommendedDoctorId =
    selectedPresets[selectedPresets.length - 1]?.recommendedDoctorId ||
    selectedTeeth[selectedTeeth.length - 1]?.recommendedDoctorId ||
    null;

  return {
    toothZone,
    requestDetails: detailParts.join(' · '),
    recommendedDoctorId,
  };
}

export function validateBookingInput(input: BookingFormInput): BookingValidationResult {
  const errors: Partial<Record<keyof BookingFormInput, string>> = {};

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone.trim();
  const requestDetails = input.requestDetails.trim();

  if (firstName.length < 2 || firstName.length > 80) {
    errors.firstName = 'Укажите имя (минимум 2 символа)';
  }

  if (lastName.length < 2 || lastName.length > 80) {
    errors.lastName = 'Укажите фамилию (минимум 2 символа)';
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (!/^[0-9+\-()\s]{6,32}$/.test(phone) || phoneDigits.length < 10) {
    errors.phone = 'Введите корректный номер телефона (от 10 цифр)';
  }

  if (requestDetails.length < 3 || requestDetails.length > 600) {
    errors.requestDetails = 'Опишите, что примерно требуется (от 3 символов)';
  }

  if (!input.doctorId) {
    errors.doctorId = 'Выберите врача';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = 'Выберите удобную дату';
  }

  if (!/^\d{2}:\d{2}$/.test(input.time)) {
    errors.time = 'Выберите свободное время приёма';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatTelegramNotification(
  data: Pick<
    Appointment,
    'firstName' | 'lastName' | 'phone' | 'doctorName' | 'date' | 'time' | 'toothZone' | 'requestDetails'
  >
): string {
  const prettyDate = formatDisplayDateRu(data.date);
  const lines = [
    '🦷 НОВАЯ ЗАЯВКА · «ЛЮМЕН ДЕНТ»',
    '──────────────────────',
    `👤 Пациент: ${data.firstName.trim()} ${data.lastName.trim()}`,
    `📞 Телефон: ${data.phone.trim()}`,
    '',
    `🩺 Врач: ${data.doctorName}`,
    `🗓 Приём: ${prettyDate} · ${data.time}`,
  ];
  if (data.toothZone) {
    lines.push(`📍 Ориентир: ${data.toothZone}`);
  }
  lines.push('', `💬 Запрос: ${data.requestDetails.trim()}`, '──────────────────────');
  return lines.join('\n');
}

export function detectSecretTripleTap(
  recentTapsMs: number[],
  nowMs: number,
  windowMs: number = 2500
): { triggered: boolean; nextTaps: number[] } {
  const validTaps = recentTapsMs.filter((t) => nowMs - t <= windowMs);
  const nextTaps = [...validTaps, nowMs];
  if (nextTaps.length >= 3) {
    return { triggered: true, nextTaps: [] };
  }
  return { triggered: false, nextTaps };
}

export function verifyBossCode(code: string): boolean {
  return code.trim() === BOSS_ACCESS_CODE;
}

export function formatDisplayDateRu(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const monthName = MONTHS_SHORT_RU[monthIdx];
  if (!monthName || Number.isNaN(day)) return dateStr;
  return `${day} ${monthName} ${year}`;
}
