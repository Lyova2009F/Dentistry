import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCombinedDentalRequest,
  detectSecretTripleTap,
  formatDisplayDateRu,
  formatTelegramNotification,
  getAnyDoctorSlotsForDate,
  getDoctorSlotsForDate,
  getUpcomingDays,
  makeSlotId,
  validateBookingInput,
  verifyBossCode,
} from './bookingLogic';
import type { Doctor } from '../types/clinic';

const sampleDoctor: Doctor = {
  id: 'dr_test',
  name: 'Белова Елена Сергеевна',
  role: 'Терапевт',
  experience: '14 лет',
  cabinet: 'Кабинет 102',
  bio: 'Описание',
  imageUrl: '/test.jpg',
  availableDays: ['mon', 'wed', 'fri'],
  timeSlots: ['09:00', '10:30', '12:00'],
  dateOverrides: {
    '2026-11-19': ['14:00', '16:30'],
    '2026-11-20': [],
  },
};

test('makeSlotId creates deterministic safe Firestore document ID', () => {
  assert.equal(
    makeSlotId('dr_elena_belova', '2026-11-19', '10:30'),
    'dr_elena_belova__2026-11-19__10-30'
  );
});

test('getDoctorSlotsForDate respects doctor working days, dateOverrides, and occupied slots', () => {
  // 2026-11-18 is Wednesday ('wed') with no override -> uses default slots
  const wedResult = getDoctorSlotsForDate(sampleDoctor, '2026-11-18', [
    {
      slotId: 'dr_test__2026-11-18__10-30',
      doctorId: 'dr_test',
      date: '2026-11-18',
      time: '10:30',
      appointmentId: 'apt_1',
    },
  ]);

  assert.equal(wedResult.isWorkingDay, true);
  assert.equal(wedResult.isCustomOverride, false);
  assert.equal(wedResult.slots.length, 3);
  assert.equal(wedResult.slots[0].available, true);
  assert.equal(wedResult.slots[1].available, false);
  assert.equal(wedResult.slots[2].available, true);

  // 2026-11-19 is Thursday ('thu' normally day off) BUT has custom calendar override
  const thuOverrideResult = getDoctorSlotsForDate(sampleDoctor, '2026-11-19', []);
  assert.equal(thuOverrideResult.isWorkingDay, true);
  assert.equal(thuOverrideResult.isCustomOverride, true);
  assert.deepEqual(
    thuOverrideResult.slots.map((s) => s.time),
    ['14:00', '16:30']
  );

  // 2026-11-20 is Friday ('fri' normally working) BUT overridden to empty [] (day off)
  const friDayOff = getDoctorSlotsForDate(sampleDoctor, '2026-11-20', []);
  assert.equal(friDayOff.isWorkingDay, false);
  assert.equal(friDayOff.isCustomOverride, true);
  assert.equal(friDayOff.slots.length, 0);
});

