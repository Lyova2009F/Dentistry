/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Eye, EyeOff, MapPin, RotateCcw, Save, Search } from 'lucide-react';
import type { ClinicLocation } from '../types/clinic';

interface PlaceSearchResultItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface BossMapControllerProps {
  searchTriggerQuery: string;
  searchCounter: number;
  selectedCoords: google.maps.LatLngLiteral | null;
  onSearchResults: (results: PlaceSearchResultItem[], errorMsg: string) => void;
  onSearchingChange: (searching: boolean) => void;
}

function BossMapController({
  searchTriggerQuery,
  searchCounter,
  selectedCoords,
  onSearchResults,
  onSearchingChange,
}: BossMapControllerProps) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const mapRef = useRef(map);
  mapRef.current = map;

  const onSearchResultsRef = useRef(onSearchResults);
  onSearchResultsRef.current = onSearchResults;

  const onSearchingChangeRef = useRef(onSearchingChange);
  onSearchingChangeRef.current = onSearchingChange;

  const lastExecutedCounterRef = useRef<number>(0);
  const lastPannedCoordsKeyRef = useRef<string>('');

  useEffect(() => {
    if (!selectedCoords || !map) return;
    const key = `${selectedCoords.lat.toFixed(6)},${selectedCoords.lng.toFixed(6)}`;
    if (lastPannedCoordsKeyRef.current === key) return;
    lastPannedCoordsKeyRef.current = key;
    map.panTo(selectedCoords);
    map.setZoom(15);
  }, [selectedCoords, map]);

  useEffect(() => {
    const trimmed = searchTriggerQuery.trim();
    if (
      !placesLib ||
      !trimmed ||
      searchCounter === 0 ||
      lastExecutedCounterRef.current === searchCounter
    ) {
      return;
    }

    lastExecutedCounterRef.current = searchCounter;
    let cancelled = false;
    onSearchingChangeRef.current(true);

    const runSearch = async () => {
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: trimmed,
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
          maxResultCount: 5,
          language: 'ru',
          region: 'RU',
        });
        if (cancelled) return;
        onSearchingChangeRef.current(false);

        const mapped: PlaceSearchResultItem[] = (places || [])
          .filter((p) => p.location)
          .map((p) => ({
            id: p.id || `place_${Math.random().toString(36).slice(2, 8)}`,
            name: p.displayName || 'Стоматология «Люмен Дент»',
            address: p.formattedAddress || trimmed,
            lat: p.location!.lat(),
            lng: p.location!.lng(),
          }));

        if (mapped.length === 0) {
          onSearchResultsRef.current(
            [],
            'По этому запросу адрес не найден. Уточните улицу и город.'
          );
          return;
        }

        onSearchResultsRef.current(mapped, '');
        if (mapRef.current) {
          const firstCoords = { lat: mapped[0].lat, lng: mapped[0].lng };
          lastPannedCoordsKeyRef.current = `${firstCoords.lat.toFixed(6)},${firstCoords.lng.toFixed(6)}`;
          mapRef.current.panTo(firstCoords);
          mapRef.current.setZoom(15);
        }
      } catch (err) {
        if (cancelled) return;
        onSearchingChangeRef.current(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          onSearchResultsRef.current(
            [],
            'Превышен дневной лимит поиска Google Places. Вы можете кликнуть прямо по карте справа, чтобы поставить точку клиники.'
          );
          return;
        }
        onSearchResultsRef.current([], 'Не удалось выполнить поиск адреса через Google Places.');
      }
    };

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [placesLib, searchTriggerQuery, searchCounter]);

  if (!selectedCoords) return null;

  return (
    <AdvancedMarker position={selectedCoords} title="Выбранная точка клиники">
      <Pin background="#0369a1" borderColor="#0c4a6e" glyphColor="#ffffff" scale={1.2} />
    </AdvancedMarker>
  );
}

interface BossLocationTabProps {
  clinicLocation: ClinicLocation | null;
  mapEnabled: boolean;
  onToggleMapEnabled: (enabled: boolean) => Promise<void>;
  onSaveLocation: (loc: ClinicLocation) => Promise<void>;
  onResetLocation: () => Promise<void>;
  onFeedback: (msg: string) => void;
}

