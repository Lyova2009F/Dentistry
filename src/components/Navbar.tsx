interface NavbarProps {
  mapEnabled: boolean;
  bookingAnchorHref: string;
  onBrandTap: () => void;
  onBookClick: () => void;
}

export function Navbar({
  mapEnabled,
  bookingAnchorHref,
  onBrandTap,
  onBookClick,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Single-element Brand Wordmark (invisible 3-tap Boss trigger) */}
        <button
          type="button"
          onClick={onBrandTap}
          aria-label="Люмен Дент"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 select-none"
        >
          Люмен Дент
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Основная навигация"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#services"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Услуги
          </a>
          <a
            href="#dental-map"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Карта зубов
          </a>
          <a
            href="#booking"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Врачи
          </a>
          {mapEnabled && (
            <a
              href="#clinic-map"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Как добраться
            </a>
          )}
          <a
            href={bookingAnchorHref}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Запись
          </a>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onBookClick}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            Записаться на приём
          </button>
        </div>
      </div>
    </header>
  );
}
