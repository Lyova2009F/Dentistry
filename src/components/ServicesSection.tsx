import { ArrowUpRight } from 'lucide-react';
import { SYMPTOM_PRESETS } from '../data/clinicData';
import type { SymptomPreset } from '../types/clinic';

interface ServicesSectionProps {
  onSelectService: (preset: SymptomPreset) => void;
}

const COMPACT_DIRECTIONS: {
  num: string;
  label: string;
  preset: SymptomPreset;
}[] = [
  { num: '01', label: 'Осмотр и снимок', preset: SYMPTOM_PRESETS[5] },
  { num: '02', label: 'Лечение под микроскопом', preset: SYMPTOM_PRESETS[1] },
  { num: '03', label: 'Гигиена AirFlow', preset: SYMPTOM_PRESETS[0] },
  { num: '04', label: 'Имплантация и коронки', preset: SYMPTOM_PRESETS[2] },
  { num: '05', label: 'Элайнеры и отбеливание', preset: SYMPTOM_PRESETS[4] },
];

export function ServicesSection({ onSelectService }: ServicesSectionProps) {
  return (
    <section
      id="services"
      data-testid="services-section"
      className="py-7 lg:py-9 bg-white/70 backdrop-blur-[1.5px] border-b border-slate-200/80"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            Направления клиники
          </h2>
          <p className="text-xs text-slate-500">
            Нажмите на направление для быстрого выбора времени записи
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {COMPACT_DIRECTIONS.map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => onSelectService(item.preset)}
              className="group text-left bg-white/95 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-500 rounded-xl px-4 py-3.5 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-mono-tabular text-slate-500">
                  {item.num} · {item.preset.duration}
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                  {item.label}
                </p>
              </div>
              <ArrowUpRight
                className="w-4 h-4 text-sky-700 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
