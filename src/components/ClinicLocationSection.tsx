/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Car,
  Clock,
  ExternalLink,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  Route as RouteIcon,
  TrainFront,
} from 'lucide-react';
import type { ClinicLocation } from '../types/clinic';

type TravelModeKey = 'DRIVING' | 'WALKING' | 'TRANSIT';

interface ClinicPlaceState {
  id: string;
  name: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
  workingHoursNote: string;
}

interface RouteSummaryState {
  distanceKm: string;
  durationMin: number;
  modeLabel: string;
}

function isQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('OverQuotaMapError') ||
    text.includes('429')
  );
}

const TRAVEL_MODES: { key: TravelModeKey; label: string; icon: typeof Car }[] = [
  { key: 'DRIVING', label: 'На авто', icon: Car },
  { key: 'TRANSIT', label: 'Транспорт', icon: TrainFront },
  { key: 'WALKING', label: 'Пешком', icon: Footprints },
];

interface RouteOriginRequest {
  origin: google.maps.LatLngLiteral | string;
  requestId: number;
}

interface MapCanvasControllerProps {
  customClinicLocation: ClinicLocation | null;
  publicStateLoaded: boolean;
  clinicPlace: ClinicPlaceState | null;
  onPlaceResolved: (place: ClinicPlaceState) => void;
  onPlaceError: (msg: string) => void;
  routeRequest: RouteOriginRequest | null;
  travelMode: TravelModeKey;
  onRouteResult: (summary: RouteSummaryState | null, errorMsg: string) => void;
  onRouteLoadingChange: (loading: boolean) => void;
  infoOpen: boolean;
  onToggleInfo: (open: boolean) => void;
}

