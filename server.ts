import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface StoredAppointment {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  requestDetails: string;
  toothZone: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  slotId: string;
  status: 'new' | 'confirmed' | 'completed' | 'cancelled';
  telegramSent: boolean;
  telegramPreview: string;
  telegramError?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

interface StoredBookedSlot {
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  appointmentId: string;
}

interface StoredDoctorSchedule {
  id: string;
  availableDays: string[];
  timeSlots: string[];
  dateOverrides?: Record<string, string[]>;
}

interface StoredClinicLocation {
  name: string;
  address: string;
  searchQuery: string;
  placeId?: string;
  lat: number;
  lng: number;
  workingHoursNote: string;
  updatedAtIso: string;
}

interface ClinicStore {
  appointments: StoredAppointment[];
  bookedSlots: StoredBookedSlot[];
  doctorSchedules: Record<string, StoredDoctorSchedule>;
  clinicLocation?: StoredClinicLocation | null;
  mapEnabled?: boolean;
}

const PORT = Number(process.env.PORT || 3000);
const BOSS_PIN = '1111';
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'clinic-store.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): ClinicStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const empty: ClinicStore = {
      appointments: [],
      bookedSlots: [],
      doctorSchedules: {},
      mapEnabled: true,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ClinicStore>;
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      bookedSlots: Array.isArray(parsed.bookedSlots) ? parsed.bookedSlots : [],
      doctorSchedules:
        parsed.doctorSchedules && typeof parsed.doctorSchedules === 'object'
          ? parsed.doctorSchedules
          : {},
      clinicLocation:
        parsed.clinicLocation &&
        typeof parsed.clinicLocation === 'object' &&
        typeof parsed.clinicLocation.lat === 'number' &&
        typeof parsed.clinicLocation.lng === 'number'
          ? parsed.clinicLocation
          : null,
      mapEnabled: parsed.mapEnabled !== false,
    };
  } catch {
    return {
      appointments: [],
      bookedSlots: [],
      doctorSchedules: {},
      clinicLocation: null,
      mapEnabled: true,
    };
  }
}

