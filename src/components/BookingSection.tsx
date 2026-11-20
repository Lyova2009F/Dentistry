import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Stethoscope,
  UserCheck,
  Users,
} from 'lucide-react';
import { DAY_LABELS_RU } from '../data/clinicData';
import type {
  Appointment,
  BookedSlot,
  BookingFormInput,
  DayOption,
  Doctor,
} from '../types/clinic';
import {
  formatDisplayDateRu,
  getAnyDoctorSlotsForDate,
  getDoctorSlotsForDate,
  validateBookingInput,
} from '../utils/bookingLogic';

export type DoctorChoiceMode = 'prompt' | 'specific' | 'any';

interface BookingSectionProps {
  doctors: Doctor[];
  days: DayOption[];
  bookedSlots: BookedSlot[];
  doctorChoiceMode: DoctorChoiceMode;
  onChangeDoctorChoiceMode: (mode: DoctorChoiceMode) => void;
  selectedDoctorId: string;
  selectedDate: string;
  selectedTime: string;
  firstName: string;
  lastName: string;
  phone: string;
  requestDetails: string;
  toothZone: string;
  onSelectDoctor: (doctorId: string) => void;
  onSelectDate: (dateStr: string) => void;
  onSelectTime: (time: string, resolvedDoctorId?: string) => void;
  onChangeField: (
    field: 'firstName' | 'lastName' | 'phone' | 'requestDetails',
    value: string
  ) => void;
  onSubmitBooking: (
    input: BookingFormInput
  ) => Promise<{ ok: boolean; appointment?: Appointment; error?: string }>;
  onResetConfirmation: () => void;
  confirmedAppointment: Appointment | null;
}

