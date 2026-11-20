import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Phone,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { DAY_LABELS_RU } from '../data/clinicData';
import type {
  Appointment,
  AppointmentStatus,
  BookedSlot,
  ClinicLocation,
  DayKey,
  Doctor,
} from '../types/clinic';
import {
  STANDARD_CLINIC_SLOTS,
  formatDisplayDateRu,
  getDoctorSlotsForDate,
  getUpcomingDays,
} from '../utils/bookingLogic';
import { BossLocationTab } from './BossLocationTab';

interface BossDashboardProps {
  appointments: Appointment[];
  doctors: Doctor[];
  bookedSlots: BookedSlot[];
  clinicLocation: ClinicLocation | null;
  mapEnabled: boolean;
  telegramConfigured: boolean;
  onExit: () => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  onDeleteAppointment: (id: string, slotId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onRetryTelegram: (id: string) => Promise<void>;
  onSaveDoctorSchedule: (
    doctorId: string,
    availableDays: DayKey[],
    timeSlots: string[],
    dateOverrides?: Record<string, string[]>
  ) => Promise<void>;
  onToggleMapEnabled: (enabled: boolean) => Promise<void>;
  onSaveLocation: (loc: ClinicLocation) => Promise<void>;
  onResetLocation: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  new: 'Новая заявка',
  confirmed: 'Подтверждена',
  completed: 'Приём завершён',
  cancelled: 'Отменена',
};

const ALL_DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function BossDashboard({
  appointments,
  doctors,
  bookedSlots,
  clinicLocation,
  mapEnabled,
  telegramConfigured,
  onExit,
  onUpdateStatus,
  onDeleteAppointment,
  onClearAll,
  onRetryTelegram,
  onSaveDoctorSchedule,
  onToggleMapEnabled,
  onSaveLocation,
  onResetLocation,
  onRefresh,
}: BossDashboardProps) {
  const calendarDays = useMemo(() => getUpcomingDays(new Date(), 14), []);

  const [activeTab, setActiveTab] = useState<
    'appointments' | 'schedule' | 'location' | 'telegram'
  >('appointments');
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Doctor calendar editor state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    calendarDays[0]?.dateStr || ''
  );
  const [customTimeInput, setCustomTimeInput] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const activeDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const filteredAppointments =
    statusFilter === 'all'
      ? appointments
      : appointments.filter((a) => a.status === statusFilter);

  const totalCount = appointments.length;
  const newCount = appointments.filter((a) => a.status === 'new').length;
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const telegramSentCount = appointments.filter((a) => a.telegramSent).length;

