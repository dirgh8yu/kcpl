# Operations Overview reference-parity milestone

The supplied Operations Overview dashboard image is the visual and capability source of truth for `/admin/command-centre`.

Implementation rules for this milestone:

- Use the horizontal search / branch / notification / staff chrome shown by the reference instead of the normal left navigation shell on Overview only.
- Use near-white canvas, white working cards, quiet borders and Inter typography.
- All primary Overview actions use black. KCPL crimson remains a brand token and is not used as an error colour.
- Error and critical states use a distinct semantic red.
- The Overview must expose the reference capabilities from real KCPL data: six operational metrics, attention register, Today queue, shipment workload, live movement network, recent activity, finance snapshot and operational notes.
- New shipment starts the existing controlled planning / tender / booking authority rather than writing a shipment around server policy.
- Live movement represents real visibility records and routes. It must not invent GPS positions.
- Financial values remain currency-safe. No blended grand total is shown without an authoritative FX conversion policy.
- Branch selection scopes server reads and never weakens staff access.
- Shipment priority, blockers, next actions, return context, RBAC and server mutations remain authoritative.
