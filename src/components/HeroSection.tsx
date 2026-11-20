import { ArrowRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { HERO_IMAGE } from '../data/clinicData';

interface HeroSectionProps {
  mapEnabled: boolean;
  onBookClick: () => void;
  onMapClick: () => void;
  onLocationClick: () => void;
}

export function HeroSection({
  mapEnabled,
  onBookClick,
  onMapClick,
  onLocationClick,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-white/60 backdrop-blur-[1px] border-b border-slate-200/80">
      {/* Atmospheric architectural dental clinic background with layered prism light animation */}
      <div className="relative min-h-[560px] lg:min-h-[620px] flex items-center">
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-teal-50/70">
          <img
            src={HERO_IMAGE}
            alt="Светлый минималистичный кабинет стоматологии Люмен Дент с панорамными окнами"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center animate-hero-drift"
          />

          {/* Sweeping diagonal prism light beam */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/4 w-[320px] h-[900px] bg-gradient-to-r from-transparent via-white/70 to-transparent blur-xl animate-prism-sweep"
          />

          {/* Sunlit architectural caustic halos (GPU-composited transform & opacity) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-[-4%] w-[560px] h-[560px] rounded-full bg-radial from-sky-300/55 via-sky-100/30 to-transparent blur-2xl animate-sunbeam-a"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-[22%] w-[500px] h-[360px] rounded-full bg-radial from-teal-200/50 via-cyan-100/30 to-transparent blur-2xl animate-sunbeam-b"
          />

          {/* Rotating precision enamel lens rings + kinetic curves */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 620"
            fill="none"
            className="pointer-events-none absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <motion.path
              d="M-80 430 C 260 300, 560 490, 930 330 C 1180 220, 1340 280, 1520 195"
              stroke="rgba(2, 132, 199, 0.34)"
              strokeWidth="2.25"
              initial={{ pathLength: 0.25, opacity: 0.35 }}
              animate={{
                pathLength: [0.35, 1, 0.35],
                opacity: [0.35, 0.72, 0.35],
                y: [0, -14, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.path
              d="M-40 495 C 310 375, 620 535, 990 390 C 1220 305, 1380 350, 1540 270"
              stroke="rgba(13, 148, 136, 0.28)"
              strokeWidth="1.75"
              initial={{ pathLength: 0.3, opacity: 0.3 }}
              animate={{
                pathLength: [0.45, 1, 0.45],
                opacity: [0.28, 0.62, 0.28],
                y: [0, 12, 0],
              }}
              transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
            />
            <g transform="translate(1150 220)">
              <g className="animate-orbit-slow">
                <circle
                  cx="0"
                  cy="0"
                  r="175"
                  stroke="rgba(2, 132, 199, 0.26)"
                  strokeWidth="1.5"
                  strokeDasharray="12 10"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="128"
                  stroke="rgba(13, 148, 136, 0.24)"
                  strokeWidth="1.5"
                />
                <circle cx="175" cy="0" r="5" fill="rgba(2, 132, 199, 0.48)" />
                <circle cx="-128" cy="0" r="4" fill="rgba(13, 148, 136, 0.48)" />
              </g>
            </g>
          </svg>

          {/* Measured luminous light-mode contrast veil */}
          <div
            className="absolute inset-0 bg-[#F8FAFC]/80 sm:bg-transparent sm:bg-gradient-to-r sm:from-[#F8FAFC]/95 sm:via-[#F8FAFC]/86 sm:to-[#F8FAFC]/22"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/90 to-transparent"
            aria-hidden="true"
          />
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto w-full px-6 py-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-medium text-sky-800 mb-4 tracking-wide whitespace-nowrap">
              Стоматологическая студия · 09:00–20:00
            </p>

            <h1 className="text-[clamp(2.25rem,4vw,3.75rem)] font-bold tracking-tight leading-[1.08] text-slate-900 mb-6">
              Спокойная стоматология и точный выбор времени визита
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed mb-8 max-w-xl">
              Отметьте беспокоящие зубы на схеме и выберите удобное время в расписании врачей —
              заявка моментально поступит администратору клиники и в Telegram.
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onBookClick}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              >
                <span>Подобрать время приёма</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onMapClick}
                className="inline-flex items-center px-5 py-3.5 text-sm font-medium text-slate-800 bg-white/90 hover:bg-white border border-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Карта зубов
              </button>

              {mapEnabled && (
                <button
                  type="button"
                  onClick={onLocationClick}
                  className="inline-flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium text-sky-900 bg-sky-50/90 hover:bg-sky-100/90 border border-sky-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <MapPin className="w-4 h-4 text-sky-700" aria-hidden="true" />
                  <span>Маршрут до клиники</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width 4-column clinic proof strip directly below hero */}
      <div className="bg-white/85 backdrop-blur-xs border-t border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <div>
            <p className="text-xs text-slate-500 mb-1">01. Оснащение</p>
            <p className="text-sm font-semibold text-slate-900">
              Лечение под микроскопом Leica и 3D-сканер
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">02. Календарь врачей</p>
            <p className="text-sm font-semibold text-slate-900">
              Выбор конкретного специалиста или любого окна
            </p>
          </div>
          {mapEnabled ? (
            <div>
              <p className="text-xs text-slate-500 mb-1">03. Карта проезда</p>
              <p className="text-sm font-semibold text-slate-900">
                Интерактивная карта и построение маршрута
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-1">03. Карта зубов</p>
              <p className="text-sm font-semibold text-slate-900">
                Мультивыбор зон и ориентиров приёма
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">04. Уведомление клиники</p>
            <p className="text-sm font-semibold text-slate-900">
              Моментальная передача заявки в Telegram
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