  async function handleConfirmClearAll() {
    setIsClearing(true);
    try {
      await onClearAll();
      setConfirmClearOpen(false);
      setFeedbackMsg('Все записи и занятые окна очищены.');
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось очистить список заявок.'
      );
    } finally {
      setIsClearing(false);
    }
  }

  async function handleToggleDefaultWeekday(doc: Doctor, dayKey: DayKey) {
    const exists = doc.availableDays.includes(dayKey);
    const nextDays = exists
      ? doc.availableDays.filter((d) => d !== dayKey)
      : [...doc.availableDays, dayKey];
    if (nextDays.length === 0) return;
    try {
      await onSaveDoctorSchedule(doc.id, nextDays, doc.timeSlots, doc.dateOverrides || {});
      setFeedbackMsg(`Обновлены базовые рабочие дни врача: ${doc.name}`);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось обновить рабочие дни врача.'
      );
    }
  }

  async function handleToggleDateSlot(doc: Doctor, dateStr: string, time: string) {
    const dayState = getDoctorSlotsForDate(doc, dateStr, bookedSlots);
    const currentTimes = dayState.isWorkingDay ? dayState.slots.map((s) => s.time) : [];
    const exists = currentTimes.includes(time);
    const nextTimes = exists
      ? currentTimes.filter((t) => t !== time)
      : [...currentTimes, time].sort();

    const nextOverrides: Record<string, string[]> = {
      ...(doc.dateOverrides || {}),
      [dateStr]: nextTimes,
    };

    try {
      await onSaveDoctorSchedule(doc.id, doc.availableDays, doc.timeSlots, nextOverrides);
      setFeedbackMsg(
        exists
          ? `Слот ${time} на ${formatDisplayDateRu(dateStr)} закрыт для записи`
          : `Слот ${time} на ${formatDisplayDateRu(dateStr)} открыт для пациентов`
      );
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось сохранить изменение слота.'
      );
    }
  }

  async function handleSetDateDayOff(doc: Doctor, dateStr: string) {
    const nextOverrides: Record<string, string[]> = {
      ...(doc.dateOverrides || {}),
      [dateStr]: [],
    };
    try {
      await onSaveDoctorSchedule(doc.id, doc.availableDays, doc.timeSlots, nextOverrides);
      setFeedbackMsg(`День ${formatDisplayDateRu(dateStr)} отмечен как выходной`);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось отметить выходной день.'
      );
    }
  }

  async function handleResetDateToDefault(doc: Doctor, dateStr: string) {
    const nextOverrides = { ...(doc.dateOverrides || {}) };
    delete nextOverrides[dateStr];
    try {
      await onSaveDoctorSchedule(doc.id, doc.availableDays, doc.timeSlots, nextOverrides);
      setFeedbackMsg(`Для ${formatDisplayDateRu(dateStr)} восстановлен базовый график врача`);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось сбросить график на дату.'
      );
    }
  }

  async function handleAddCustomTimeForDate(doc: Doctor, dateStr: string) {
    const val = customTimeInput.trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
      setFeedbackMsg('Укажите корректное время в формате ЧЧ:ММ, например 18:30');
      return;
    }
    const dayState = getDoctorSlotsForDate(doc, dateStr, bookedSlots);
    const currentTimes = dayState.isWorkingDay ? dayState.slots.map((s) => s.time) : [];
    if (currentTimes.includes(val)) {
      setFeedbackMsg(`Окно ${val} уже открыто на ${formatDisplayDateRu(dateStr)}`);
      return;
    }
    const nextTimes = [...currentTimes, val].sort();
    const nextOverrides: Record<string, string[]> = {
      ...(doc.dateOverrides || {}),
      [dateStr]: nextTimes,
    };
    try {
      await onSaveDoctorSchedule(doc.id, doc.availableDays, doc.timeSlots, nextOverrides);
      setCustomTimeInput('');
      setFeedbackMsg(`Добавлено окно ${val} на ${formatDisplayDateRu(dateStr)}`);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : 'Не удалось добавить слот на дату.'
      );
    }
  }

  const selectedDayInfo = activeDoctor
    ? getDoctorSlotsForDate(activeDoctor, selectedCalendarDate, bookedSlots)
    : { isWorkingDay: false, slots: [], isCustomOverride: false };

  const activeDateAppointments = appointments.filter(
    (a) =>
      activeDoctor &&
      a.doctorId === activeDoctor.id &&
      a.date === selectedCalendarDate &&
      a.status !== 'cancelled'
  );

  const allTimeButtons = useMemo(() => {
    const set = new Set<string>([
      ...STANDARD_CLINIC_SLOTS,
      ...(activeDoctor?.timeSlots || []),
      ...selectedDayInfo.slots.map((s) => s.time),
    ]);
    return Array.from(set).sort();
  }, [activeDoctor, selectedDayInfo.slots]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Executive Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>На сайт клиники</span>
            </button>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <h1 className="text-base font-bold text-slate-900 truncate">
              Кабинет руководителя · Люмен Дент
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-1">Всего заявок</p>
            <p className="text-2xl font-bold font-mono-tabular text-slate-900">{totalCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-1">Ожидают звонка</p>
            <p className="text-2xl font-bold font-mono-tabular text-sky-700">{newCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-1">Подтверждены</p>
            <p className="text-2xl font-bold font-mono-tabular text-emerald-700">
              {confirmedCount}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-1">Отправлено в Telegram</p>
            <p className="text-2xl font-bold font-mono-tabular text-slate-800">
              {telegramSentCount}
            </p>
          </div>
        </div>

        {/* Workspace Controls & Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setActiveTab('appointments')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'appointments'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Заявки пациентов
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Календарь врачей
            </button>
            <button
              type="button"
              data-testid="boss-tab-location"
              onClick={() => setActiveTab('location')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'location'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Местоположение клиники
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telegram')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'telegram'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Журнал Telegram
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Обновить</span>
            </button>

            {appointments.length > 0 && !confirmClearOpen && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Очистить информацию</span>
              </button>
            )}
          </div>
        </div>

        {/* Two-step Clear Confirmation Banner */}
        {confirmClearOpen && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-900">
                Удалить все заявки пациентов и освободить все окна записи?
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                Действие очистит текущий список заявок в приложении и освободит слоты для новых
                пациентов.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleConfirmClearAll}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl"
              >
                {isClearing ? 'Очистка...' : 'Подтвердить очистку'}
              </button>
            </div>
          </div>
        )}

        {feedbackMsg && (
          <div className="mb-6 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-xs font-medium text-sky-900 flex items-center justify-between">
            <span>{feedbackMsg}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg('')}
              className="text-sky-700 hover:text-sky-900 font-semibold"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* Tab 1: Appointments */}
        {activeTab === 'appointments' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">
                Подробная лента записей
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', 'Все'],
                    ['new', 'Новые'],
                    ['confirmed', 'Подтверждённые'],
                    ['completed', 'Завершённые'],
                    ['cancelled', 'Отменённые'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center" data-testid="boss-empty-state">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                <p className="text-base font-semibold text-slate-900 mb-1">
                  Заявок пока нет
                </p>
                <p className="text-sm text-slate-500">
                  Новые записи пациентов появятся здесь автоматически сразу после отправки формы.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-sky-800">
                          {formatDisplayDateRu(apt.date)} · {apt.time}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{apt.doctorName}</span>
                        {apt.toothZone && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700 font-medium">{apt.toothZone}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="text-base font-bold text-slate-900">
                          {apt.firstName} {apt.lastName}
                        </h3>
                        <a
                          href={`tel:${apt.phone}`}
                          className="inline-flex items-center gap-1.5 text-sm font-mono-tabular text-sky-700 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{apt.phone}</span>
                        </a>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed">
                        {apt.requestDetails}
                      </p>

                      <p className="text-xs text-slate-500">
                        Telegram:{' '}
                        {apt.telegramSent
                          ? 'Доставлено в бот клиники'
                          : 'Сформировано в журнале (ожидает токен)'}{' '}
                        · Статус: {STATUS_LABELS[apt.status]}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <label htmlFor={`status-${apt.id}`} className="sr-only">
                        Статус заявки для {apt.firstName} {apt.lastName}
                      </label>
                      <select
                        id={`status-${apt.id}`}
                        value={apt.status}
                        disabled={busyId === apt.id}
                        onChange={async (e) => {
                          setBusyId(apt.id);
                          try {
                            await onUpdateStatus(apt.id, e.target.value as AppointmentStatus);
                          } catch (err) {
                            setFeedbackMsg(
                              err instanceof Error ? err.message : 'Не удалось обновить статус заявки.'
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-800 bg-[#F8FAFC] border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                      >
                        <option value="new">Новая заявка</option>
                        <option value="confirmed">Подтверждена</option>
                        <option value="completed">Приём завершён</option>
                        <option value="cancelled">Отменена</option>
                      </select>

                      <button
                        type="button"
                        disabled={busyId === apt.id}
                        onClick={async () => {
                          setBusyId(apt.id);
                          try {
                            await onDeleteAppointment(apt.id, apt.slotId);
                          } catch (err) {
                            setFeedbackMsg(
                              err instanceof Error ? err.message : 'Не удалось удалить запись.'
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        aria-label={`Удалить запись ${apt.firstName} ${apt.lastName}`}
                        className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Interactive 14-Day Doctor Calendar */}
        {activeTab === 'schedule' && activeDoctor && (
          <div className="space-y-6">
            {/* Doctor selector bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {doctors.map((doc) => {
                  const selected = doc.id === activeDoctor.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-colors ${
                        selected
                          ? 'bg-sky-700 border-sky-700 text-white'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:border-sky-500'
                      }`}
                    >
                      {doc.name}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-500">
                {activeDoctor.role} · {activeDoctor.cabinet}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: 14-Day Calendar Grid */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Календарь врача на 14 дней
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Выберите конкретную дату, чтобы задать точное рабочее время и доступные слоты
                    </p>
                  </div>
                  <CalendarDays className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mb-6">
                  {calendarDays.map((day) => {
                    const dayState = getDoctorSlotsForDate(
                      activeDoctor,
                      day.dateStr,
                      bookedSlots
                    );
                    const isSelected = selectedCalendarDate === day.dateStr;
                    const freeCount = dayState.slots.filter((s) => s.available).length;
                    const bookedCount = dayState.slots.filter((s) => !s.available).length;

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        data-testid={`boss-cal-day-${day.dateStr}`}
                        onClick={() => setSelectedCalendarDate(day.dateStr)}
                        aria-pressed={isSelected}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : dayState.isWorkingDay
                            ? 'bg-[#F8FAFC] border-slate-200 text-slate-900 hover:border-sky-500'
                            : 'bg-slate-50 border-slate-200/70 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[11px] ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {day.weekdayShort}
                          </span>
                          {dayState.isCustomOverride && (
                            <span
                              className={`text-[10px] font-semibold ${
                                isSelected ? 'text-sky-300' : 'text-sky-700'
                              }`}
                            >
                              Инд.
                            </span>
                          )}
                        </div>
                        <span className="block text-xs font-bold mt-1 whitespace-nowrap">
                          {day.dateLabel}
                        </span>
                        <span
                          className={`block text-[11px] mt-1 font-mono-tabular ${
                            isSelected
                              ? 'text-sky-200'
                              : dayState.isWorkingDay
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {dayState.isWorkingDay ? `${freeCount} своб.` : 'Выходной'}
                        </span>
                        {bookedCount > 0 && (
                          <span
                            className={`block text-[10px] font-mono-tabular ${
                              isSelected ? 'text-emerald-300' : 'text-emerald-700'
                            }`}
                          >
                            {bookedCount} зап.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Default weekly pattern */}
                <div className="pt-5 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Базовые рабочие дни недели (по умолчанию)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAYS.map((dayKey) => {
                      const active = activeDoctor.availableDays.includes(dayKey);
                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => handleToggleDefaultWeekday(activeDoctor, dayKey)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            active
                              ? 'bg-sky-700 border-sky-700 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {DAY_LABELS_RU[dayKey]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Selected Date Slot Editor */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-sky-700">
                      Настройка выбранной даты
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatDisplayDateRu(selectedCalendarDate)}
                    </h3>
                  </div>
                  {selectedDayInfo.isCustomOverride && (
                    <button
                      type="button"
                      onClick={() =>
                        handleResetDateToDefault(activeDoctor, selectedCalendarDate)
                      }
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                    >
                      Сбросить дату
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  <button
                    type="button"
                    onClick={() =>
                      handleSetDateDayOff(activeDoctor, selectedCalendarDate)
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                      !selectedDayInfo.isWorkingDay
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Сделать выходным
                  </button>
                  {!selectedDayInfo.isWorkingDay && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onSaveDoctorSchedule(
                            activeDoctor.id,
                            activeDoctor.availableDays,
                            activeDoctor.timeSlots,
                            {
                              ...(activeDoctor.dateOverrides || {}),
                              [selectedCalendarDate]: [...activeDoctor.timeSlots],
                            }
                          );
                          setFeedbackMsg(
                            `Открыт приём на ${formatDisplayDateRu(selectedCalendarDate)}`
                          );
                        } catch (err) {
                          setFeedbackMsg(
                            err instanceof Error
                              ? err.message
                              : 'Не удалось открыть рабочий день.'
                          );
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-700 text-white hover:bg-sky-800"
                    >
                      Открыть рабочий день
                    </button>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-700 mb-2.5">
                  Доступные слоты на {formatDisplayDateRu(selectedCalendarDate)} (нажмите, чтобы
                  включить или скрыть)
                </p>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  {allTimeButtons.map((time) => {
                    const slotObj = selectedDayInfo.slots.find((s) => s.time === time);
                    const isOpen = Boolean(slotObj);
                    const isBooked = Boolean(slotObj && !slotObj.available);

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        data-testid={`boss-slot-toggle-${time}`}
                        onClick={() =>
                          handleToggleDateSlot(activeDoctor, selectedCalendarDate, time)
                        }
                        className={`px-2.5 py-2 rounded-xl border text-xs font-mono-tabular font-semibold transition-colors ${
                          isBooked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-not-allowed'
                            : isOpen
                            ? 'bg-sky-700 border-sky-700 text-white'
                            : 'bg-[#F8FAFC] border-slate-200 text-slate-500 hover:border-sky-500'
                        }`}
                      >
                        {time}
                        {isBooked ? ' · Занято' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Add custom slot time for that date */}
                <div className="pt-4 border-t border-slate-200 flex gap-2 mb-5">
                  <input
                    type="text"
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    placeholder="18:30"
                    aria-label="Добавить нестандартное время приёма"
                    className="w-24 px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAddCustomTimeForDate(activeDoctor, selectedCalendarDate)
                    }
                    className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Добавить слот на дату
                  </button>
                </div>

                {/* Appointments scheduled for this date */}
                {activeDateAppointments.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Записи пациентов на {formatDisplayDateRu(selectedCalendarDate)}
                    </p>
                    <div className="space-y-2">
                      {activeDateAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-semibold text-slate-900">
                            {apt.time} · {apt.firstName} {apt.lastName}
                          </span>
                          <span className="font-mono-tabular text-slate-500">{apt.phone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Telegram Delivery Log */}
        {activeTab === 'telegram' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Интеграция с Telegram-ботом клиники
                </h3>
                <p className="text-xs text-slate-600">
                  {telegramConfigured
                    ? 'Бот настроен: каждая заявка автоматически уходит в рабочий чат клиники.'
                    : 'Чтобы сообщения уходили в реальный Telegram-чат, добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменные окружения.'}
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-medium text-slate-700">
                {telegramConfigured ? 'Статус: Подключён' : 'Статус: Предпросмотр сообщений'}
              </span>
            </div>

            {appointments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Сообщений для Telegram пока нет.
              </p>
            ) : (
              <div className="space-y-4">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <pre className="text-xs font-mono-tabular text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {apt.telegramPreview}
                    </pre>
                    <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                      <span
                        className={`text-xs font-medium ${
                          apt.telegramSent ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {apt.telegramSent ? 'Отправлено в Telegram' : 'Ожидает отправки'}
                      </span>
                      {!apt.telegramSent && apt.telegramError && (
                        <span className="text-[11px] text-rose-600 max-w-xs sm:text-right">
                          {apt.telegramError}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busyId === apt.id}
                        onClick={async () => {
                          setBusyId(apt.id);
                          try {
                            await onRetryTelegram(apt.id);
                            setFeedbackMsg('Запрос на отправку в Telegram выполнен.');
                          } catch (err) {
                            setFeedbackMsg(
                              err instanceof Error
                                ? err.message
                                : 'Не удалось повторить отправку в Telegram.'
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{busyId === apt.id ? 'Отправка...' : 'Повторить отправку'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Clinic Location Picker */}
        {activeTab === 'location' && (
          <BossLocationTab
            clinicLocation={clinicLocation}
            mapEnabled={mapEnabled}
            onToggleMapEnabled={onToggleMapEnabled}
            onSaveLocation={onSaveLocation}
            onResetLocation={onResetLocation}
            onFeedback={setFeedbackMsg}
          />
        )}
      </main>
    </div>
  );
}
