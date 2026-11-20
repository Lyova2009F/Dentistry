import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { INITIAL_DOCTORS, SYMPTOM_PRESETS, TEETH_ZONES } from './data/clinicData';
import {
  clearAllFirestoreData,
  createAppointmentInFirestore,
  deleteClinicLocationFromFirestore,
  deleteFirestoreAppointment,
  saveClinicLocationToFirestore,
  saveDoctorToFirestore,
  saveMapEnabledToFirestore,
  subscribeAuth,
  subscribeBossAppointments,
  subscribePublicBookedSlots,
  subscribePublicClinicLocation,
  subscribePublicDoctors,
  subscribePublicMapEnabled,
  updateFirestoreAppointmentStatus,
} from './lib/firebase';
import type {
  Appointment,
  AppointmentStatus,
  BookedSlot,
  BookingFormInput,
  ClinicLocation,
  DayKey,
  Doctor,
  SymptomPreset,
  ToothZone,
} from './types/clinic';
import {
  buildCombinedDentalRequest,
  detectSecretTripleTap,
  findFirstAvailableDateForDoctor,
  formatTelegramNotification,
  getAnyDoctorSlotsForDate,
  getDoctorSlotsForDate,
  getUpcomingDays,
  makeSlotId,
} from './utils/bookingLogic';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollReactiveBackground } from './components/ScrollReactiveBackground';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { DentalArchMap } from './components/DentalArchMap';
import { ServicesSection } from './components/ServicesSection';
import { BookingSection, type DoctorChoiceMode } from './components/BookingSection';
import { ClinicLocationSection } from './components/ClinicLocationSection';
import { BossPinModal } from './components/BossPinModal';
import { BossDashboard } from './components/BossDashboard';

