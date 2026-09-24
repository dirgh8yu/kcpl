import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';
import '../widgets/rows.dart';
import 'overview_screen.dart' show Endpoints;

class ShipmentDetailScreen extends StatelessWidget {
  const ShipmentDetailScreen({super.key, required this.reference});
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<ShipmentDetail>(
        title: reference,
        load: () => api.shipment(reference),
        onMissing: (context, _) =>
            EmptyState(icon: Icons.search_off_rounded, title: l.shipNotFoundTitle, description: l.shipNotFoundDescription),
        builder: (context, detail) => _body(context, detail),
      ),
    );
  }

  List<Widget> _body(BuildContext context, ShipmentDetail detail) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final shipment = detail.shipment;
    final freeTime = detail.freeTime;
    final emphasis = statusEmphasis(shipment.status);

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter),
        child: Text(
          [modeLabel(l, shipment.mode), if (shipment.carrier != null) shipment.carrier!].join(' · '),
          style: context.type.bodyLarge?.copyWith(color: p.secondary),
        ),
      ),
      // The journey, large: where from, where to, and how far along.
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 28, kGutter, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Endpoints(origin: shipment.origin, destination: shipment.destination),
          const SizedBox(height: 22),
          JourneyBar(status: shipment.status, mode: shipment.mode, large: true),
          const SizedBox(height: 22),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                StatusText(statusLabel(l, shipment.status), emphasis, style: context.type.titleLarge),
                const SizedBox(height: 4),
                Text(
                  shipment.currentLocation != null && !shipment.delivered
                      ? l.overviewNowAt(shipment.currentLocation!)
                      : l.shipLastUpdate(formatDateTime(shipment.updatedAt)),
                  style: context.type.bodySmall,
                ),
              ]),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Align(
                alignment: AlignmentDirectional.topEnd,
                child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(l.shipEta, style: context.type.bodySmall, textAlign: TextAlign.end),
                const SizedBox(height: 2),
                Text(shipment.eta == null ? l.shipToBeConfirmed : formatShortDate(shipment.eta),
                    style: context.type.titleLarge, textAlign: TextAlign.end),
                ]),
              ),
            ),
          ]),
        ]),
      ),
      if (shipment.customerNote != null) ...[
        const SizedBox(height: 28),
        Notice(title: shipment.customerNote!, emphasis: emphasis == Emphasis.attention ? Emphasis.attention : Emphasis.normal),
      ],
      if (freeTime != null) ...[
        SectionHeader(l.freeTimeLabel),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 8),
          child: Notice(
            emphasis: freeTimeEmphasis(freeTime.status),
            title: freeTimeSummary(l, freeTime.location, freeTime.status),
            body: freeTime.status.state == 'expired' ? l.shipFreeTimeExpiredDescription : l.shipFreeTimeDescription,
          ),
        ),
        RowGroup(children: [
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
            DetailRow(l.shipChargeAfterExpiry,
                l.shipPerDay(freeTime.chargeCurrency!, formatAmount(freeTime.dailyCharge!, freeTime.chargeCurrency!))),
        ]),
        Footnote(l.shipFreeTimeFootnote),
      ],
      if (detail.checklist.isNotEmpty) ...[
        SectionHeader(l.xchgTitle),
        RowGroup(children: [
          for (final row in detail.checklist)
            Builder(builder: (context) {
              final (label, state) = requirementState(l, row.state);
              return RowTile(
                title: Text(documentTypeLabel(l, row.documentType), style: context.type.bodyLarge),
                trailing: StatusText(label, state),
              );
            }),
        ]),
      ],
      SectionHeader(l.shipMilestonesTitle),
      if (detail.events.isEmpty)
        EmptyState(icon: Icons.timeline_rounded, title: l.shipNoMilestonesTitle, description: l.shipNoMilestonesDescription)
      else
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 0),
          child: Column(children: [
            for (var i = 0; i < detail.events.length; i++)
              _Milestone(event: detail.events[i], latest: i == 0, last: i == detail.events.length - 1),
          ]),
        ),
      SectionHeader(l.shipMovementTitle),
      RowGroup(children: [
        DetailRow(l.shipMode, modeLabel(l, shipment.mode)),
        DetailRow(l.shipCurrentLocation, shipment.currentLocation ?? l.shipNotReported),
        DetailRow(l.shipEta, shipment.eta == null ? l.shipToBeConfirmed : formatDate(shipment.eta)),
        DetailRow(l.shipsColCarrier, shipment.carrier ?? l.shipToBeConfirmed),
        DetailRow(l.shipCarrierReference, shipment.carrierReference ?? l.shipToBeConfirmed),
        DetailRow(l.overviewOrigin, shipment.origin.isEmpty ? '—' : shipment.origin),
        DetailRow(l.overviewDestination, shipment.destination.isEmpty ? '—' : shipment.destination),
      ]),
      SectionHeader(l.commonDocuments),
      if (detail.documents.isEmpty)
        EmptyState(icon: Icons.description_outlined, title: l.shipNoDocumentsTitle, description: l.shipNoDocumentsDescription)
      else
        RowGroup(children: [for (final document in detail.documents) DocumentRowTile(document, showShipment: false)]),
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
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 14,
          child: Column(children: [
            const SizedBox(height: 5),
            Container(
              width: latest ? 12 : 8,
              height: latest ? 12 : 8,
              decoration: BoxDecoration(color: latest ? p.accent : p.tertiary, shape: BoxShape.circle),
            ),
            if (!last) Expanded(child: Container(width: 1, margin: const EdgeInsets.symmetric(vertical: 4), color: p.hairline)),
          ]),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                event.title,
                style: latest ? context.type.titleMedium : context.type.bodyLarge?.copyWith(color: p.secondary),
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
            ]),
          ),
        ),
      ]),
    );
  }
}