function writeStore(store: ClinicStore): void {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

const MONTHS_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

function formatDateRu(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const monthName = MONTHS_RU[monthIdx];
  if (!monthName || Number.isNaN(day)) return dateStr;
  return `${day} ${monthName} ${year}`;
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTelegramMessage(apt: StoredAppointment): string {
  const prettyDate = formatDateRu(apt.date);
  const lines = [
    '🦷 НОВАЯ ЗАЯВКА · «ЛЮМЕН ДЕНТ»',
    '──────────────────────',
    `👤 Пациент: ${apt.firstName} ${apt.lastName}`,
    `📞 Телефон: ${apt.phone}`,
    '',
    `🩺 Врач: ${apt.doctorName}`,
    `🗓 Приём: ${prettyDate} · ${apt.time}`,
  ];
  if (apt.toothZone) {
    lines.push(`📍 Ориентир: ${apt.toothZone}`);
  }
  lines.push('', `💬 Запрос: ${apt.requestDetails}`, '──────────────────────');
  return lines.join('\n');
}

function formatTelegramHtmlMessage(apt: StoredAppointment): string {
  const firstName = escapeTelegramHtml(apt.firstName.trim());
  const lastName = escapeTelegramHtml(apt.lastName.trim());
  const phone = escapeTelegramHtml(apt.phone.trim());
  const doctorName = escapeTelegramHtml(apt.doctorName.trim());
  const prettyDate = escapeTelegramHtml(formatDateRu(apt.date));
  const time = escapeTelegramHtml(apt.time);
  const toothZone = apt.toothZone ? escapeTelegramHtml(apt.toothZone.trim()) : '';
  const requestDetails = escapeTelegramHtml(apt.requestDetails.trim());

  const blocks = [
    '🦷 <b>НОВАЯ ЗАЯВКА · «ЛЮМЕН ДЕНТ»</b>',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `👤 <b>Пациент:</b> ${firstName} ${lastName}`,
    `📞 <b>Телефон:</b> <code>${phone}</code>`,
    '',
    `🩺 <b>Врач:</b> ${doctorName}`,
    `🗓 <b>Приём:</b> ${prettyDate} в <b>${time}</b>`,
  ];

  if (toothZone) {
    blocks.push('', `📍 <b>Зона / ориентир:</b>\n<i>${toothZone}</i>`);
  }

  blocks.push(
    '',
    `💬 <b>Запрос пациента:</b>\n<blockquote>${requestDetails}</blockquote>`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '✨ <i>Онлайн-запись · Статус: Новая заявка</i>'
  );

  return blocks.join('\n');
}

async function dispatchTelegramMessage(
  htmlText: string
): Promise<{ sent: boolean; error?: string }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!token || !chatId) {
    return {
      sent: false,
      error: 'TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в секретах окружения',
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      return { sent: false, error: `Telegram API HTTP ${response.status}: ${bodyText}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'Ошибка соединения с Telegram API',
    };
  }
}

function requireBossPin(req: Request, res: Response, next: NextFunction): void {
  const pin = req.header('x-boss-pin') || '';
  if (pin !== BOSS_PIN) {
    res.status(401).json({ error: 'Неверный код руководителя' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/public/maps-config', (_req: Request, res: Response) => {
    const apiKey = (
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    res.json({ apiKey });
  });

  app.get('/googlef62ca74dba0519d6.html', (_req: Request, res: Response) => {
    res.type('text/html; charset=utf-8').send('google-site-verification: googlef62ca74dba0519d6.html');
  });

  // Public non-PII schedule, occupied slots & clinic location for all visitors
  app.get('/api/public/state', (_req: Request, res: Response) => {
    const store = readStore();
    res.json({
      bookedSlots: store.bookedSlots,
      doctorSchedules: store.doctorSchedules,
      clinicLocation: store.clinicLocation || null,
      mapEnabled: store.mapEnabled !== false,
    });
  });

  // Patient submits a booking request
  app.post('/api/bookings', async (req: Request, res: Response) => {
    const body = req.body as Partial<StoredAppointment>;

    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const phone = String(body.phone || '').trim();
    const requestDetails = String(body.requestDetails || '').trim();
    const toothZone = String(body.toothZone || '').trim().slice(0, 120);
    const doctorId = String(body.doctorId || '').trim().slice(0, 64);
    const doctorName = String(body.doctorName || '').trim().slice(0, 100);
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const appointmentId =
      String(body.id || '').trim().slice(0, 64) ||
      `apt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const isTimeValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
    const isPhoneValid =
      /^[0-9+\-()\s]{6,32}$/.test(phone) && phone.replace(/\D/g, '').length >= 10;

    if (
      firstName.length < 2 ||
      firstName.length > 80 ||
      lastName.length < 2 ||
      lastName.length > 80 ||
      !isPhoneValid ||
      requestDetails.length < 3 ||
      requestDetails.length > 600 ||
      !doctorId ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(doctorId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !isTimeValid
    ) {
      res.status(400).json({ error: 'Проверьте корректность полей заявки' });
      return;
    }

    const slotId = `${doctorId.replace(/[^a-zA-Z0-9_-]/g, '')}__${date}__${time.replace(':', '-')}`;
    const store = readStore();

    const alreadyTaken = store.bookedSlots.some(
      (s) => s.slotId === slotId || (s.doctorId === doctorId && s.date === date && s.time === time)
    );
    if (alreadyTaken) {
      res.status(409).json({ error: 'Это время только что заняли. Выберите другое окно.' });
      return;
    }

    const nowIso = new Date().toISOString();

    const newAppointment: StoredAppointment = {
      id: appointmentId,
      firstName,
      lastName,
      phone,
      requestDetails,
      toothZone,
      doctorId,
      doctorName: doctorName || doctorId,
      date,
      time,
      slotId,
      status: 'new',
      telegramSent: false,
      telegramPreview: '',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    const preview = formatTelegramMessage(newAppointment);
    const htmlPayload = formatTelegramHtmlMessage(newAppointment);
    newAppointment.telegramPreview = preview;

    const tgResult = await dispatchTelegramMessage(htmlPayload);
    newAppointment.telegramSent = tgResult.sent;
    if (tgResult.error) {
      newAppointment.telegramError = tgResult.error;
    }

    store.appointments.unshift(newAppointment);
    store.bookedSlots.push({
      slotId,
      doctorId,
      date,
      time,
      appointmentId,
    });
    writeStore(store);

    res.status(201).json({
      ok: true,
      appointment: newAppointment,
      telegramSent: tgResult.sent,
      telegramPreview: preview,
    });
  });

  // Boss Dashboard endpoints (protected by PIN 1111)
  app.get('/api/boss/dashboard', requireBossPin, (_req: Request, res: Response) => {
    const store = readStore();
    const telegramConfigured = Boolean(
      (process.env.TELEGRAM_BOT_TOKEN || '').trim() &&
        (process.env.TELEGRAM_CHAT_ID || '').trim()
    );
    res.json({
      appointments: store.appointments,
      bookedSlots: store.bookedSlots,
      doctorSchedules: store.doctorSchedules,
      clinicLocation: store.clinicLocation || null,
      mapEnabled: store.mapEnabled !== false,
      telegramConfigured,
    });
  });

  app.patch('/api/boss/appointments/:id', requireBossPin, (req: Request, res: Response) => {
    const { id } = req.params;
    const status = String(req.body?.status || '') as StoredAppointment['status'];
    if (!['new', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Некорректный статус' });
      return;
    }

    const store = readStore();
    const apt = store.appointments.find((a) => a.id === id);
    if (!apt) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }

    apt.status = status;
    apt.updatedAtIso = new Date().toISOString();

    // Free slot if cancelled
    if (status === 'cancelled') {
      store.bookedSlots = store.bookedSlots.filter((s) => s.appointmentId !== id);
    }

    writeStore(store);
    res.json({ ok: true, appointment: apt });
  });

  app.post(
    '/api/boss/appointments/:id/telegram',
    requireBossPin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const store = readStore();
      const apt = store.appointments.find((a) => a.id === id);
      if (!apt) {
        res.status(404).json({ error: 'Заявка не найдена' });
        return;
      }

      const preview = formatTelegramMessage(apt);
      const htmlPayload = formatTelegramHtmlMessage(apt);
      const tgResult = await dispatchTelegramMessage(htmlPayload);
      apt.telegramPreview = preview;
      apt.telegramSent = tgResult.sent;
      apt.telegramError = tgResult.error;
      apt.updatedAtIso = new Date().toISOString();
      writeStore(store);

      res.json({
        ok: true,
        telegramSent: tgResult.sent,
        telegramError: tgResult.error,
        appointment: apt,
      });
    }
  );

  app.delete('/api/boss/appointments/:id', requireBossPin, (req: Request, res: Response) => {
    const { id } = req.params;
    const store = readStore();
    store.appointments = store.appointments.filter((a) => a.id !== id);
    store.bookedSlots = store.bookedSlots.filter((s) => s.appointmentId !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  app.delete('/api/boss/appointments', requireBossPin, (_req: Request, res: Response) => {
    const store = readStore();
    store.appointments = [];
    store.bookedSlots = [];
    writeStore(store);
    res.json({ ok: true });
  });

  app.put('/api/boss/doctors/:id', requireBossPin, (req: Request, res: Response) => {
    const { id } = req.params;
    const availableDays = Array.isArray(req.body?.availableDays) ? req.body.availableDays : [];
    const timeSlots = Array.isArray(req.body?.timeSlots) ? req.body.timeSlots : [];
    const rawOverrides =
      req.body?.dateOverrides && typeof req.body.dateOverrides === 'object'
        ? (req.body.dateOverrides as Record<string, unknown>)
        : {};

    if (availableDays.length === 0 || timeSlots.length === 0) {
      res.status(400).json({ error: 'Укажите хотя бы один рабочий день и одно окно приёма' });
      return;
    }

    const sanitizedOverrides: Record<string, string[]> = {};
    for (const [dateKey, slotVal] of Object.entries(rawOverrides)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      if (!Array.isArray(slotVal)) continue;
      const cleanSlots = Array.from(
        new Set(slotVal.map(String).filter((t) => /^\d{2}:\d{2}$/.test(t)))
      ).sort();
      sanitizedOverrides[dateKey] = cleanSlots;
    }

    const store = readStore();
    store.doctorSchedules[id] = {
      id,
      availableDays: availableDays.map((d: unknown) => String(d)),
      timeSlots: Array.from(new Set<string>(timeSlots.map((t: unknown) => String(t)))).sort(),
      dateOverrides: sanitizedOverrides,
    };
    writeStore(store);
    res.json({ ok: true, schedule: store.doctorSchedules[id] });
  });

  app.put('/api/boss/location', requireBossPin, (req: Request, res: Response) => {
    const name = String(req.body?.name || 'Стоматология «Люмен Дент»').trim().slice(0, 120);
    const address = String(req.body?.address || '').trim().slice(0, 240);
    const searchQuery = String(req.body?.searchQuery || address).trim().slice(0, 200);
    const placeId = req.body?.placeId ? String(req.body.placeId).trim().slice(0, 160) : undefined;
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const workingHoursNote = String(
      req.body?.workingHoursNote || 'Ежедневно 09:00–20:00 · Бесплатная парковка для пациентов'
    )
      .trim()
      .slice(0, 160);

    if (
      address.length < 3 ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({ error: 'Укажите корректный адрес и координаты клиники' });
      return;
    }

    const store = readStore();
    store.clinicLocation = {
      name,
      address,
      searchQuery,
      ...(placeId ? { placeId } : {}),
      lat,
      lng,
      workingHoursNote,
      updatedAtIso: new Date().toISOString(),
    };
    writeStore(store);
    res.json({ ok: true, clinicLocation: store.clinicLocation });
  });

  app.delete('/api/boss/location', requireBossPin, (_req: Request, res: Response) => {
    const store = readStore();
    store.clinicLocation = null;
    writeStore(store);
    res.json({ ok: true });
  });

  app.put('/api/boss/map-visibility', requireBossPin, (req: Request, res: Response) => {
    const mapEnabled = Boolean(req.body?.mapEnabled);
    const store = readStore();
    store.mapEnabled = mapEnabled;
    writeStore(store);
    res.json({ ok: true, mapEnabled });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
