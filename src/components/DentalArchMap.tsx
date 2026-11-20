import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import { INITIAL_DOCTORS, SYMPTOM_PRESETS, TEETH_ZONES } from '../data/clinicData';
import type { Doctor, SymptomPreset, ToothZone } from '../types/clinic';

interface DentalArchMapProps {
  doctors: Doctor[];
  selectedTeethFdi: string[];
  selectedPresetIds: string[];
  onToggleTooth: (tooth: ToothZone) => void;
  onTogglePreset: (preset: SymptomPreset) => void;
  onClearSelection: () => void;
  onProceedToBooking: (doctorId: string) => void;
}

export function DentalArchMap({
  doctors,
  selectedTeethFdi,
  selectedPresetIds,
  onToggleTooth,
  onTogglePreset,
  onClearSelection,
  onProceedToBooking,
}: DentalArchMapProps) {
  const selectedTeeth = TEETH_ZONES.filter((t) => selectedTeethFdi.includes(t.fdi));
  const selectedPresets = SYMPTOM_PRESETS.filter((p) => selectedPresetIds.includes(p.id));
  const hasAnySelection = selectedTeeth.length > 0 || selectedPresets.length > 0;

  const recommendedDoctorId =
    selectedPresets[selectedPresets.length - 1]?.recommendedDoctorId ||
    selectedTeeth[selectedTeeth.length - 1]?.recommendedDoctorId ||
    doctors[0]?.id;

  const recommendedDoctor =
    doctors.find((d) => d.id === recommendedDoctorId) ||
    INITIAL_DOCTORS.find((d) => d.id === recommendedDoctorId) ||
    doctors[0];

  const activeTitle = !hasAnySelection
    ? 'Ничего не выбрано — отметьте зубы или задачу'
    : [
        selectedTeeth.length === 1
          ? selectedTeeth[0].label
          : selectedTeeth.length > 1
          ? `Выбрано зубов: ${selectedTeeth.map((t) => t.fdi).join(', ')}`
          : '',
        selectedPresets.length === 1
          ? selectedPresets[0].title
          : selectedPresets.length > 1
          ? `Задач: ${selectedPresets.length}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');

  const activeDuration = !hasAnySelection
    ? 'после выбора ориентира'
    : selectedPresets.length === 1 && selectedTeeth.length === 0
    ? selectedPresets[0].duration
    : selectedTeeth.length === 1 && selectedPresets.length === 0
    ? selectedTeeth[0].durationLabel
    : '60–120 мин (комплексный приём)';

  const activeDescription = !hasAnySelection
    ? 'Нажмите на один или несколько зубов на схеме слева или выберите общие задачи ниже. Повторное нажатие снимает выделение.'
    : [
        selectedTeeth.length === 1
          ? selectedTeeth[0].commonConcern
          : selectedTeeth.length > 1
          ? `Отмеченные зоны: ${selectedTeeth.map((t) => `№${t.fdi}`).join(', ')}. Врач подготовит диагностику сразу по всем выбранным зубам.`
          : '',
        selectedPresets.length > 0
          ? `Выбранные задачи: ${selectedPresets.map((p) => `${p.title} (${p.duration})`).join('; ')}.`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

  return (
    <section
      id="dental-map"
      className="py-14 lg:py-20 bg-[#F8FAFC]/62 backdrop-blur-[1.5px] border-b border-slate-200/80"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-9">
          <p className="text-xs font-medium text-sky-700 mb-2">
            Интерактивный навигатор приёма
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3">
            Укажите зубы или задачи — можно выбрать сразу несколько
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Нажмите на нужные зубы на схеме челюсти или выберите несколько общих задач. Повторное
            нажатие на уже выбранный элемент снимает отметку.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left column: Architectural Dental Arch Diagram */}
          <div className="lg:col-span-6 bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
              <span>Верхняя и нижняя челюсть · мультивыбор</span>
              <span className="font-mono-tabular">
                {selectedTeeth.length > 0 ? `Отмечено: ${selectedTeeth.length}` : '16 ключевых зон'}
              </span>
            </div>

            <div className="relative mx-auto w-full max-w-[340px] aspect-[340/370] my-1">
              <svg
                viewBox="0 20 340 364"
                className="w-full h-full"
                aria-hidden="true"
                data-testid="dental-arch-svg"
              >
                <path
                  d="M 42 172 C 42 52, 298 52, 298 172"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="22"
                  strokeLinecap="round"
                  opacity="0.45"
                />
                <path
                  d="M 42 232 C 42 352, 298 352, 298 232"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="22"
                  strokeLinecap="round"
                  opacity="0.45"
                />
                <path
                  d="M 52 170 C 52 70, 288 70, 288 170"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 52 234 C 52 334, 288 334, 288 234"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <line x1="28" y1="202" x2="312" y2="202" stroke="#E2E8F0" strokeWidth="1" />
                <text
                  x="170"
                  y="150"
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px] font-medium"
                >
                  Верхняя челюсть
                </text>
                <text
                  x="170"
                  y="262"
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px] font-medium"
                >
                  Нижняя челюсть
                </text>
              </svg>

              {TEETH_ZONES.map((tooth) => {
                const isSelected = selectedTeethFdi.includes(tooth.fdi);
                const leftPct = (tooth.cx / 340) * 100;
                const topPct = ((tooth.cy - 20) / 364) * 100;
                return (
                  <button
                    key={tooth.fdi}
                    type="button"
                    data-testid={`tooth-btn-${tooth.fdi}`}
                    onClick={() => onToggleTooth(tooth)}
                    aria-label={tooth.label}
                    aria-pressed={isSelected}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-xl font-mono-tabular text-xs font-semibold transition-colors duration-75 flex items-center justify-center border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                      isSelected
                        ? 'bg-sky-700 text-white border-sky-700 shadow-sm z-10'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-sky-600 hover:text-sky-800'
                    }`}
                  >
                    {tooth.shortTitle}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Правая сторона</span>
              <span>Нажмите повторно для снятия</span>
              <span>Левая сторона</span>
            </div>
          </div>

          {/* Right column: Diagnostic Card + Multi-Select General Presets */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-6">
            {/* Active Selection Insight */}
            <div
              data-testid="dental-selection-summary"
              className="bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Выбранный ориентир</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-slate-700">
                    Ориентировочно {activeDuration}
                  </span>
                </div>
                {hasAnySelection && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Сбросить всё</span>
                  </button>
                )}
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">{activeTitle}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">{activeDescription}</p>

              {recommendedDoctor && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Рекомендуемый специалист</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {recommendedDoctor.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {recommendedDoctor.role} · {recommendedDoctor.cabinet}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onProceedToBooking(recommendedDoctor.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Выбрать время записи</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Concern Presets (multi-select with toggle-off) */}
            <div className="bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-7 flex-1">
              <div className="flex items-center justify-between gap-2 mb-4">
                <p className="text-xs font-medium text-slate-500">
                  Общая задача визита (можно выбрать несколько)
                </p>
                {selectedPresets.length > 0 && (
                  <span className="text-xs font-mono-tabular text-sky-700 font-semibold">
                    Выбрано: {selectedPresets.length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SYMPTOM_PRESETS.map((preset) => {
                  const isActive = selectedPresetIds.includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`preset-btn-${preset.id}`}
                      onClick={() => onTogglePreset(preset)}
                      aria-pressed={isActive}
                      className={`text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                        isActive
                          ? 'bg-sky-50/85 border-sky-600 text-slate-900'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="block text-sm font-semibold text-slate-900 leading-snug">
                          {preset.title}
                        </span>
                        <span className="block text-xs text-slate-500 mt-1 font-mono-tabular">
                          {preset.duration}
                        </span>
                      </div>
                      {isActive && (
                        <Check
                          className="w-4 h-4 text-sky-700 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
