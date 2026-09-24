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
      'air' => Icons.flight_rounded,
      'sea' || 'ocean' => Icons.directions_boat_rounded,
      'road' => Icons.local_shipping_rounded,
      'rail' => Icons.train_rounded,
      'courier' => Icons.inventory_2_rounded,
      _ => Icons.route_rounded,
    };

/// The journey as a line, filled in crimson up to where the cargo is. The
/// large variant carries the vehicle on its leading edge, as flight trackers
/// do; the thin one sits under list rows.
class JourneyBar extends StatelessWidget {
  const JourneyBar({super.key, required this.status, this.mode, this.large = false});
  final String status;
  final String? mode;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final delivered = status == 'delivered';
    final target = journeyFraction(status);
    // Done is calm: a finished journey is ink, not an alert colour.
    final fillColor = delivered ? p.ink : p.accent;
    final lineHeight = large ? 4.0 : 2.5;
    final vehicle = large ? 34.0 : 0.0;
    final animate = !MediaQuery.of(context).disableAnimations;

    return Semantics(
      value: '${journeyStage(status) + 1} / $journeyStageCount',
      child: SizedBox(
        height: large ? vehicle : lineHeight,
        child: LayoutBuilder(builder: (context, constraints) {
          final width = constraints.maxWidth;
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: animate ? 0 : target, end: target),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
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
                      child: Container(
                        width: vehicle,
                        height: vehicle,
                        decoration: BoxDecoration(
                          color: p.paper,
                          shape: BoxShape.circle,
                          border: Border.all(color: fillColor, width: 2),
                        ),
                        child: Icon(delivered ? Icons.check_rounded : modeIcon(mode ?? ''), size: 17, color: fillColor),
                      ),
                    ),
                ],
              );
            },
          );
        }),
      ),
    );
  }
}