export function BookingSection({
  doctors,
  days,
  bookedSlots,
  doctorChoiceMode,
  onChangeDoctorChoiceMode,
  selectedDoctorId,
  selectedDate,
  selectedTime,
  firstName,
  lastName,
  phone,
  requestDetails,
  toothZone,
  onSelectDoctor,
  onSelectDate,
  onSelectTime,
  onChangeField,
  onSubmitBooking,
  onResetConfirmation,
  confirmedAppointment,
}: BookingSectionProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormInput, string>>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const singleDocDayState = getDoctorSlotsForDate(activeDoctor, selectedDate, bookedSlots);
  const anyDocDayState = getAnyDoctorSlotsForDate(
    doctors,
    selectedDate,
    bookedSlots,
    selectedDoctorId
  );

  const isWorkingDay =
    doctorChoiceMode === 'any' ? anyDocDayState.isWorkingDay : singleDocDayState.isWorkingDay;
  const isCustomOverride =
    doctorChoiceMode === 'specific' ? singleDocDayState.isCustomOverride : false;

  const activeDayObj = days.find((d) => d.dateStr === selectedDate);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const payload: BookingFormInput = {
      firstName,
      lastName,
      phone,
      requestDetails,
      toothZone,
      doctorId: activeDoctor?.id || '',
      date: selectedDate,
      time: selectedTime,
    };

    const validation = validateBookingInput(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await onSubmitBooking(payload);
      if (!result.ok) {
        setSubmitError(result.error || 'Не удалось сохранить запись. Попробуйте другое время.');
      }
    } catch {
      setSubmitError('Ошибка сети при отправке заявки. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="booking"
      className="py-14 lg:py-20 bg-[#F8FAFC]/62 backdrop-blur-[1.5px]"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-9">
          <p className="text-xs font-medium text-sky-700 mb-2">
            Календарь врачей и онлайн-запись
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3">
            Запись на приём и удобное время
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Выберите формат подбора времени — с привязкой к конкретному специалисту или любое
            удобное свободное окно клиники на ближайшие 14 дней.
          </p>
        </div>

        {/* Step 01 Prompt: Choose specific doctor vs any available doctor */}
        {doctorChoiceMode === 'prompt' ? (
          <div
            data-testid="doctor-choice-prompt"
            className="bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-10 mb-8"
          >
            <div className="max-w-2xl mb-6">
              <p className="text-xs font-semibold text-sky-700 mb-1.5">01. Выбор формата записи</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                Желаете выбрать определённого врача?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Если вы хотите попасть к конкретному доктору, мы откроем список специалистов и его
                персональные окна приёма. Если врач не принципиален — покажем все свободные часы в
                клинике.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                data-testid="choose-specific-doctor-btn"
                onClick={() => onChangeDoctorChoiceMode('specific')}
                className="text-left p-6 rounded-2xl border border-slate-200 bg-[#F8FAFC] hover:bg-white hover:border-sky-600 transition-colors flex items-start gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-700 text-white flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-base font-bold text-slate-900">
                    Да, выбрать определённого врача
                  </span>
                  <span className="block text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Показать карточки врачей, их специализацию и удобные свободные слоты каждого
                    доктора.
                  </span>
                </div>
              </button>

              <button
                type="button"
                data-testid="choose-any-doctor-btn"
                onClick={() => onChangeDoctorChoiceMode('any')}
                className="text-left p-6 rounded-2xl border border-slate-200 bg-[#F8FAFC] hover:bg-white hover:border-sky-600 transition-colors flex items-start gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-base font-bold text-slate-900">
                    Нет, мне подойдёт любой свободный врач
                  </span>
                  <span className="block text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Сразу показать все открытые окна приёма в клинике по датам и времени.
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Back button bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <button
                type="button"
                data-testid="doctor-choice-back-btn"
                onClick={() => onChangeDoctorChoiceMode('prompt')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white/95 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Назад к выбору врача</span>
              </button>

              <span className="text-xs text-slate-600 font-medium">
                {doctorChoiceMode === 'specific'
                  ? 'Режим: выбор определённого специалиста'
                  : 'Режим: любой свободный специалист клиники'}
              </span>
            </div>

            {/* Step 1: Doctor Cards (shown ONLY when user clicked "Да, выбрать определённого врача") */}
            {doctorChoiceMode === 'specific' && (
              <div className="mb-10" data-testid="specific-doctor-list">
                <p className="text-xs font-semibold text-slate-500 mb-4">
                  01. Специалист клиники
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {doctors.map((doc) => {
                    const isSelected = doc.id === activeDoctor?.id;
                    const workingDaysText = doc.availableDays
                      .map((k) => DAY_LABELS_RU[k] || k)
                      .join(' · ');

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          onSelectDoctor(doc.id);
                          setErrors((prev) => ({
                            ...prev,
                            doctorId: undefined,
                            time: undefined,
                          }));
                        }}
                        aria-pressed={isSelected}
                        className={`text-left rounded-2xl border p-5 transition-all flex flex-col justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                          isSelected
                            ? 'bg-white border-sky-600 ring-2 ring-sky-600/15'
                            : 'bg-white/95 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                              <img
                                src={doc.imageUrl}
                                alt={doc.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover object-top"
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 leading-snug">
                                {doc.name}
                              </h3>
                              <p className="text-xs text-sky-800 font-medium mt-0.5">{doc.role}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {doc.experience} · {doc.cabinet}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 leading-relaxed mb-4">{doc.bio}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Дни приёма: {workingDaysText}</span>
                          <span
                            className={`font-semibold ${
                              isSelected ? 'text-sky-700' : 'text-slate-700'
                            }`}
                          >
                            {isSelected ? 'Выбран' : 'Выбрать'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2 & 3 Split: 14-Day Calendar + Patient Booking Form */}
            <div
              id="booking-form"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left: 14-day Calendar & Time Slots */}
              <div className="lg:col-span-6 bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      02. Календарь и свободные окна
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">
                      {doctorChoiceMode === 'specific'
                        ? `График: ${activeDoctor?.name}`
                        : 'Общее расписание всех свободных врачей'}
                    </h3>
                  </div>
                  <Calendar className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                </div>

                {/* 14-Day Interactive Calendar Grid */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">Ближайшие 14 дней приёма</p>
                    <span className="text-[11px] text-slate-500">Нажмите на рабочий день</span>
                  </div>
                  <div
                    data-testid="patient-doctor-calendar"
                    className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-4 gap-2"
                  >
                    {days.map((day) => {
                      const dayState =
                        doctorChoiceMode === 'any'
                          ? getAnyDoctorSlotsForDate(
                              doctors,
                              day.dateStr,
                              bookedSlots,
                              selectedDoctorId
                            )
                          : getDoctorSlotsForDate(activeDoctor, day.dateStr, bookedSlots);

                      const worksToday = dayState.isWorkingDay;
                      const freeCount = dayState.slots.filter((s) => s.available).length;
                      const isDateSelected = selectedDate === day.dateStr;
                      const showCustomBadge =
                        doctorChoiceMode === 'specific' &&
                        'isCustomOverride' in dayState &&
                        dayState.isCustomOverride;

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          data-testid={`patient-cal-day-${day.dateStr}`}
                          disabled={!worksToday}
                          onClick={() => {
                            onSelectDate(day.dateStr);
                            setErrors((prev) => ({
                              ...prev,
                              date: undefined,
                              time: undefined,
                            }));
                          }}
                          aria-pressed={isDateSelected}
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            !worksToday
                              ? 'bg-slate-50 border-slate-200/70 text-slate-400 cursor-not-allowed'
                              : isDateSelected
                              ? 'bg-sky-700 border-sky-700 text-white'
                              : 'bg-[#F8FAFC] border-slate-200 text-slate-800 hover:bg-white hover:border-sky-500'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[11px] ${
                                isDateSelected ? 'text-sky-100' : 'text-slate-500'
                              }`}
                            >
                              {day.weekdayShort}
                            </span>
                            {showCustomBadge && worksToday && (
                              <span
                                className={`text-[10px] font-medium ${
                                  isDateSelected ? 'text-sky-100' : 'text-sky-700'
                                }`}
                              >
                                Инд.
                              </span>
                            )}
                          </div>
                          <span className="block text-sm font-semibold mt-0.5 whitespace-nowrap">
                            {day.dateLabel}
                          </span>
                          <span
                            className={`block text-[11px] mt-1 font-mono-tabular ${
                              !worksToday
                                ? 'text-slate-400'
                                : isDateSelected
                                ? 'text-sky-100'
                                : freeCount === 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {worksToday
                              ? freeCount > 0
                                ? `${freeCount} своб.`
                                : 'Мест нет'
                              : 'Выходной'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.date && (
                    <p className="text-xs text-rose-600 mt-2" role="alert">
                      {errors.date}
                    </p>
                  )}
                </div>

                {/* Time Slots Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">
                      Окна на {activeDayObj ? activeDayObj.fullLabel : selectedDate}
                      {isCustomOverride ? ' · Индивидуальный график' : ''}
                    </p>
                    <span className="text-xs text-slate-500 font-mono-tabular">
                      {doctorChoiceMode === 'specific' ? activeDoctor?.cabinet : 'Все кабинеты'}
                    </span>
                  </div>

                  {!isWorkingDay ? (
                    <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        В этот день нет свободного приёма
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Выберите другой доступный день в календаре выше.
                      </p>
                    </div>
                  ) : doctorChoiceMode === 'any' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {anyDocDayState.slots.map((slot) => {
                        const isTimeSelected = selectedTime === slot.time && slot.available;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => {
                              onSelectTime(slot.time, slot.doctorId);
                              setErrors((prev) => ({ ...prev, time: undefined }));
                            }}
                            aria-pressed={isTimeSelected}
                            className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                              !slot.available
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : isTimeSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-[#F8FAFC] border-slate-200 text-slate-800 hover:bg-white hover:border-sky-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono-tabular text-sm font-semibold">
                                {slot.time}
                              </span>
                              <span
                                className={`text-[11px] ${
                                  !slot.available
                                    ? 'text-slate-500'
                                    : isTimeSelected
                                    ? 'text-slate-200'
                                    : 'text-sky-700'
                                }`}
                              >
                                {slot.available ? 'Свободно' : 'Занято'}
                              </span>
                            </div>
                            <p
                              className={`text-[10px] mt-1 truncate ${
                                isTimeSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {slot.doctorName.split(' ')[0]}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {singleDocDayState.slots.map((slot) => {
                        const isTimeSelected = selectedTime === slot.time && slot.available;
                        return (
                          <button
                            key={slot.slotId}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => {
                              onSelectTime(slot.time);
                              setErrors((prev) => ({ ...prev, time: undefined }));
                            }}
                            aria-pressed={isTimeSelected}
                            className={`px-3 py-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                              !slot.available
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : isTimeSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-[#F8FAFC] border-slate-200 text-slate-800 hover:bg-white hover:border-sky-600'
                            }`}
                          >
                            <span className="font-mono-tabular text-sm font-semibold">
                              {slot.time}
                            </span>
                            <span
                              className={`text-[11px] ${
                                !slot.available
                                  ? 'text-slate-500'
                                  : isTimeSelected
                                  ? 'text-slate-200'
                                  : 'text-sky-700'
                              }`}
                            >
                              {slot.available ? 'Свободно' : 'Занято'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.time && (
                    <p className="text-xs text-rose-600 mt-2" role="alert">
                      {errors.time}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Patient Form or Confirmation Receipt */}
              <div className="lg:col-span-6 bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8">
                {confirmedAppointment ? (
                  <div data-testid="booking-confirmation" className="py-2">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-700 font-semibold">Заявка принята</p>
                        <h3 className="text-xl font-bold text-slate-900">
                          Вы записаны на приём
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mb-6">
                      Информация о записи передана администратору клиники и направлена в Telegram.
                    </p>

                    <dl className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 space-y-3 text-sm mb-6">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Пациент</dt>
                        <dd className="font-semibold text-slate-900 text-right">
                          {confirmedAppointment.firstName} {confirmedAppointment.lastName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Телефон</dt>
                        <dd className="font-mono-tabular font-medium text-slate-900 text-right">
                          {confirmedAppointment.phone}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Врач</dt>
                        <dd className="font-semibold text-slate-900 text-right">
                          {confirmedAppointment.doctorName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Дата и время</dt>
                        <dd className="font-mono-tabular font-semibold text-sky-800 text-right">
                          {formatDisplayDateRu(confirmedAppointment.date)} в{' '}
                          {confirmedAppointment.time}
                        </dd>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <dt className="text-slate-500 mb-1">Что требуется</dt>
                        <dd className="text-slate-800">{confirmedAppointment.requestDetails}</dd>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4 text-xs">
                        <dt className="text-slate-500">Канал передачи</dt>
                        <dd className="font-medium text-slate-800">
                          {confirmedAppointment.telegramSent
                            ? 'Доставлено в Telegram и приложение'
                            : 'Сохранено в приложении · Telegram готов к отправке'}
                        </dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      onClick={onResetConfirmation}
                      className="w-full py-3 px-5 text-sm font-semibold text-slate-900 bg-[#F8FAFC] hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
                    >
                      Записать ещё одного пациента
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">
                          03. Ваши данные
                        </p>
                        <h3 className="text-lg font-bold text-slate-900">
                          Заявка в клинику и Telegram
                        </h3>
                      </div>
                      <UserCheck className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                    </div>

                    {/* Selected Slot Summary Strip */}
                    <div className="mb-5 p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
                        <span>
                          {activeDoctor?.name} ·{' '}
                          <strong className="font-mono-tabular text-slate-900">
                            {selectedDate ? formatDisplayDateRu(selectedDate) : '—'}{' '}
                            {selectedTime ? `в ${selectedTime}` : '(время не выбрано)'}
                          </strong>
                        </span>
                      </div>
                      {toothZone && (
                        <span className="text-sky-800 font-medium">{toothZone}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label
                          htmlFor="booking-first-name"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Имя
                        </label>
                        <input
                          id="booking-first-name"
                          type="text"
                          maxLength={80}
                          value={firstName}
                          onChange={(e) => {
                            onChangeField('firstName', e.target.value);
                            if (errors.firstName) {
                              setErrors((prev) => ({ ...prev, firstName: undefined }));
                            }
                          }}
                          placeholder="Например, Анна"
                          autoComplete="given-name"
                          className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15"
                        />
                        {errors.firstName && (
                          <p className="text-xs text-rose-600 mt-1" role="alert">
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="booking-last-name"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Фамилия
                        </label>
                        <input
                          id="booking-last-name"
                          type="text"
                          maxLength={80}
                          value={lastName}
                          onChange={(e) => {
                            onChangeField('lastName', e.target.value);
                            if (errors.lastName) {
                              setErrors((prev) => ({ ...prev, lastName: undefined }));
                            }
                          }}
                          placeholder="Например, Соколова"
                          autoComplete="family-name"
                          className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15"
                        />
                        {errors.lastName && (
                          <p className="text-xs text-rose-600 mt-1" role="alert">
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label
                        htmlFor="booking-phone"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Номер телефона
                      </label>
                      <input
                        id="booking-phone"
                        type="tel"
                        maxLength={32}
                        value={phone}
                        onChange={(e) => {
                          onChangeField('phone', e.target.value);
                          if (errors.phone) {
                            setErrors((prev) => ({ ...prev, phone: undefined }));
                          }
                        }}
                        placeholder="+7 (999) 123-45-67"
                        autoComplete="tel"
                        className="w-full px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15"
                      />
                      {errors.phone && (
                        <p className="text-xs text-rose-600 mt-1" role="alert">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div className="mb-5">
                      <label
                        htmlFor="booking-request"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Что примерно требуется или беспокоит
                      </label>
                      <textarea
                        id="booking-request"
                        rows={3}
                        maxLength={600}
                        value={requestDetails}
                        onChange={(e) => {
                          onChangeField('requestDetails', e.target.value);
                          if (errors.requestDetails) {
                            setErrors((prev) => ({ ...prev, requestDetails: undefined }));
                          }
                        }}
                        placeholder="Например: профессиональная гигиена, ноет верхний зуб справа или плановый осмотр"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15 resize-none"
                      />
                      {errors.requestDetails && (
                        <p className="text-xs text-rose-600 mt-1" role="alert">
                          {errors.requestDetails}
                        </p>
                      )}
                    </div>

                    {submitError && (
                      <div
                        className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
                        role="alert"
                      >
                        {submitError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {isSubmitting ? 'Отправляем заявку...' : 'Подтвердить запись в клинику'}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