export function BossLocationTab({
  clinicLocation,
  mapEnabled,
  onToggleMapEnabled,
  onSaveLocation,
  onResetLocation,
  onFeedback,
}: BossLocationTabProps) {
  const buildTimeKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();

  const [apiKey, setApiKey] = useState<string>(buildTimeKey);
  const [keyChecked, setKeyChecked] = useState<boolean>(Boolean(buildTimeKey));

  const [searchQuery, setSearchQuery] = useState<string>(
    clinicLocation?.searchQuery || clinicLocation?.address || ''
  );
  const [triggerQuery, setTriggerQuery] = useState<string>('');
  const [searchCounter, setSearchCounter] = useState<number>(0);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [results, setResults] = useState<PlaceSearchResultItem[]>([]);

  const [clinicName, setClinicName] = useState<string>(
    clinicLocation?.name || 'Стоматология «Люмен Дент»'
  );
  const [clinicAddress, setClinicAddress] = useState<string>(
    clinicLocation?.address || ''
  );
  const [workingHours, setWorkingHours] = useState<string>(
    clinicLocation?.workingHoursNote ||
      'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов'
  );
  const [placeId, setPlaceId] = useState<string | undefined>(clinicLocation?.placeId);
  const [coords, setCoords] = useState<google.maps.LatLngLiteral | null>(
    clinicLocation ? { lat: clinicLocation.lat, lng: clinicLocation.lng } : null
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [togglingMap, setTogglingMap] = useState<boolean>(false);

  useEffect(() => {
    if (buildTimeKey) return;
    let active = true;
    fetch('/api/public/maps-config')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data) => {
        if (!active) return;
        if (typeof data.apiKey === 'string' && data.apiKey.trim()) {
          setApiKey(data.apiKey.trim());
        }
        setKeyChecked(true);
      })
      .catch(() => {
        if (active) setKeyChecked(true);
      });
    return () => {
      active = false;
    };
  }, [buildTimeKey]);

  function handleRunSearch() {
    if (searching) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchError('Введите город, улицу или название клиники (от 3 символов).');
      return;
    }
    setSearchError('');
    setTriggerQuery(trimmed);
    setSearchCounter((c) => c + 1);
  }

  const handleSelectPlaceResult = useCallback((item: PlaceSearchResultItem) => {
    setClinicAddress(item.address);
    setPlaceId(item.id);
    setCoords({ lat: item.lat, lng: item.lng });
  }, []);

  const handleSearchResults = useCallback(
    (res: PlaceSearchResultItem[], err: string) => {
      setResults(res);
      setSearchError(err);
      if (res.length > 0) {
        handleSelectPlaceResult(res[0]);
      }
    },
    [handleSelectPlaceResult]
  );

  async function handleMapVisibilityChange(nextEnabled: boolean) {
    if (togglingMap || nextEnabled === mapEnabled) return;
    setTogglingMap(true);
    try {
      await onToggleMapEnabled(nextEnabled);
      onFeedback(
        nextEnabled
          ? 'Карта клиники включена и отображается пациентам на сайте.'
          : 'Карта скрыта со страницы — пациенты увидят только запись и услуги.'
      );
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Не удалось изменить видимость карты.'
      );
    } finally {
      setTogglingMap(false);
    }
  }

  async function handleSave() {
    if (clinicAddress.trim().length < 3 || !coords) {
      setSearchError(
        'Найдите адрес через поиск или отметьте точку на карте перед сохранением.'
      );
      return;
    }
    setSearchError('');
    setSaving(true);
    try {
      await onSaveLocation({
        name: clinicName.trim() || 'Стоматология «Люмен Дент»',
        address: clinicAddress.trim(),
        searchQuery: searchQuery.trim() || clinicAddress.trim(),
        placeId,
        lat: coords.lat,
        lng: coords.lng,
        workingHoursNote:
          workingHours.trim() || 'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов',
      });
      onFeedback(`Новое местоположение клиники сохранено: ${clinicAddress.trim()}`);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Не удалось сохранить местоположение клиники.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setSearchError('');
    try {
      await onResetLocation();
      setClinicName('Стоматология «Люмен Дент»');
      setClinicAddress('');
      setSearchQuery('');
      setCoords(null);
      setPlaceId(undefined);
      setResults([]);
      onFeedback('Местоположение клиники сброшено на поиск по умолчанию.');
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Не удалось сбросить местоположение.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="boss-location-tab"
      className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
    >
      {/* Map visibility switch card */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Отображение карты на сайте для пациентов
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {mapEnabled
              ? 'Сейчас блок «Расположение клиники» и кнопка маршрута показаны на сайте.'
              : 'Сейчас карта полностью скрыта с главной страницы сайта.'}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shrink-0">
          <button
            type="button"
            disabled={togglingMap}
            data-testid="boss-map-show-btn"
            aria-pressed={mapEnabled}
            onClick={() => void handleMapVisibilityChange(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              mapEnabled
                ? 'bg-sky-700 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Оставить карту</span>
          </button>
          <button
            type="button"
            disabled={togglingMap}
            data-testid="boss-map-hide-btn"
            aria-pressed={!mapEnabled}
            onClick={() => void handleMapVisibilityChange(false)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              !mapEnabled
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Убрать карту</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Местоположение клиники на карте Google Maps
          </h3>
          <p className="text-xs text-slate-600">
            Найдите нужный адрес через Google Карты или кликните прямо по карте — точка сразу
            обновится для всех пациентов и при построении маршрута.
          </p>
        </div>

        {clinicLocation && (
          <button
            type="button"
            disabled={saving}
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Сбросить по умолчанию</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Search & Location Form */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <label
              htmlFor="boss-location-search"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Поиск адреса или филиала через Google Maps
            </label>
            <div className="flex gap-2">
              <input
                id="boss-location-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRunSearch();
                  }
                }}
                placeholder="Например: Москва, Новый Арбат 15"
                className="flex-1 min-w-0 px-3.5 py-2.5 text-xs text-slate-900 bg-[#F8FAFC] border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
              />
              <button
                type="button"
                disabled={searching || !apiKey}
                onClick={handleRunSearch}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{searching ? 'Поиск...' : 'Найти'}</span>
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="space-y-2" data-testid="boss-location-results">
              <p className="text-[11px] font-semibold text-slate-500">
                Найденные варианты (нажмите, чтобы выбрать):
              </p>
              {results.map((item) => {
                const isSelected =
                  coords &&
                  Math.abs(coords.lat - item.lat) < 0.0001 &&
                  Math.abs(coords.lng - item.lng) < 0.0001;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPlaceResult(item)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                      isSelected
                        ? 'bg-sky-50 border-sky-600 text-slate-900'
                        : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:border-sky-500'
                    }`}
                  >
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-slate-600 mt-0.5">{item.address}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <label
              htmlFor="boss-clinic-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Название клиники на карте
            </label>
            <input
              id="boss-clinic-name"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="boss-clinic-address"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Отображаемый адрес для пациентов
            </label>
            <input
              id="boss-clinic-address"
              type="text"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              placeholder="Выберите адрес из поиска или кликните на карту"
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="boss-clinic-hours"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Режим работы и парковка
            </label>
            <input
              id="boss-clinic-hours"
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
            />
          </div>

          {coords && (
            <p className="text-[11px] font-mono-tabular text-slate-500">
              Координаты точки: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}

          {searchError && (
            <p className="text-xs text-rose-600" role="alert">
              {searchError}
            </p>
          )}

          <button
            type="button"
            disabled={saving || !coords || clinicAddress.trim().length < 3}
            onClick={handleSave}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Сохраняем...' : 'Сохранить местоположение клиники'}</span>
          </button>
        </div>

        {/* Right: Interactive Clickable Google Map Picker */}
        <div className="lg:col-span-7">
          <div
            data-testid="boss-location-map"
            className="w-full h-[380px] lg:h-[430px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative"
          >
            {!keyChecked ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                Загрузка карты...
              </div>
            ) : !apiKey ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#F8FAFC]">
                <MapPin className="w-7 h-7 text-sky-700 mb-2" aria-hidden="true" />
                <p className="text-xs text-slate-600">
                  Подключите Google Maps API key, чтобы выбирать точку прямо на карте.
                </p>
              </div>
            ) : (
              <APIProvider apiKey={apiKey} language="ru" region="RU">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={coords || { lat: 55.7558, lng: 37.6173 }}
                  defaultZoom={coords ? 15 : 12}
                  gestureHandling="greedy"
                  mapTypeControl={false}
                  streetViewControl={false}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  onClick={(e) => {
                    if (e.detail.latLng) {
                      setCoords({
                        lat: e.detail.latLng.lat,
                        lng: e.detail.latLng.lng,
                      });
                      if (!clinicAddress.trim() || clinicAddress.startsWith('Выбранная точка (')) {
                        setClinicAddress(
                          `Выбранная точка (${e.detail.latLng.lat.toFixed(4)}, ${e.detail.latLng.lng.toFixed(4)})`
                        );
                      }
                    }
                  }}
                  className="w-full h-full"
                >
                  <BossMapController
                    searchTriggerQuery={triggerQuery}
                    searchCounter={searchCounter}
                    selectedCoords={coords}
                    onSearchResults={handleSearchResults}
                    onSearchingChange={setSearching}
                  />
                </GoogleMap>
              </APIProvider>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Подсказка: нажмите на любую точку карты, чтобы точно поставить маркер входа в клинику.
          </p>
        </div>
      </div>
    </div>
  );
}
