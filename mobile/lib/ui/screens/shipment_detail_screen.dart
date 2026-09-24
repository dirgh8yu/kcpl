import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/tiles.dart';

class ShipmentDetailScreen extends StatelessWidget {
  const ShipmentDetailScreen({super.key, required this.reference});
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: Text(reference)),
      body: AsyncView<ShipmentDetail>(
        load: () => api.shipment(reference),
        onMissing: (context, _) => ListView(children: [
          EmptyState(icon: Icons.search_off_rounded, title: l.shipNotFoundTitle, description: l.shipNotFoundDescription),
        ]),
        builder: (context, detail) => _ShipmentBody(detail: detail),
      ),
    );
  }
}

class _ShipmentBody extends StatelessWidget {
  const _ShipmentBody({required this.detail});
  final ShipmentDetail detail;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final shipment = detail.shipment;
    final freeTime = detail.freeTime;
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(modeIcon(shipment.mode), size: 16, color: theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 6),
                Expanded(child: Text(modeLabel(l, shipment.mode), style: muted, overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                TrailingBadge(statusLabel(l, shipment.status), statusTone(shipment.status)),
              ]),
              const SizedBox(height: 12),
              _RouteLine(origin: shipment.origin, destination: shipment.destination),
              const SizedBox(height: 8),
              Text(l.shipLastUpdate(formatDateTime(shipment.updatedAt)), style: muted),
            ],
          ),
        ),
        if (shipment.customerNote != null) ...[
          const SizedBox(height: 16),
          Callout(tone: statusTone(shipment.status), icon: Icons.info_outline_rounded, title: shipment.customerNote!),
        ],
        if (freeTime != null) ...[
          SectionHeader(l.freeTimeLabel),
          Callout(
            tone: freeTimeTone(freeTime.status),
            icon: Icons.timer_outlined,
            title: freeTimeSummary(l, freeTime.location, freeTime.status),
            body: freeTime.status.state == 'expired' ? l.shipFreeTimeExpiredDescription : l.shipFreeTimeDescription,
          ),
          const SizedBox(height: 10),
          Panel(children: [
            InfoRow(l.shipLocation, freeTime.location ?? l.shipAsAdvised),
            InfoRow(l.freeTimeDeadline, formatDate(freeTime.status.deadline)),
            InfoRow(
              freeTime.status.state == 'expired' ? l.shipDaysOverdue : l.shipDaysRemaining,
              '${freeTime.status.state == 'expired' ? freeTime.status.daysOverdue : freeTime.status.daysRemaining}',
              emphasis: true,
            ),
            if (freeTime.days != null) InfoRow(l.shipAllowance, l.shipAllowanceDays('${freeTime.days}')),
            if (freeTime.dailyCharge != null && freeTime.chargeCurrency != null)
              InfoRow(l.shipChargeAfterExpiry, l.shipPerDay(freeTime.chargeCurrency!, formatAmount(freeTime.dailyCharge!, freeTime.chargeCurrency!))),
          ]),
          Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(l.shipFreeTimeFootnote, style: muted)),
        ],
        SectionHeader(l.shipMovementTitle),
        Panel(children: [
          InfoRow(l.shipMode, modeLabel(l, shipment.mode)),
          InfoRow(l.shipCurrentLocation, shipment.currentLocation ?? l.shipNotReported),
          InfoRow(l.shipEta, shipment.eta == null ? l.shipToBeConfirmed : formatDate(shipment.eta)),
          InfoRow(l.shipsColCarrier, shipment.carrier ?? l.shipToBeConfirmed),
          InfoRow(l.shipCarrierReference, shipment.carrierReference ?? l.shipToBeConfirmed),
        ]),
        if (detail.checklist.isNotEmpty) ...[
          SectionHeader(l.xchgTitle),
          Panel(children: [
            for (final row in detail.checklist)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(children: [
                  Expanded(child: Text(documentTypeLabel(l, row.documentType), style: theme.textTheme.bodyMedium)),
                  const SizedBox(width: 8),
                  Builder(builder: (context) {
                    final (label, tone) = requirementState(l, row.state);
                    return TrailingBadge(label, tone);
                  }),
                ]),
              ),
          ]),
        ],
        SectionHeader(l.shipMilestonesTitle),
        if (detail.events.isEmpty)
          EmptyState(icon: Icons.timeline_rounded, title: l.shipNoMilestonesTitle, description: l.shipNoMilestonesDescription)
        else
          Panel(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Column(children: [
                for (var i = 0; i < detail.events.length; i++)
                  _Milestone(event: detail.events[i], latest: i == 0, last: i == detail.events.length - 1),
              ]),
            ),
          ]),
        SectionHeader(l.commonDocuments, description: l.shipDocumentsDescription),
        if (detail.documents.isEmpty)
          EmptyState(icon: Icons.description_outlined, title: l.shipNoDocumentsTitle, description: l.shipNoDocumentsDescription)
        else
          Panel(children: [for (final document in detail.documents) DocumentTile(document, showShipment: false)]),
      ],
    );
  }
}

class _RouteLine extends StatelessWidget {
  const _RouteLine({required this.origin, required this.destination});
  final String origin;
  final String destination;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = AppLocalizations.of(context);
    Widget end(String label, String value, CrossAxisAlignment align) => Expanded(
          child: Column(crossAxisAlignment: align, children: [
            Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 2),
            Text(value.isEmpty ? '—' : value,
                style: theme.textTheme.titleMedium, textAlign: align == CrossAxisAlignment.end ? TextAlign.end : TextAlign.start),
          ]),
        );
    return Row(children: [
      end(l.overviewOrigin, origin, CrossAxisAlignment.start),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Icon(Icons.arrow_forward_rounded, color: theme.colorScheme.onSurfaceVariant, size: 20),
      ),
      end(l.overviewDestination, destination, CrossAxisAlignment.end),
    ]);
  }
}

class _Milestone extends StatelessWidget {
  const _Milestone({required this.event, required this.latest, required this.last});
  final ShipmentEvent event;
  final bool latest;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dot = latest ? KcplColors.crimson : theme.colorScheme.outline;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(children: [
              const SizedBox(height: 4),
              Container(width: 10, height: 10, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
              if (!last) Expanded(child: Container(width: 1.5, color: theme.colorScheme.outlineVariant)),
            ]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 12 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(event.title, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: latest ? FontWeight.w600 : FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text(
                    [formatDateTime(event.eventTime), if (event.location != null) event.location!].join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  if (event.details != null) ...[
                    const SizedBox(height: 4),
                    Text(event.details!, style: theme.textTheme.bodySmall),
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
