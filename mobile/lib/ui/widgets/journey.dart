import 'package:flutter/material.dart';

import '../motion.dart';
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
  'courier' => KIcons.shipmentsOn,
  _ => KIcons.route,
};

/// The journey as a line, filled in crimson up to where the cargo is. The
/// large variant carries the vehicle on its leading edge, as flight trackers
/// do; the thin one sits under list rows.
class JourneyBar extends StatelessWidget {
  const JourneyBar({super.key, required this.status, this.mode, this.large = false, this.reference});
  final String status;
  final String? mode;
  final bool large;

  /// When given, the fill animates only the first time this shipment is
  /// drawn in a session. A bar that flies in from another screen, or is
  /// refreshed, must not drain and refill.
  final String? reference;

  static final Set<String> _drawn = {};

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final delivered = status == 'delivered';
    final target = journeyFraction(status);
    // Done is calm: a finished journey is ink, not an alert colour.
    final fillColor = delivered ? p.ink : p.accent;
    final lineHeight = large ? 4.0 : 2.5;
    final vehicle = large ? 34.0 : 0.0;
    // Later rebuilds find the reference already drawn; the tween then
    // simply carries on from wherever it is.
    final seen = reference != null && !_drawn.add(reference!);
    final animate = !seen && !Motion.reduced(context);

    return Semantics(
      value: '${journeyStage(status) + 1} / $journeyStageCount',
      child: SizedBox(
        height: large ? vehicle : lineHeight,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            return TweenAnimationBuilder<double>(
              tween: Tween(begin: animate ? 0 : target, end: target),
              duration: const Duration(milliseconds: 1100),
              curve: Motion.easeOut,
              builder: (context, value, _) {
                final head = (width * value).clamp(vehicle / 2, width - vehicle / 2).toDouble();
                return Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.centerLeft,
                  children: [
                    Container(
                      height: lineHeight,
                      decoration: BoxDecoration(color: p.hairline, borderRadius: BorderRadius.circular(lineHeight)),
                    ),
                    if (large)
                      for (var i = 1; i < journeyStageCount - 1; i++)
                        Positioned(
                          left: width * i / (journeyStageCount - 1) - 3,
                          child: Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: width * i / (journeyStageCount - 1) <= width * value ? fillColor : p.hairline,
                              shape: BoxShape.circle,
                              border: Border.all(color: p.paper, width: 1.5),
                            ),
                          ),
                        ),
                    Container(
                      width: large ? head : width * value,
                      height: lineHeight,
                      decoration: BoxDecoration(color: fillColor, borderRadius: BorderRadius.circular(lineHeight)),
                    ),
                    if (large)
                      Positioned(
                        left: head - vehicle / 2,
                        child: LivePulse(
                          size: vehicle,
                          active: !delivered,
                          child: Container(
                            width: vehicle,
                            height: vehicle,
                            decoration: BoxDecoration(
                              color: p.paper,
                              shape: BoxShape.circle,
                              border: Border.all(color: fillColor, width: 2),
                            ),
                            child: Icon(delivered ? KIcons.check : modeIcon(mode ?? ''), size: 17, color: fillColor),
                          ),
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// An icon on a rounded tile at the start of a row: crimson-tinted for
/// trouble, quiet for anything already dealt with.
class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, this.attention = false, this.muted = false});
  final IconData icon;
  final bool attention;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: attention ? Color.alphaBlend(p.accent.withValues(alpha: 0.10), p.paper) : p.fill,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(icon, size: 19, color: attention ? p.accent : (muted ? p.secondary : p.ink)),
    );
  }
}

/// How a shipment travels, as the tile at the start of its row: crimson
/// when something has gone wrong, a tick once it is delivered.
class ModeBadge extends StatelessWidget {
  const ModeBadge({super.key, required this.mode, required this.status});
  final String mode;
  final String status;

  @override
  Widget build(BuildContext context) {
    final delivered = status == 'delivered';
    return IconTile(icon: delivered ? KIcons.check : modeIcon(mode), attention: status == 'exception', muted: delivered);
  }
}
