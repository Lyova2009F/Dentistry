# Security Specification — Люмен Дент (Firestore Rules TDD)

## 1. Data Invariants
1. **PII Isolation**: Patient names (`firstName`, `lastName`), phone numbers (`phone`), and complaint descriptions (`requestDetails`) stored in `/appointments/{appointmentId}` are NEVER publicly readable or listable. Only verified clinic administrators (`isAdmin()`) may `get`, `list`, `update`, or `delete` `/appointments`.
2. **Non-PII Slot Locking & Atomicity**: `/bookedSlots/{slotId}` contains zero PII (`doctorId`, `date`, `time`, `appointmentId`, `createdAt`) and can only be created atomically alongside a matching `/appointments/{appointmentId}` document via `existsAfter()`. Double-booking an existing `slotId` is blocked via `!exists()`.
3. **Strict Schema & No Shadow Fields**: Every `create` enforces exact `keys().hasAll(...) && keys().hasOnly(...)`, strict types, `.size()` bounds on all strings and lists (including optional `dateOverrides` map bounded to 90 dates on `/doctors`), and regex patterns on IDs, dates, times, and phone numbers.
4. **Immutable Audit Fields & Server Timestamps**: `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update.
5. **Email Spoofing Protection**: Admin access verifies both `request.auth != null` and `request.auth.token.email_verified == true`.

## 2. "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: Unauthenticated client calls `getDocs(collection(db, 'appointments'))` -> DENIED (`allow list: if isAdmin()`).
2. **Authenticated Non-Admin PII Read**: Non-admin signed-in user calls `getDoc(doc(db, 'appointments', 'apt_1'))` -> DENIED (`isAdmin()` false).
3. **Unverified Admin Email Spoof**: Signed-in user with `email: 'l.zoroglyan@gmail.com'` and `email_verified: false` reads `/appointments` -> DENIED (`request.auth.token.email_verified == true` required).
4. **Shadow Field Injection on Appointment Create**: Patient sends `{ ...validAppointment, isAdmin: true }` -> DENIED (`keys().hasOnly(...)`).
5. **Status Bypass on Appointment Create**: Patient sends `{ ...validAppointment, status: 'confirmed' }` -> DENIED (`incoming().status == 'new'`).
6. **Orphaned Appointment Without Slot Lock**: Patient creates `/appointments/apt_1` without creating `/bookedSlots/{slotId}` in the same atomic batch -> DENIED (`existsAfter(...)` fails).
7. **Orphaned Slot Lock Without Appointment**: Attacker creates `/bookedSlots/slot_1` without creating `/appointments/{appointmentId}` -> DENIED (`existsAfter(...)` fails).
8. **Double-Booking Overwrite**: Attacker tries to overwrite an existing `/bookedSlots/{slotId}` -> DENIED (`!exists(...)` fails).
9. **ID Poisoning (Denial of Wallet)**: Attacker passes a 500-char or `../` document ID to `/appointments/{id}` -> DENIED (`isValidId()` fails).
10. **Oversized String Payload**: Patient sends 2,000-char `requestDetails` or 500-char `firstName` -> DENIED (`.size() <= 600` / `<= 80`).
11. **Client Timestamp Spoofing**: Patient sends a custom past `createdAt` instead of `serverTimestamp()` -> DENIED (`incoming().createdAt == request.time`).
12. **Unauthorized Schedule or Location Tampering**: Non-admin tries to update `/doctors/dr_1`, `/clinicSettings/location`, or `/clinicDisplay/settings` -> DENIED (`allow create, update, delete: if isAdmin()`).
13. **Public Clinic Location & Display Read**: Unauthenticated visitor reads `/clinicSettings/location` (`lat`, `lng`, `address`) or `/clinicDisplay/settings` (`mapEnabled`) -> ALLOWED (zero PII, strictly validated coordinate ranges `-90..90` / `-180..180` and boolean flag).

