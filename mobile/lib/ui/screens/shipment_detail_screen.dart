import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/rows.dart';
import 'overview_screen.dart' show JourneyGraphic;

class ShipmentDetailScreen extends StatelessWidget {
  const ShipmentDetailScreen({super.key, required this.reference, this.preview});
  final String reference;

  /// The row or card this was opened from. Its journey is drawn at once,
  /// and is where the overview card's shared element lands.
  final Shipment? preview;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    final preview = this.preview;
    return Scaffold(
      body: AsyncPage<ShipmentDetail>(
        title: reference,
        load: () => api.shipment(reference),
        leading: preview == null ? 0 : 2,
        placeholder: preview == null ? null : (context) => _lead(context, preview),
        onMissing: (context, _) => EmptyState(icon: KIcons.noResults, title: l.shipNotFoundTitle, description: l.shipNotFoundDescription),
        builder: (context, detail) => _body(context, detail),
      ),
    );
  }

  /// The mode line and the journey: everything a list row already knows.
  List<Widget> _lead(BuildContext context, Shipment shipment) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
        child: Text(
          [modeLabel(l, shipment.mode), if (shipment.carrier != null) shipment.carrier!].join(' · '),
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
        ),
      ),
      // The trip: where from, where to, how far along, and when.
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
        child: JourneyGraphic(shipment: shipment),
      ),
    ];
  }

  List<Widget> _body(BuildContext context, ShipmentDetail detail) {
    final l = AppLocalizations.of(context);
    final shipment = detail.shipment;
    final freeTime = detail.freeTime;
    final emphasis = statusEmphasis(shipment.status);

    return [
      ..._lead(context, shipment),
      if (shipment.customerNote != null) ...[
        const SizedBox(height: 16),
        Notice(title: shipment.customerNote!, emphasis: emphasis == Emphasis.attention ? Emphasis.attention : Emphasis.normal),
      ],
      if (freeTime != null) ...[
        SectionHeader(l.freeTimeLabel),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Notice(
            emphasis: freeTimeEmphasis(freeTime.status),
            title: freeTimeSummary(l, freeTime.location, freeTime.status),
            body: freeTime.status.state == 'expired' ? l.shipFreeTimeExpiredDescription : l.shipFreeTimeDescription,
          ),
        ),
        RowGroup(
          children: [
            DetailRow(l.shipLocation, freeTime.location ?? l.shipAsAdvised),
            DetailRow(l.freeTimeDeadline, formatDate(freeTime.status.deadline)),
            DetailRow(
              freeTime.status.state == 'expired' ? l.shipDaysOverdue : l.shipDaysRemaining,
              '${freeTime.status.state == 'expired' ? freeTime.status.daysOverdue : freeTime.status.daysRemaining}',
              strong: true,
              emphasis: freeTimeEmphasis(freeTime.status),
            ),
            if (freeTime.days != null) DetailRow(l.shipAllowance, l.shipAllowanceDays('${freeTime.days}')),
            if (freeTime.dailyCharge != null && freeTime.chargeCurrency != null)
              DetailRow(
                l.shipChargeAfterExpiry,
                l.shipPerDay(freeTime.chargeCurrency!, formatAmount(freeTime.dailyCharge!, freeTime.chargeCurrency!)),
              ),
          ],
        ),
        Footnote(l.shipFreeTimeFootnote),
      ],
      if (detail.checklist.isNotEmpty) ...[
        SectionHeader(l.xchgTitle),
        RowGroup(
          children: [
            for (final row in detail.checklist)
              Builder(
                builder: (context) {
                  final (label, state) = requirementState(l, row.state);
                  return RowTile(title: Text(documentTypeLabel(l, row.documentType)), trailing: StatusText(label, state));
                },
              ),
          ],
        ),
      ],
      SectionHeader(l.shipMilestonesTitle),
      if (detail.events.isEmpty)
        GroupCard(
          child: EmptyState(icon: KIcons.history, title: l.shipNoMilestonesTitle, description: l.shipNoMilestonesDescription),
        )
      else
        GroupCard(
          padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 16),
          child: Column(
            children: [
              for (var i = 0; i < detail.events.length; i++)
                _Milestone(event: detail.events[i], latest: i == 0, last: i == detail.events.length - 1),
            ],
          ),
        ),
      SectionHeader(l.shipMovementTitle),
      RowGroup(
        children: [
          DetailRow(l.shipMode, modeLabel(l, shipment.mode)),
          DetailRow(l.shipCurrentLocation, shipment.currentLocation ?? l.shipNotReported),
          DetailRow(l.shipEta, shipment.eta == null ? l.shipToBeConfirmed : formatDate(shipment.eta)),
          DetailRow(l.shipsColCarrier, shipment.carrier ?? l.shipToBeConfirmed),
          DetailRow(l.shipCarrierReference, shipment.carrierReference ?? l.shipToBeConfirmed),
          DetailRow(l.overviewOrigin, shipment.origin.isEmpty ? '—' : shipment.origin),
          DetailRow(l.overviewDestination, shipment.destination.isEmpty ? '—' : shipment.destination),
        ],
      ),
      SectionHeader(l.commonDocuments),
      if (detail.documents.isEmpty)
        GroupCard(
          child: EmptyState(icon: KIcons.document, title: l.shipNoDocumentsTitle, description: l.shipNoDocumentsDescription),
        )
      else
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [for (final document in detail.documents) DocumentRowTile(document, showShipment: false)],
        ),
    ];
  }
}

/// One step of the timeline. The newest is marked in crimson; older steps
/// step back in grey, the way a tracker shows what has already happened.
class _Milestone extends StatelessWidget {
  const _Milestone({required this.event, required this.latest, required this.last});
  final ShipmentEvent event;
  final bool latest;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 14,
            child: Column(
              children: [
                const SizedBox(height: 5),
                Container(
                  width: latest ? 10 : 8,
                  height: latest ? 10 : 8,
                  decoration: BoxDecoration(color: latest ? p.ink : p.tertiary, shape: BoxShape.circle),
                ),
                if (!last)
                  Expanded(
                    child: Container(width: 1.5, margin: const EdgeInsets.symmetric(vertical: 4), color: p.fill),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: context.type.bodyLarge?.copyWith(
                      fontWeight: latest ? FontWeight.w600 : FontWeight.w400,
                      color: latest ? p.ink : p.secondary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [formatDateTime(event.eventTime), if (event.location != null) event.location!].join(' · '),
                    style: context.type.bodySmall,
                  ),
                  if (event.details != null) ...[
                    const SizedBox(height: 4),
                    Text(event.details!, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
