# Security Specifications for Aura Hotel PMS Backend

This document specifies the Data Invariants and the pentesting payloads ("Dirty Dozen") designed to attempt privilege escalation, unauthorized reads, state bypasses, and type poisoning on our Cloud Firestore backend.

## 1. Data Invariants

1. **User Identity Security**: Users should only edit their own profile fields. They cannot modify critical RBAC properties: `rol` or `hotelId` or `estado`.
2. **Hotel Integrity**: Only `super_admin` role can create, modify, or delete a `Hotel` document. `hotel_admin` can only edit details of their linked hotel. No receptionist or guest client can alter any hotel.
3. **Room Suite Integrity**: Only `super_admin` or a `hotel_admin` with matching `hotelId` can create or modify room suites. Guest clients have strictly read-only access.
4. **Reservation Authority**:
   - Guest client can only create reservations matching their own user ID (`guestId`).
   - Guest clients can cancel reservations they own (state updates strictly restricted to `cancelada` of their own booking).
   - Receptionists can manage check-ins (`estado`: `ocupada`) or check-outs (`estado`: `finalizada`) for rooms in their associated hotel.
   - Any state change requires maintaining exact monetary invariants and QR validation logic.
5. **Logs Immutable**: Audit logs are strictly append-only. Only signed-in actors can log, and no user can delete or update existing log history.
6. **Temporal Strictness**: Document creations and mutations must bind `createdAt` and `updatedAt` directly to `request.time` (Server Timestamp) rather than client-provided fields.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 payloads attempt to violate security boundaries and must be blocked by `firestore.rules` (yielding `PERMISSION_DENIED` errors):

### Payload 1: Self-Signed Role Escalation (Identity Spoofing)
* **Goal**: A standard `cliente` tries to register or update their roles to `super_admin`.
* **Payload**: 
  ```json
  { "id": "attacker-id", "rol": "super_admin", "nombre": "Malicious", "apellido": "User" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Normal users cannot write keys representing RBAC values).

### Payload 2: Hostage Hotel Modification (Integrity Leak)
* **Goal**: A `recepcionista` tries to update the contact details or coordinates of a hotel they are not associated with.
* **Payload**:
  ```json
  { "id": "hotel-paris", "contacto": { "telefono": "666-attacker-ph", "email": "evil@hacker.com" } }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Only super admins or linked hotel admins can modify hotel data).

### Payload 3: Client Booking for Someone Else (Identity Spoofing)
* **Goal**: Guest client attempts to create a reservation with a `guestId` representing another user's account.
* **Payload**:
  ```json
  { "id": "evil-res", "hotelId": "hotel-madrid", "roomId": "room-1", "guestId": "target-victim-uid", "estado": "pendiente" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (The `guestId` in reservation must match `request.auth.uid`).

### Payload 4: Invalid State Switch (State Shortcutting)
* **Goal**: A client tries to bypass the checking states and confirm their own booking as `ocupada` or `finalizada` to get free nights.
* **Payload**:
  ```json
  { "id": "res-1234", "estado": "ocupada" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Only receptionists or hotel/super admins can check-in or complete stays).

### Payload 5: Room Rate Tampering (Value Poisoning)
* **Goal**: Client creates a room in their favor with `precio: 0.01` or attempts to change the rate of an existing luxury suite.
* **Payload**:
  ```json
  { "id": "room-royal", "precio": 0.01, "numero": "101", "hotelId": "hotel-mexico-1" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Room rates cannot be altered by guests/anonymous; only admins).

### Payload 6: Deleting Global Audit Logs (History Erasure)
* **Goal**: A rogue actor deletes an activity log to hide suspicious operations they performed.
* **Path**: `/logs/log-suspicious-hash`
* **Expected Result**: **PERMISSION_DENIED** (Activity logs are read/write, but never delete/update).

### Payload 7: Client Spying (PII Data Scraping)
* **Goal**: Client queries the profile of other clients without authorization.
* **Path**: `/users/another-client-uid`
* **Expected Result**: **PERMISSION_DENIED** (Client profiles have PII and can only be read by themselves, or admins/receptionists managing reservations).

### Payload 8: Future Check-in Poisoning (Temporal Guard)
* **Goal**: A guest client registers a reservation setting `fechaRegistro` as a handtyped future client date, tampering with stay histories.
* **Payload**:
  ```json
  { "id": "res-9", "fechaRegistro": "2100-01-01" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Timestamp must match server time or strict date invariants).

### Payload 9: Invisible Field Injection (Ghost Field Vulnerability)
* **Goal**: A user profile update includes a ghost attribute `isVerified: true` which is not in our defined schema.
* **Payload**:
  ```json
  { "id": "user-client-1", "nombre": "Ana", "apellido": "Gomez", "isVerified": true }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Strict schema properties checks and hasOnly keys block extra/unregistered fields).

### Payload 10: Anonymous Room Maintenance Hack (Resource Denial)
* **Goal**: Unauthenticated user tries to mark all rooms as `mantenimiento` to block booking availability.
* **Payload**:
  ```json
  { "id": "room-101", "estado": "mantenimiento" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Must be authenticated and have valid Admin/Reception role for room state changes).

### Payload 11: Hotel Account Bypass (Cross-Tenant Hijacking)
* **Goal**: Admin of Hotel A attempts to delete or modify a room belonging to Hotel B to damage their inventory and competition.
* **Payload**:
  ```json
  { "id": "room-hotel-b-1", "hotelId": "hotel-b", "numero": "101", "estado": "mantenimiento" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Role authority and hotel ID bounds must match the target room's hotel ID).

### Payload 12: Booking Currency Manipulation (Value Poisoning)
* **Goal**: Client books a stay keeping `subtotal: -500` or arbitrary negative values to drain payouts.
* **Payload**:
  ```json
  { "id": "res-90", "total": -500, "guestId": "my-uid" }
  ```
* **Expected Result**: **PERMISSION_DENIED** (Numeric types must be strictly greater than 0, verified by the blueprint schema validator).

---

## 3. Test Runner Specification

The Firestore unit tests check these invariants securely. During development, these are loaded securely across our simulation suites to verify that `firestore.rules` blocks the above operations.
