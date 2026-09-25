import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../map/route_map.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';
import 'journey.dart';

/// A shipment (or a job, as a shipment) as one quiet card, the way a
/// ride-hailing app shows a trip: the route on its map, then three lines —
/// where from and to with the date, the reference, and how it stands.
///
/// The card is the shared element that moves from a home screen into the
/// detail page, where the same card heads the page.
class JourneyGraphic extends StatelessWidget {
  const JourneyGraphic({super.key, required this.shipment, this.trailing, this.status, this.emphasis, this.subtitle, this.onTap});

  final Shipment shipment;

  /// Beside the reference: the mode, unless something more useful is given.
  final String? trailing;
  final String? status;
  final Emphasis? emphasis;
  final String? subtitle;
  final VoidCallback? onTap;

  static const mapHeight = 168.0;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final s = shipment;
    final status = this.status ?? statusLabel(l, s.status);
    final emphasis = this.emphasis ?? statusEmphasis(s.status);
    final subtitle =
        this.subtitle ??
        (s.currentLocation != null && !s.delivered ? l.overviewNowAt(s.currentLocation!) : l.shipLastUpdate(formatDateTime(s.updatedAt)));
    final mapped = RouteMap.canDraw(s.origin, s.destination);

    Widget card = Material(
      color: p.surface,
      borderRadius: BorderRadius.circular(kCardRadius),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (mapped)
              SizedBox(
                height: mapHeight,
                child: RouteMap(
                  origin: s.origin,
                  destination: s.destination,
                  current: s.currentLocation,
                  progress: journeyFraction(s.status),
                  vehicle: modeSolidIcon(s.mode),
                  delivered: s.delivered,
                  attention: s.status == 'exception',
                  style: RouteMapStyle.page(p),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(kGutter, 18, kGutter, 2),
                child: JourneyBar(status: s.status),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(child: RouteText(place(s.origin), place(s.destination), style: context.type.titleLarge)),
                      const SizedBox(width: 12),
                      Text(
                        s.eta == null ? '—' : formatShortDate(s.eta),
                        style: context.type.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          [s.reference, trailing ?? modeLabel(l, s.mode)].join(' · '),
                          style: context.type.bodyMedium?.copyWith(color: p.secondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(l.overviewColEta, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      // The status keeps its words; the location gives way.
                      Flexible(
                        flex: 0,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 200),
                          child: StatusText(status, emphasis, style: context.type.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          '  ·  $subtitle',
                          style: context.type.bodyMedium?.copyWith(color: p.secondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    if (onTap != null) card = Pressable(scale: 0.985, child: card);
    return Hero(
      tag: 'journey-${s.reference}',
      // Both ends are the same card at the same size, so the flight is a
      // clean move; it lays out at natural height in case text differs.
      flightShuttleBuilder: (context, animation, direction, from, to) => OverflowBox(
        alignment: Alignment.topCenter,
        maxHeight: double.infinity,
        child: Material(type: MaterialType.transparency, child: (to.widget as Hero).child),
      ),
      child: Material(type: MaterialType.transparency, child: card),
    );
  }
}
