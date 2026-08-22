# KCPL Pickup & Appointment Scheduling

Pickup Scheduling closes the execution gap between a confirmed TMS booking and the first physical cargo movement.

## Operational flow

1. Tender/Booking confirms a carrier or counterpart.
2. The booked shipment automatically appears in `/admin/pickups`, even if no pickup appointment exists yet.
3. Operations requests a pickup window and records the shipper/vendor contact and location.
4. The carrier/vendor confirms an appointment and may provide a provider reference.
5. Operations can assign driver, phone and vehicle details.
6. `Cargo picked up` writes the same `picked_up` milestone into Live Visibility.
7. A missed pickup writes a carrier exception into Live Visibility/Job File exception handling and remains visible for rescheduling.

## Firebase data

- `pickup_appointments/{PU-<shipment-reference>}` stores the current appointment snapshot.
- `pickup_appointments/{id}/events` stores appointment lifecycle events.
- Shipment root fields mirror the current pickup state for fast operational reads.
- Shipment `job_activity` receives each staff pickup action.
- The existing tracking engine remains the source of truth for movement milestones after pickup.

## Custom GPT

`GET /api/gpt/pickups` is read-only and exposes pickup workload and attention records. It never schedules, confirms, assigns a driver, marks pickup complete or cancels an appointment.

## Security

Human writes use the authenticated KCPL staff session, same-origin enforcement, branch access and `canManageJobFile`. The Custom GPT receives only read-only pickup intelligence through the existing protected GPT gateway.
