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

## Pickups the customer asks for

A customer accepting a quote on the portal or in the KCPL app can ask for the cargo to be
collected: a date, a window (morning, afternoon or any time, Nepal time), the address and a
contact. That request is stored on the quote's `portal_booking_request.pickup`. It creates
no appointment. When the booked shipment appears here unscheduled, its row is pre-filled
from the request (`requested_window_start`/`end`, `pickup_location`, contact name and phone,
and a `Customer: …` note), so operations start from what the customer said and still
request, confirm and assign the pickup themselves.

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
