import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Appointment,
  AppointmentStatus,
  BookedSlot,
  ClinicLocation,
  Doctor,
} from '../types/clinic';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInBossWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutBoss(): Promise<void> {
  await signOut(auth);
}

export function subscribePublicDoctors(
  onUpdate: (doctors: Doctor[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'doctors';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const list: Doctor[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          name: String(data.name || ''),
          role: String(data.role || ''),
          experience: String(data.experience || ''),
          cabinet: String(data.cabinet || ''),
          bio: String(data.bio || ''),
          imageUrl: String(data.imageUrl || ''),
          availableDays: Array.isArray(data.availableDays) ? data.availableDays : [],
          timeSlots: Array.isArray(data.timeSlots) ? data.timeSlots : [],
          dateOverrides:
            data.dateOverrides && typeof data.dateOverrides === 'object'
              ? (data.dateOverrides as Record<string, string[]>)
              : {},
        };
      });
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribePublicBookedSlots(
  onUpdate: (slots: BookedSlot[]) => void
): Unsubscribe {
  const path = 'bookedSlots';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const slots: BookedSlot[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          slotId: d.id,
          doctorId: String(data.doctorId || ''),
          date: String(data.date || ''),
          time: String(data.time || ''),
          appointmentId: String(data.appointmentId || ''),
        };
      });
      onUpdate(slots);
    },
    (error) => {
      console.warn('Booked slots subscription warning:', error.message);
    }
  );
}

export async function createAppointmentInFirestore(payload: {
  appointmentId: string;
  slotId: string;
  firstName: string;
  lastName: string;
  phone: string;
  requestDetails: string;
  toothZone: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  telegramSent: boolean;
  telegramPreview: string;
}): Promise<void> {
  const batch = writeBatch(db);
  const aptRef = doc(db, 'appointments', payload.appointmentId);
  const slotRef = doc(db, 'bookedSlots', payload.slotId);

  batch.set(slotRef, {
    doctorId: payload.doctorId,
    date: payload.date,
    time: payload.time,
    appointmentId: payload.appointmentId,
    createdAt: serverTimestamp(),
  });

  batch.set(aptRef, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    requestDetails: payload.requestDetails,
    toothZone: payload.toothZone,
    doctorId: payload.doctorId,
    doctorName: payload.doctorName,
    date: payload.date,
    time: payload.time,
    slotId: payload.slotId,
    status: 'new',
    telegramSent: payload.telegramSent,
    telegramPreview: payload.telegramPreview,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    console.warn('Firestore appointment sync note:', error);
  }
}

export function subscribeBossAppointments(
  onUpdate: (appointments: Appointment[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'appointments';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Appointment[] = snapshot.docs.map((d) => {
        const data = d.data();
        const createdTs = data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString();
        const updatedTs = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : createdTs;
        return {
          id: d.id,
          firstName: String(data.firstName || ''),
          lastName: String(data.lastName || ''),
          phone: String(data.phone || ''),
          requestDetails: String(data.requestDetails || ''),
          toothZone: String(data.toothZone || ''),
          doctorId: String(data.doctorId || ''),
          doctorName: String(data.doctorName || ''),
          date: String(data.date || ''),
          time: String(data.time || ''),
          slotId: String(data.slotId || ''),
          status: (data.status as AppointmentStatus) || 'new',
          telegramSent: Boolean(data.telegramSent),
          telegramPreview: String(data.telegramPreview || ''),
          createdAtIso: createdTs,
          updatedAtIso: updatedTs,
        };
      });
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formatted) {
        onError(formatted instanceof Error ? formatted : new Error(String(formatted)));
      }
    }
  );
}

export async function updateFirestoreAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<void> {
  const path = `appointments/${appointmentId}`;
  try {
    await updateDoc(doc(db, 'appointments', appointmentId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreAppointment(
  appointmentId: string,
  slotId?: string
): Promise<void> {
  const path = `appointments/${appointmentId}`;
  try {
    await deleteDoc(doc(db, 'appointments', appointmentId));
    if (slotId) {
      await deleteDoc(doc(db, 'bookedSlots', slotId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllFirestoreData(): Promise<void> {
  try {
    const aptSnap = await getDocs(collection(db, 'appointments'));
    const slotSnap = await getDocs(collection(db, 'bookedSlots'));
    const batch = writeBatch(db);
    aptSnap.docs.forEach((d) => batch.delete(d.ref));
    slotSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'appointments');
  }
}

export async function saveDoctorToFirestore(doctor: Doctor): Promise<void> {
  const path = `doctors/${doctor.id}`;
  try {
    await setDoc(doc(db, 'doctors', doctor.id), {
      ...doctor,
      dateOverrides: doctor.dateOverrides || {},
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePublicClinicLocation(
  onUpdate: (location: ClinicLocation | null) => void
): Unsubscribe {
  const ref = doc(db, 'clinicSettings', 'location');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const data = snapshot.data();
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
        onUpdate(null);
        return;
      }
      onUpdate({
        name: String(data.name || 'Стоматология «Люмен Дент»'),
        address: String(data.address || ''),
        searchQuery: String(data.searchQuery || ''),
        placeId: data.placeId ? String(data.placeId) : undefined,
        lat: data.lat,
        lng: data.lng,
        workingHoursNote: String(data.workingHoursNote || 'Ежедневно 09:00–20:00'),
      });
    },
    (error) => {
      console.warn('Clinic location subscription warning:', error.message);
    }
  );
}

export async function saveClinicLocationToFirestore(location: ClinicLocation): Promise<void> {
  const path = 'clinicSettings/location';
  try {
    const payload: Record<string, unknown> = {
      name: location.name.slice(0, 120),
      address: location.address.slice(0, 240),
      searchQuery: (location.searchQuery || '').slice(0, 200),
      lat: location.lat,
      lng: location.lng,
      workingHoursNote: location.workingHoursNote.slice(0, 160),
      updatedAt: serverTimestamp(),
    };
    if (location.placeId) {
      payload.placeId = location.placeId.slice(0, 160);
    }
    await setDoc(doc(db, 'clinicSettings', 'location'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteClinicLocationFromFirestore(): Promise<void> {
  const path = 'clinicSettings/location';
  try {
    await deleteDoc(doc(db, 'clinicSettings', 'location'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribePublicMapEnabled(
  onUpdate: (mapEnabled: boolean) => void
): Unsubscribe {
  const ref = doc(db, 'clinicDisplay', 'settings');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }
      const data = snapshot.data();
      if (typeof data.mapEnabled === 'boolean') {
        onUpdate(data.mapEnabled);
      }
    },
    (error) => {
      console.warn('Clinic display subscription warning:', error.message);
    }
  );
}

export async function saveMapEnabledToFirestore(mapEnabled: boolean): Promise<void> {
  const path = 'clinicDisplay/settings';
  try {
    await setDoc(doc(db, 'clinicDisplay', 'settings'), {
      mapEnabled: Boolean(mapEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
