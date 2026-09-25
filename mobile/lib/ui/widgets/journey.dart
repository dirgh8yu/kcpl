import 'package:flutter/material.dart';

import '../theme.dart';

/// Where a shipment is on its way: booked, moving, customs, out for
/// delivery, delivered. An exception keeps the stage it was reached at; the
/// status line says what went wrong.
int journeyStage(String status) => switch (status) {
  'in_transit' || 'exception' => 1,
  'customs_clearance' => 2,
  'out_for_delivery' => 3,
  'delivered' => 4,
  _ => 0,
};

const journeyStageCount = 5;

/// Fraction of the bar filled. A booked shipment shows a sliver, not
/// nothing, so it reads as started.
double journeyFraction(String status) {
  final stage = journeyStage(status);
  return stage == 0 ? 0.04 : stage / (journeyStageCount - 1);
}

IconData modeIcon(String mode) => switch (mode) {
  'air' => KIcons.air,
  'sea' || 'ocean' => KIcons.sea,
  'road' => KIcons.road,
  'rail' => KIcons.rail,
  'courier' => KIcons.courier,
  _ => KIcons.route,
};

/// The same, solid, for the cargo's marker on a map.
IconData modeSolidIcon(String mode) => switch (mode) {
  'air' => KIcons.airSolid,
  'sea' || 'ocean' => KIcons.seaSolid,
  'road' => KIcons.roadSolid,
  'rail' => KIcons.railSolid,
  _ => KIcons.courierSolid,
};

/// The journey as a slim capsule, filled in ink up to where the cargo is
/// (crimson when the journey has gone wrong). It is drawn where it stands:
/// progress is data, and data does not animate for style.
class JourneyBar extends StatelessWidget {
  const JourneyBar({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fill = status == 'exception' ? p.accent : p.ink;
    return Semantics(
      value: '${journeyStage(status) + 1} / $journeyStageCount',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: SizedBox(
          height: 3,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: (journeyFraction(status) * 1000).round(),
                child: ColoredBox(color: fill),
              ),
              Expanded(
                flex: ((1 - journeyFraction(status)) * 1000).round(),
                child: ColoredBox(color: p.fill),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A symbol at the start of a row: grey, crimson for trouble, fainter for
/// anything already dealt with.
class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, this.attention = false, this.muted = false});
  final IconData icon;
  final bool attention;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Icon(icon, size: 21, color: attention ? p.accent : (muted ? p.tertiary : p.secondary));
  }
}

/// How a shipment travels, at the start of its row: crimson when something
/// has gone wrong, a tick once it is delivered.
class ModeBadge extends StatelessWidget {
  const ModeBadge({super.key, required this.mode, required this.status});
  final String mode;
  final String status;

  @override
  Widget build(BuildContext context) {
    final delivered = status == 'delivered';
    return IconTile(icon: delivered ? KIcons.done : modeIcon(mode), attention: status == 'exception', muted: delivered);
  }
}