function ClinicAppContent() {
  const days = useMemo(() => getUpcomingDays(new Date(), 14), []);

  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [serverBookedSlots, setServerBookedSlots] = useState<BookedSlot[]>([]);
  const [firestoreBookedSlots, setFirestoreBookedSlots] = useState<BookedSlot[]>([]);
  const [serverAvailable, setServerAvailable] = useState<boolean>(false);
  const serverAvailableRef = useRef<boolean>(false);
  const [clinicLocation, setClinicLocation] = useState<ClinicLocation | null>(null);
  const [publicStateLoaded, setPublicStateLoaded] = useState<boolean>(false);
  const [mapEnabled, setMapEnabled] = useState<boolean>(true);

  // Multi-select dental map & presets + form state
  const [selectedTeethFdi, setSelectedTeethFdi] = useState<string[]>([]);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [doctorChoiceMode, setDoctorChoiceMode] = useState<DoctorChoiceMode>('prompt');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(INITIAL_DOCTORS[0].id);
  const [selectedDate, setSelectedDate] = useState<string>(days[0]?.dateStr || '');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [requestDetails, setRequestDetails] = useState<string>('');
  const [toothZone, setToothZone] = useState<string>('');
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  // Secret Boss mode state (3 clicks on clinic title + PIN 1111)
  const tapTimestampsRef = useRef<number[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [bossUnlocked, setBossUnlocked] = useState<boolean>(false);
  const [bossAppointments, setBossAppointments] = useState<Appointment[]>([]);
  const [telegramConfigured, setTelegramConfigured] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Listen for Case A Google Maps Platform quota events globally
  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Express server store is authoritative when online (prevents stale Firestore ghost slots after PIN-only cancellations)
  const mergedBookedSlots = useMemo(() => {
    if (serverAvailable) {
      return serverBookedSlots;
    }
    return firestoreBookedSlots;
  }, [serverAvailable, serverBookedSlots, firestoreBookedSlots]);

  // Fetch public schedule, occupied slots & custom clinic location from Express server
  const fetchPublicState = useCallback(async () => {
    try {
      const res = await fetch('/api/public/state');
      if (!res.ok) return;
      const data = await res.json();
      serverAvailableRef.current = true;
      setServerAvailable(true);
      if (Array.isArray(data.bookedSlots)) {
        setServerBookedSlots(data.bookedSlots);
      }
      if (data.clinicLocation !== undefined) {
        setClinicLocation(data.clinicLocation || null);
      }
      if (typeof data.mapEnabled === 'boolean') {
        setMapEnabled(data.mapEnabled);
      }
      if (data.doctorSchedules && typeof data.doctorSchedules === 'object') {
        setDoctors((prev) =>
          prev.map((doc) => {
            const override = data.doctorSchedules[doc.id];
            if (!override) return doc;
            return {
              ...doc,
              availableDays: Array.isArray(override.availableDays)
                ? override.availableDays
                : doc.availableDays,
              timeSlots: Array.isArray(override.timeSlots)
                ? override.timeSlots
                : doc.timeSlots,
              dateOverrides:
                override.dateOverrides && typeof override.dateOverrides === 'object'
                  ? override.dateOverrides
                  : doc.dateOverrides || {},
            };
          })
        );
      }
    } catch {
      // Silent fallback to initial doctors & Firestore listeners
    } finally {
      setPublicStateLoaded(true);
    }
  }, []);

  // Fetch Boss dashboard data using PIN 1111
  const fetchBossDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/boss/dashboard', {
        headers: { 'x-boss-pin': '1111' },
      });
      if (!res.ok) return;
      const data = await res.json();
      serverAvailableRef.current = true;
      setServerAvailable(true);
      if (Array.isArray(data.appointments)) {
        setBossAppointments(data.appointments);
      }
      if (Array.isArray(data.bookedSlots)) {
        setServerBookedSlots(data.bookedSlots);
      }
      if (data.clinicLocation !== undefined) {
        setClinicLocation(data.clinicLocation || null);
      }
      if (typeof data.mapEnabled === 'boolean') {
        setMapEnabled(data.mapEnabled);
      }
      setTelegramConfigured(Boolean(data.telegramConfigured));
    } catch {
      // Ignore network hiccup
    }
  }, []);

  useEffect(() => {
    fetchPublicState();
  }, [fetchPublicState]);

  // Subscribe to Firebase auth and public non-PII collections (used as fallback when server is offline)
  useEffect(() => {
    const unsubAuth = subscribeAuth((user) => {
      setFirebaseUser(user);
    });
    const unsubDoctors = subscribePublicDoctors((fsDoctors) => {
      if (!serverAvailableRef.current && fsDoctors.length > 0) {
        setDoctors(fsDoctors);
      }
    });
    const unsubSlots = subscribePublicBookedSlots((slots) => {
      setFirestoreBookedSlots(slots);
    });
    const unsubLocation = subscribePublicClinicLocation((fsLoc) => {
      if (!serverAvailableRef.current && fsLoc) {
        setClinicLocation(fsLoc);
      }
    });
    const unsubMapEnabled = subscribePublicMapEnabled((enabled) => {
      if (!serverAvailableRef.current) {
        setMapEnabled(enabled);
      }
    });

    return () => {
      unsubAuth();
      unsubDoctors();
      unsubSlots();
      unsubLocation();
      unsubMapEnabled();
    };
  }, []);

  // Ensure a valid available date & time is selected when doctor, mode, or booked slots change
  useEffect(() => {
    if (doctorChoiceMode === 'any') {
      const currentAny = getAnyDoctorSlotsForDate(
        doctors,
        selectedDate,
        mergedBookedSlots,
        selectedDoctorId
      );
      let targetDate = selectedDate;
      if (!currentAny.isWorkingDay) {
        const firstDay = days.find(
          (d) =>
            getAnyDoctorSlotsForDate(
              doctors,
              d.dateStr,
              mergedBookedSlots,
              selectedDoctorId
            ).isWorkingDay
        );
        if (firstDay) {
          targetDate = firstDay.dateStr;
          if (targetDate !== selectedDate) {
            setSelectedDate(targetDate);
          }
        }
      }

      const slotsAny = getAnyDoctorSlotsForDate(
        doctors,
        targetDate,
        mergedBookedSlots,
        selectedDoctorId
      );
      const matchedSlot = slotsAny.slots.find((s) => s.time === selectedTime && s.available);
      if (!matchedSlot) {
        const firstFree = slotsAny.slots.find((s) => s.available);
        setSelectedTime(firstFree ? firstFree.time : '');
        if (firstFree && firstFree.doctorId !== selectedDoctorId) {
          setSelectedDoctorId(firstFree.doctorId);
        }
      } else if (matchedSlot.doctorId !== selectedDoctorId) {
        setSelectedDoctorId(matchedSlot.doctorId);
      }
      return;
    }

    const activeDoc = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
    if (!activeDoc) return;

    const currentDayCheck = getDoctorSlotsForDate(activeDoc, selectedDate, mergedBookedSlots);
    let targetDate = selectedDate;
    if (!currentDayCheck.isWorkingDay) {
      targetDate = findFirstAvailableDateForDoctor(activeDoc, days, mergedBookedSlots);
      if (targetDate && targetDate !== selectedDate) {
        setSelectedDate(targetDate);
      }
    }

    const slotsCheck = getDoctorSlotsForDate(activeDoc, targetDate, mergedBookedSlots);
    const stillFree = slotsCheck.slots.some((s) => s.time === selectedTime && s.available);
    if (!stillFree) {
      const firstFree = slotsCheck.slots.find((s) => s.available);
      setSelectedTime(firstFree ? firstFree.time : '');
    }
  }, [
    doctors,
    doctorChoiceMode,
    selectedDoctorId,
    selectedDate,
    selectedTime,
    mergedBookedSlots,
    days,
  ]);

  // Load Boss appointments when unlocked
  useEffect(() => {
    if (!bossUnlocked) return;
    fetchBossDashboard();
  }, [bossUnlocked, fetchBossDashboard]);

  // Also subscribe to Firestore appointments if signed in with Google as verified admin
  useEffect(() => {
    if (!bossUnlocked || !firebaseUser?.emailVerified) return;
    const unsub = subscribeBossAppointments(
      (fsAppointments) => {
        if (fsAppointments.length > 0) {
          setBossAppointments((prev) => {
            const byId = new Map<string, Appointment>();
            for (const a of prev) byId.set(a.id, a);
            for (const a of fsAppointments) byId.set(a.id, a);
            return Array.from(byId.values()).sort((a, b) =>
              b.createdAtIso.localeCompare(a.createdAtIso)
            );
          });
        }
      },
      () => {
        // Non-admin Google account stays on PIN-authenticated server store
      }
    );
    return () => unsub();
  }, [bossUnlocked, firebaseUser]);

  function handleBrandTap() {
    const res = detectSecretTripleTap(tapTimestampsRef.current, Date.now(), 2500);
    tapTimestampsRef.current = res.nextTaps;
    if (res.triggered) {
      setPinModalOpen(true);
    }
  }

  function scrollToElement(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function syncDentalSelections(nextTeethFdi: string[], nextPresetIds: string[]) {
    const teethObjs = TEETH_ZONES.filter((t) => nextTeethFdi.includes(t.fdi));
    const presetObjs = SYMPTOM_PRESETS.filter((p) => nextPresetIds.includes(p.id));

    if (teethObjs.length === 0 && presetObjs.length === 0) {
      setToothZone('');
      setRequestDetails('');
    } else {
      const combined = buildCombinedDentalRequest(teethObjs, presetObjs);
      setToothZone(combined.toothZone);
      setRequestDetails(combined.requestDetails);
      if (combined.recommendedDoctorId) {
        setSelectedDoctorId(combined.recommendedDoctorId);
      }
    }
    setConfirmedAppointment(null);
  }

  function handleToggleTooth(tooth: ToothZone) {
    const exists = selectedTeethFdi.includes(tooth.fdi);
    const nextTeeth = exists
      ? selectedTeethFdi.filter((fdi) => fdi !== tooth.fdi)
      : [...selectedTeethFdi, tooth.fdi];
    setSelectedTeethFdi(nextTeeth);
    syncDentalSelections(nextTeeth, selectedPresetIds);
  }

  function handleTogglePreset(preset: SymptomPreset) {
    const exists = selectedPresetIds.includes(preset.id);
    const nextPresets = exists
      ? selectedPresetIds.filter((id) => id !== preset.id)
      : [...selectedPresetIds, preset.id];
    setSelectedPresetIds(nextPresets);
    syncDentalSelections(selectedTeethFdi, nextPresets);
  }

  function handleClearDentalSelection() {
    setSelectedTeethFdi([]);
    setSelectedPresetIds([]);
    setToothZone('');
    setRequestDetails('');
    setConfirmedAppointment(null);
  }

  function handleProceedFromMap(doctorId: string) {
    setSelectedDoctorId(doctorId);
    scrollToElement('booking');
  }

  function handleSelectServiceFromCompactStrip(preset: SymptomPreset) {
    const nextPresets = selectedPresetIds.includes(preset.id)
      ? selectedPresetIds
      : [...selectedPresetIds, preset.id];
    setSelectedPresetIds(nextPresets);
    syncDentalSelections(selectedTeethFdi, nextPresets);
    scrollToElement('booking');
  }

  async function handleSubmitBooking(
    input: BookingFormInput
  ): Promise<{ ok: boolean; appointment?: Appointment; error?: string }> {
    const doctor = doctors.find((d) => d.id === input.doctorId) || doctors[0];
    const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const slotId = makeSlotId(doctor.id, input.date, input.time);

    let data: {
      ok?: boolean;
      error?: string;
      appointment?: Appointment;
      telegramSent?: boolean;
      telegramPreview?: string;
    };
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appointmentId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone.trim(),
          requestDetails: input.requestDetails.trim(),
          toothZone: input.toothZone.trim(),
          doctorId: doctor.id,
          doctorName: doctor.name,
          date: input.date,
          time: input.time,
        }),
      });
      data = await response.json();
      if (!response.ok || !data.appointment) {
        return { ok: false, error: data.error || 'Не удалось оформить запись' };
      }
    } catch {
      return { ok: false, error: 'Не удалось связаться с сервером. Попробуйте ещё раз.' };
    }

    const previewText =
      data.telegramPreview ||
      formatTelegramNotification({
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        doctorName: doctor.name,
        date: input.date,
        time: input.time,
        toothZone: input.toothZone,
        requestDetails: input.requestDetails,
      });

    // Also persist atomically to Firebase Firestore (appointments + non-PII bookedSlots)
    await createAppointmentInFirestore({
      appointmentId,
      slotId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      requestDetails: input.requestDetails.trim(),
      toothZone: input.toothZone.trim(),
      doctorId: doctor.id,
      doctorName: doctor.name,
      date: input.date,
      time: input.time,
      telegramSent: Boolean(data.telegramSent),
      telegramPreview: previewText,
    });

    await fetchPublicState();
    setConfirmedAppointment(data.appointment);
    return { ok: true, appointment: data.appointment };
  }

  async function handleBossUpdateStatus(id: string, status: AppointmentStatus) {
    const res = await fetch(`/api/boss/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-boss-pin': '1111',
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось обновить статус заявки');
    }
    if (firebaseUser?.emailVerified) {
      try {
        await updateFirestoreAppointmentStatus(id, status);
      } catch {
        // Handled cleanly if doc only exists on server store
      }
    }
    await fetchBossDashboard();
    await fetchPublicState();
  }

  async function handleBossDeleteAppointment(id: string, slotId: string) {
    const res = await fetch(`/api/boss/appointments/${id}`, {
      method: 'DELETE',
      headers: { 'x-boss-pin': '1111' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось удалить запись');
    }
    if (firebaseUser?.emailVerified) {
      try {
        await deleteFirestoreAppointment(id, slotId);
      } catch {
        // Ignore if not in Firestore
      }
    }
    await fetchBossDashboard();
    await fetchPublicState();
  }

  async function handleBossClearAll() {
    const res = await fetch('/api/boss/appointments', {
      method: 'DELETE',
      headers: { 'x-boss-pin': '1111' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось очистить заявки');
    }
    if (firebaseUser?.emailVerified) {
      try {
        await clearAllFirestoreData();
      } catch {
        // Ignore if non-admin
      }
    }
    setFirestoreBookedSlots([]);
    setServerBookedSlots([]);
    setBossAppointments([]);
    setConfirmedAppointment(null);
    await fetchBossDashboard();
    await fetchPublicState();
  }

  async function handleBossRetryTelegram(id: string) {
    const res = await fetch(`/api/boss/appointments/${id}/telegram`, {
      method: 'POST',
      headers: { 'x-boss-pin': '1111' },
    });
    const data = await res.json().catch(() => ({}));
    await fetchBossDashboard();
    if (!res.ok) {
      throw new Error(data.error || 'Не удалось отправить сообщение в Telegram');
    }
    if (data.telegramSent === false) {
      throw new Error(data.telegramError || 'Telegram вернул ошибку при отправке');
    }
  }

  async function handleBossSaveSchedule(
    doctorId: string,
    availableDays: DayKey[],
    timeSlots: string[],
    dateOverrides?: Record<string, string[]>
  ) {
    const res = await fetch(`/api/boss/doctors/${doctorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-boss-pin': '1111',
      },
      body: JSON.stringify({
        availableDays,
        timeSlots,
        dateOverrides: dateOverrides || {},
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось сохранить расписание врача');
    }

    const updatedDoctors = doctors.map((d) =>
      d.id === doctorId
        ? {
            ...d,
            availableDays,
            timeSlots,
            dateOverrides: dateOverrides !== undefined ? dateOverrides : d.dateOverrides,
          }
        : d
    );
    setDoctors(updatedDoctors);

    if (firebaseUser?.emailVerified) {
      const target = updatedDoctors.find((d) => d.id === doctorId);
      if (target) {
        try {
          await saveDoctorToFirestore(target);
        } catch {
          // Ignore if non-admin
        }
      }
    }
    await fetchPublicState();
  }

  async function handleBossSaveLocation(loc: ClinicLocation) {
    const res = await fetch('/api/boss/location', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-boss-pin': '1111',
      },
      body: JSON.stringify(loc),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Не удалось сохранить местоположение клиники');
    }
    setClinicLocation(data.clinicLocation || loc);

    if (firebaseUser?.emailVerified) {
      try {
        await saveClinicLocationToFirestore(loc);
      } catch {
        // Ignore if non-admin
      }
    }
    await fetchPublicState();
    await fetchBossDashboard();
  }

  async function handleBossResetLocation() {
    const res = await fetch('/api/boss/location', {
      method: 'DELETE',
      headers: { 'x-boss-pin': '1111' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось сбросить местоположение');
    }
    setClinicLocation(null);

    if (firebaseUser?.emailVerified) {
      try {
        await deleteClinicLocationFromFirestore();
      } catch {
        // Ignore if non-admin
      }
    }
    await fetchPublicState();
    await fetchBossDashboard();
  }

  async function handleBossToggleMapEnabled(nextEnabled: boolean) {
    const res = await fetch('/api/boss/map-visibility', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-boss-pin': '1111',
      },
      body: JSON.stringify({ mapEnabled: nextEnabled }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Не удалось обновить отображение карты');
    }
    setMapEnabled(nextEnabled);

    if (firebaseUser?.emailVerified) {
      try {
        await saveMapEnabledToFirestore(nextEnabled);
      } catch {
        // Ignore if non-admin
      }
    }
    await fetchPublicState();
    await fetchBossDashboard();
  }

  if (bossUnlocked) {
    return (
      <BossDashboard
        appointments={bossAppointments}
        doctors={doctors}
        bookedSlots={mergedBookedSlots}
        clinicLocation={clinicLocation}
        mapEnabled={mapEnabled}
        telegramConfigured={telegramConfigured}
        onExit={() => setBossUnlocked(false)}
        onUpdateStatus={handleBossUpdateStatus}
        onDeleteAppointment={handleBossDeleteAppointment}
        onClearAll={handleBossClearAll}
        onRetryTelegram={handleBossRetryTelegram}
        onSaveDoctorSchedule={handleBossSaveSchedule}
        onToggleMapEnabled={handleBossToggleMapEnabled}
        onSaveLocation={handleBossSaveLocation}
        onResetLocation={handleBossResetLocation}
        onRefresh={fetchBossDashboard}
      />
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col text-slate-900">
      <ScrollReactiveBackground />

      {/* Case A: Mandatory Google Maps Platform Demo Key Quota Banner (dismissible) */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm sticky top-0 z-50 shadow-sm flex items-center justify-center gap-3">
          <span className="text-center">
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            aria-label="Скрыть уведомление"
            className="px-2 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-200/70 rounded border border-amber-300 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <Navbar
        mapEnabled={mapEnabled}
        bookingAnchorHref={doctorChoiceMode === 'prompt' ? '#booking' : '#booking-form'}
        onBrandTap={handleBrandTap}
        onBookClick={() => scrollToElement('booking')}
      />

      <main className="relative z-10 flex-1">
        <HeroSection
          mapEnabled={mapEnabled}
          onBookClick={() => scrollToElement('booking')}
          onMapClick={() => scrollToElement('dental-map')}
          onLocationClick={() => scrollToElement('clinic-map')}
        />

        <DentalArchMap
          doctors={doctors}
          selectedTeethFdi={selectedTeethFdi}
          selectedPresetIds={selectedPresetIds}
          onToggleTooth={handleToggleTooth}
          onTogglePreset={handleTogglePreset}
          onClearSelection={handleClearDentalSelection}
          onProceedToBooking={handleProceedFromMap}
        />

        <ServicesSection onSelectService={handleSelectServiceFromCompactStrip} />

        <BookingSection
          doctors={doctors}
          days={days}
          bookedSlots={mergedBookedSlots}
          doctorChoiceMode={doctorChoiceMode}
          onChangeDoctorChoiceMode={setDoctorChoiceMode}
          selectedDoctorId={selectedDoctorId}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          firstName={firstName}
          lastName={lastName}
          phone={phone}
          requestDetails={requestDetails}
          toothZone={toothZone}
          onSelectDoctor={(id) => {
            setSelectedDoctorId(id);
            setConfirmedAppointment(null);
          }}
          onSelectDate={(d) => {
            setSelectedDate(d);
            setConfirmedAppointment(null);
          }}
          onSelectTime={(t, resolvedDoctorId) => {
            setSelectedTime(t);
            if (resolvedDoctorId) {
              setSelectedDoctorId(resolvedDoctorId);
            }
            setConfirmedAppointment(null);
          }}
          onChangeField={(field, val) => {
            if (field === 'firstName') setFirstName(val);
            if (field === 'lastName') setLastName(val);
            if (field === 'phone') setPhone(val);
            if (field === 'requestDetails') setRequestDetails(val);
          }}
          onSubmitBooking={handleSubmitBooking}
          onResetConfirmation={() => {
            setConfirmedAppointment(null);
            setFirstName('');
            setLastName('');
            setPhone('');
            setRequestDetails('');
            setToothZone('');
            setSelectedTeethFdi([]);
            setSelectedPresetIds([]);
          }}
          confirmedAppointment={confirmedAppointment}
        />

        {mapEnabled && (
          <ClinicLocationSection
            clinicLocation={clinicLocation}
            publicStateLoaded={publicStateLoaded}
          />
        )}
      </main>

      <footer className="relative z-10 bg-white/85 backdrop-blur-xs border-t border-slate-200 py-10">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-500">
          <div>
            <p className="font-semibold text-slate-900">Люмен Дент</p>
            <p className="text-xs text-slate-500 mt-1">
              Современная стоматология · Ежедневно 09:00–20:00
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#services" className="hover:text-slate-900">
              Услуги
            </a>
            <a href="#dental-map" className="hover:text-slate-900">
              Карта зубов
            </a>
            <a href="#booking" className="hover:text-slate-900">
              Календарь врачей
            </a>
            {mapEnabled && (
              <a href="#clinic-map" className="hover:text-slate-900">
                Карта проезда
              </a>
            )}
            <a
              href={doctorChoiceMode === 'prompt' ? '#booking' : '#booking-form'}
              className="hover:text-slate-900"
            >
              Онлайн-запись
            </a>
            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              className="text-slate-500 hover:text-slate-900 bg-transparent border-0 p-0 cursor-pointer"
            >
              Кабинет врача
            </button>
          </div>
        </div>
      </footer>

      <BossPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => {
          setPinModalOpen(false);
          setBossUnlocked(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClinicAppContent />
    </ErrorBoundary>
  );
}