function MapCanvasController({
  customClinicLocation,
  publicStateLoaded,
  clinicPlace,
  onPlaceResolved,
  onPlaceError,
  routeRequest,
  travelMode,
  onRouteResult,
  onRouteLoadingChange,
  infoOpen,
  onToggleInfo,
}: MapCanvasControllerProps) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const [markerRef, marker] = useAdvancedMarkerRef();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const defaultPlaceRequestedRef = useRef(false);

  const mapRef = useRef(map);
  mapRef.current = map;

  const onPlaceResolvedRef = useRef(onPlaceResolved);
  onPlaceResolvedRef.current = onPlaceResolved;

  const onPlaceErrorRef = useRef(onPlaceError);
  onPlaceErrorRef.current = onPlaceError;

  const onRouteResultRef = useRef(onRouteResult);
  onRouteResultRef.current = onRouteResult;

  const onRouteLoadingChangeRef = useRef(onRouteLoadingChange);
  onRouteLoadingChangeRef.current = onRouteLoadingChange;

  const lastCustomKeyRef = useRef<string>('');
  const clinicCoords = clinicPlace?.location;
  const clinicLat = clinicCoords?.lat;
  const clinicLng = clinicCoords?.lng;

  // 1. Sync Boss-configured custom clinic location OR fallback to Places API (New) Text Search
  useEffect(() => {
    if (customClinicLocation) {
      const customKey = `${customClinicLocation.lat.toFixed(6)}:${customClinicLocation.lng.toFixed(6)}:${customClinicLocation.address}:${customClinicLocation.name}:${customClinicLocation.workingHoursNote}`;
      if (lastCustomKeyRef.current === customKey) {
        return;
      }
      lastCustomKeyRef.current = customKey;
      const resolved: ClinicPlaceState = {
        id: customClinicLocation.placeId || 'boss_custom_clinic',
        name: customClinicLocation.name || 'Стоматология «Люмен Дент»',
        formattedAddress: customClinicLocation.address,
        location: {
          lat: customClinicLocation.lat,
          lng: customClinicLocation.lng,
        },
        workingHoursNote:
          customClinicLocation.workingHoursNote ||
          'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов',
      };
      onPlaceResolvedRef.current(resolved);
      if (mapRef.current) {
        mapRef.current.panTo(resolved.location);
        mapRef.current.setZoom(15);
      }
      return;
    }

    lastCustomKeyRef.current = '';
    if (!publicStateLoaded || !placesLib || defaultPlaceRequestedRef.current) return;
    defaultPlaceRequestedRef.current = true;

    const searchClinic = async () => {
      try {
        const request: google.maps.places.SearchByTextRequest = {
          textQuery: 'Стоматологическая клиника Москва Тверская',
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
          maxResultCount: 1,
          language: 'ru',
          region: 'RU',
        };
        const { places } = await placesLib.Place.searchByText(request);
        const top = places?.[0];
        if (!top || !top.location) {
          onPlaceErrorRef.current('Не удалось определить локацию клиники на карте.');
          return;
        }
        const resolved: ClinicPlaceState = {
          id: top.id || 'clinic_place',
          name: `Люмен Дент (${top.displayName || 'Стоматология'})`,
          formattedAddress: top.formattedAddress || 'Адрес уточняется на карте',
          location: {
            lat: top.location.lat(),
            lng: top.location.lng(),
          },
          workingHoursNote: 'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов',
        };
        onPlaceResolvedRef.current(resolved);
        if (mapRef.current) {
          mapRef.current.panTo(resolved.location);
          mapRef.current.setZoom(15);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onPlaceErrorRef.current('Не удалось загрузить адрес клиники через Places API.');
      }
    };

    void searchClinic();
  }, [customClinicLocation, publicStateLoaded, placesLib]);

  // 2. Compute and render route via modern Routes API (Route.computeRoutes)
  useEffect(() => {
    if (!routesLib || !mapRef.current || clinicLat === undefined || clinicLng === undefined || !routeRequest) {
      return;
    }

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    onRouteLoadingChangeRef.current(true);
    onRouteResultRef.current(null, '');

    let cancelled = false;

    const compute = async () => {
      try {
        const sdkTravelMode =
          routesLib.TravelMode[travelMode as keyof typeof routesLib.TravelMode];

        const response = await routesLib.Route.computeRoutes({
          origin: routeRequest.origin,
          destination: { lat: clinicLat, lng: clinicLng },
          travelMode: sdkTravelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled) return;
        onRouteLoadingChangeRef.current(false);

        const primaryRoute = response.routes?.[0];
        if (!primaryRoute) {
          onRouteResultRef.current(
            null,
            'Маршрут от указанной точки не найден. Попробуйте другой адрес.'
          );
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((line) => {
          line.setOptions({
            strokeColor: '#0369a1',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          if (mapRef.current) {
            line.setMap(mapRef.current);
          }
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport && mapRef.current) {
          mapRef.current.fitBounds(primaryRoute.viewport);
        }

        const distanceKm = ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1);
        const durationMin = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        const modeObj = TRAVEL_MODES.find((m) => m.key === travelMode);
        onRouteResultRef.current(
          {
            distanceKm,
            durationMin,
            modeLabel: modeObj ? modeObj.label : travelMode,
          },
          ''
        );
      } catch (err) {
        if (cancelled) return;
        onRouteLoadingChangeRef.current(false);
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteResultRef.current(
          null,
          'Не удалось построить маршрут. Проверьте доступ к геолокации или адрес отправления.'
        );
      }
    };

    void compute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, clinicLat, clinicLng, routeRequest, travelMode]);

  if (!clinicPlace) return null;

  const userLatLng =
    routeRequest && typeof routeRequest.origin !== 'string' ? routeRequest.origin : null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={clinicPlace.location}
        onClick={() => onToggleInfo(true)}
        title={clinicPlace.name}
      >
        <Pin background="#0369a1" borderColor="#0c4a6e" glyphColor="#ffffff" scale={1.15} />
      </AdvancedMarker>

      {userLatLng && (
        <AdvancedMarker position={userLatLng} title="Ваше местоположение">
          <Pin background="#0f766e" borderColor="#134e4a" glyphColor="#ffffff" scale={1.0} />
        </AdvancedMarker>
      )}

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => onToggleInfo(false)}
        >
          <div className="p-1 text-slate-900">
            <p className="text-xs font-bold text-slate-900 mb-1">{clinicPlace.name}</p>
            <p className="text-[11px] text-slate-600 leading-snug">
              {clinicPlace.formattedAddress}
            </p>
            <p className="text-[11px] text-sky-700 font-medium mt-1.5">
              {clinicPlace.workingHoursNote}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface ClinicLocationSectionProps {
  clinicLocation: ClinicLocation | null;
  publicStateLoaded?: boolean;
}

export function ClinicLocationSection({
  clinicLocation,
  publicStateLoaded = true,
}: ClinicLocationSectionProps) {
  const buildTimeKey = (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();

  const [apiKey, setApiKey] = useState<string>(buildTimeKey);
  const [keyChecked, setKeyChecked] = useState<boolean>(Boolean(buildTimeKey));
  const [clinicPlace, setClinicPlace] = useState<ClinicPlaceState | null>(null);
  const [placeError, setPlaceError] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState<boolean>(true);
  const [travelMode, setTravelMode] = useState<TravelModeKey>('DRIVING');
  const [routeRequest, setRouteRequest] = useState<RouteOriginRequest | null>(null);
  const [manualOrigin, setManualOrigin] = useState<string>('');
  const [routeSummary, setRouteSummary] = useState<RouteSummaryState | null>(null);
  const [routeError, setRouteError] = useState<string>('');
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);

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

  const handlePlaceResolved = useCallback((place: ClinicPlaceState) => {
    setClinicPlace(place);
    setPlaceError('');
  }, []);

  const handlePlaceError = useCallback((msg: string) => {
    setPlaceError(msg);
  }, []);

  const handleRouteResult = useCallback((summary: RouteSummaryState | null, errMsg: string) => {
    setRouteSummary(summary);
    setRouteError(errMsg);
  }, []);

  function handleBuildRouteFromMyLocation() {
    if (geoLoading || routeLoading) return;
    setRouteError('');
    if (!navigator.geolocation) {
      setRouteError(
        'Ваш браузер не поддерживает геолокацию. Введите адрес отправления вручную ниже.'
      );
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setRouteRequest((prev) => ({
          origin: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          requestId: (prev?.requestId || 0) + 1,
        }));
      },
      () => {
        setGeoLoading(false);
        setRouteError(
          'Доступ к геолокации отклонён. Укажите адрес отправления вручную или разрешите доступ к GPS.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleBuildRouteFromManualAddress() {
    if (routeLoading) return;
    const trimmed = manualOrigin.trim();
    if (trimmed.length < 3) {
      setRouteError('Введите улицу, метро или ориентир отправления.');
      return;
    }
    setRouteError('');
    setRouteRequest((prev) => ({
      origin: trimmed,
      requestId: (prev?.requestId || 0) + 1,
    }));
  }

  const displayedAddress = clinicLocation?.address || clinicPlace?.formattedAddress || '';
  const displayedName = clinicLocation?.name || clinicPlace?.name || 'Стоматология «Люмен Дент»';
  const displayedHours =
    clinicLocation?.workingHoursNote ||
    clinicPlace?.workingHoursNote ||
    'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов';

  const destCoords = clinicLocation
    ? { lat: clinicLocation.lat, lng: clinicLocation.lng }
    : clinicPlace?.location;

  const externalMapsUrl = destCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${destCoords.lat},${destCoords.lng}`
    : 'https://www.google.com/maps/search/?api=1&query=%D0%A1%D1%82%D0%BE%D0%BC%D0%B0%D1%82%D0%BE%D0%BB%D0%BE%D0%B3%D0%B8%D1%8F';

  return (
    <section
      id="clinic-map"
      className="py-14 lg:py-20 bg-white/70 backdrop-blur-[1.5px] border-t border-slate-200/80"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-medium text-sky-700 mb-2">
            Геолокация и построение маршрута
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3">
            Расположение клиники и быстрый маршрут
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Посмотрите адрес клиники на интерактивной карте и проложите маршрут от вашего текущего
            местоположения на автомобиле, пешком или общественным транспортом.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Panel: Clinic Address Card & Route Controls */}
          <div className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                  <MapPin className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Адрес клиники</p>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{displayedName}</h3>
                  <p
                    className="text-sm text-slate-700 mt-1 leading-snug"
                    data-testid="clinic-address-text"
                  >
                    {displayedAddress
                      ? displayedAddress
                      : placeError
                      ? 'Проверьте подключение к Google Картам'
                      : 'Загружаем точный адрес клиники...'}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 font-mono-tabular">{displayedHours}</p>
                </div>
              </div>

              {/* Travel mode selector */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Способ передвижения</p>
                <div className="grid grid-cols-3 gap-2">
                  {TRAVEL_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const active = travelMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setTravelMode(mode.key)}
                        aria-pressed={active}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-sky-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Route Button (from current geolocation) */}
              <div>
                <button
                  type="button"
                  disabled={!clinicPlace || geoLoading || routeLoading}
                  onClick={handleBuildRouteFromMyLocation}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                >
                  <LocateFixed className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {geoLoading
                      ? 'Определяем ваше местоположение...'
                      : routeLoading
                      ? 'Строим маршрут...'
                      : 'Построить маршрут от меня'}
                  </span>
                </button>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Координаты запрашиваются однократно в браузере с вашего согласия только для
                  построения маршрута и не сохраняются.
                </p>
              </div>

              {/* Manual origin address fallback */}
              <div className="pt-3 border-t border-slate-200">
                <label
                  htmlFor="manual-route-origin"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Или укажите точку отправления вручную
                </label>
                <div className="flex gap-2">
                  <input
                    id="manual-route-origin"
                    type="text"
                    value={manualOrigin}
                    onChange={(e) => setManualOrigin(e.target.value)}
                    placeholder="Например: метро Маяковская"
                    className="flex-1 min-w-0 px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                  />
                  <button
                    type="button"
                    disabled={!clinicPlace || routeLoading}
                    onClick={handleBuildRouteFromManualAddress}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Проложить
                  </button>
                </div>
              </div>

              {/* Route Summary or Error */}
              {routeSummary && (
                <div
                  data-testid="route-summary-card"
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-sky-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                      <RouteIcon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        Маршрут · {routeSummary.modeLabel}
                      </p>
                      <p className="text-sm font-bold text-slate-900 font-mono-tabular">
                        {routeSummary.distanceKm} км · {routeSummary.durationMin} мин
                      </p>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                </div>
              )}

              {(routeError || placeError) && (
                <div
                  className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"
                  role="status"
                >
                  {routeError || placeError}
                </div>
              )}
            </div>

            <a
              href={externalMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-sky-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Открыть навигацию в Google Картах</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>

          {/* Right Panel: Interactive Google Map (explicit height) */}
          <div className="lg:col-span-7">
            <div
              data-testid="clinic-google-map"
              className="w-full h-[420px] lg:h-[480px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative"
            >
              {!keyChecked || !publicStateLoaded ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
                  Инициализация карты клиники...
                </div>
              ) : !apiKey ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#F8FAFC]">
                  <MapPin className="w-8 h-8 text-sky-700 mb-3" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    Интерактивная карта Google Maps
                  </p>
                  <p className="text-xs text-slate-600 max-w-md leading-relaxed mb-4">
                    Добавьте ключ Google Maps Platform в настройки секретов окружения
                    (GOOGLE_MAPS_API_KEY), чтобы отобразить живую карту и прокладку маршрута.
                  </p>
                  <a
                    href={externalMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-xl"
                  >
                    <span>Открыть в Google Картах</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              ) : (
                <APIProvider apiKey={apiKey} language="ru" region="RU">
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    defaultCenter={
                      destCoords || { lat: 55.764, lng: 37.606 }
                    }
                    defaultZoom={14}
                    gestureHandling="greedy"
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={true}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    className="w-full h-full"
                  >
                    <MapCanvasController
                      customClinicLocation={clinicLocation}
                      publicStateLoaded={publicStateLoaded}
                      clinicPlace={clinicPlace}
                      onPlaceResolved={handlePlaceResolved}
                      onPlaceError={handlePlaceError}
                      routeRequest={routeRequest}
                      travelMode={travelMode}
                      onRouteResult={handleRouteResult}
                      onRouteLoadingChange={setRouteLoading}
                      infoOpen={infoOpen}
                      onToggleInfo={setInfoOpen}
                    />
                  </GoogleMap>
                </APIProvider>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