test('validateBookingInput catches missing or invalid fields', () => {
  const invalid = validateBookingInput({
    firstName: 'А',
    lastName: '',
    phone: '123',
    requestDetails: '?',
    toothZone: '',
    doctorId: '',
    date: 'bad',
    time: '',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.firstName);
  assert.ok(invalid.errors.lastName);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.requestDetails);
  assert.ok(invalid.errors.doctorId);
  assert.ok(invalid.errors.date);
  assert.ok(invalid.errors.time);

  const valid = validateBookingInput({
    firstName: 'Анна',
    lastName: 'Соколова',
    phone: '+7 (999) 123-45-67',
    requestDetails: 'Профессиональная чистка и осмотр',
    toothZone: 'Зуб 16',
    doctorId: 'dr_test',
    date: '2026-11-18',
    time: '09:00',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('detectSecretTripleTap triggers only on 3 taps within window', () => {
  const step1 = detectSecretTripleTap([], 1000, 2500);
  assert.equal(step1.triggered, false);

  const step2 = detectSecretTripleTap(step1.nextTaps, 1600, 2500);
  assert.equal(step2.triggered, false);

  const step3 = detectSecretTripleTap(step2.nextTaps, 2100, 2500);
  assert.equal(step3.triggered, true);
  assert.equal(step3.nextTaps.length, 0);

  // Stale taps expire
  const expired = detectSecretTripleTap([1000, 1500], 5000, 2500);
  assert.equal(expired.triggered, false);
  assert.equal(expired.nextTaps.length, 1);
});

test('verifyBossCode accepts 1111 and rejects wrong codes', () => {
  assert.equal(verifyBossCode('1111'), true);
  assert.equal(verifyBossCode(' 1111 '), true);
  assert.equal(verifyBossCode('0000'), false);
  assert.equal(verifyBossCode('1112'), false);
});

test('formatTelegramNotification includes all required patient & visit details', () => {
  const msg = formatTelegramNotification({
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '+7 999 000-11-22',
    doctorName: 'Белова Елена Сергеевна',
    date: '2026-11-19',
    time: '12:00',
    toothZone: 'Зуб 16',
    requestDetails: 'Беспокоит чувствительность',
  });
  assert.match(msg, /Иван Петров/);
  assert.match(msg, /\+7 999 000-11-22/);
  assert.match(msg, /19 ноя 2026 · 12:00/);
  assert.match(msg, /Зуб 16/);
  assert.match(msg, /Беспокоит чувствительность/);
});

test('getUpcomingDays generates exact sequence of days (default 14)', () => {
  const days = getUpcomingDays(new Date(2026, 10, 18));
  assert.equal(days.length, 14);
  assert.equal(days[0].dateStr, '2026-11-18');
  assert.equal(days[0].dayKey, 'wed');
  assert.equal(days[1].dateStr, '2026-11-19');
  assert.equal(days[1].dayKey, 'thu');
  assert.equal(days[13].dateStr, '2026-12-01');
});

test('formatDisplayDateRu formats ISO date to Russian short date', () => {
  assert.equal(formatDisplayDateRu('2026-11-18'), '18 ноя 2026');
  assert.equal(formatDisplayDateRu('2026-01-05'), '5 янв 2026');
});

test('getAnyDoctorSlotsForDate aggregates free slots across doctors and prefers free doctor', () => {
  const doc2: Doctor = {
    ...sampleDoctor,
    id: 'dr_second',
    name: 'Морозов Артём Викторович',
    availableDays: ['wed'],
    timeSlots: ['09:00', '15:00'],
    dateOverrides: {},
  };
  const res = getAnyDoctorSlotsForDate(
    [sampleDoctor, doc2],
    '2026-11-18',
    [
      {
        slotId: 'dr_test__2026-11-18__09-00',
        doctorId: 'dr_test',
        date: '2026-11-18',
        time: '09:00',
        appointmentId: 'apt_1',
      },
    ],
    'dr_test'
  );
  assert.equal(res.isWorkingDay, true);
  assert.deepEqual(
    res.slots.map((s) => s.time),
    ['09:00', '10:30', '12:00', '15:00']
  );
  // 09:00 falls back to doc2 because dr_test is occupied
  assert.equal(res.slots[0].available, true);
  assert.equal(res.slots[0].doctorId, 'dr_second');
  // 10:30 uses preferred dr_test
  assert.equal(res.slots[1].doctorId, 'dr_test');
});

test('buildCombinedDentalRequest builds summary for multiple teeth and presets', () => {
  const res = buildCombinedDentalRequest(
    [
      {
        fdi: '16',
        label: 'Зуб 16',
        suggestedText: 'Зуб 16',
        recommendedDoctorId: 'dr_elena_belova',
      },
      {
        fdi: '26',
        label: 'Зуб 26',
        suggestedText: 'Зуб 26',
        recommendedDoctorId: 'dr_elena_belova',
      },
    ],
    [
      {
        id: 'hygiene',
        title: 'Профессиональная гигиена и AirFlow',
        suggestedText: 'Чистка',
        recommendedDoctorId: 'dr_alisa_krylova',
      },
    ]
  );
  assert.match(res.toothZone, /Зубы: 16, 26/);
  assert.match(res.toothZone, /Профессиональная гигиена/);
  assert.match(res.requestDetails, /Выбраны зубы 16, 26/);
  assert.equal(res.recommendedDoctorId, 'dr_alisa_krylova');
});
