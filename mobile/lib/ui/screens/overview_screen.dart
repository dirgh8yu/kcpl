import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/bento.dart';
import '../widgets/choice_rows.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart' show journeyStage;
import '../widgets/pass.dart';
import '../widgets/push_ui.dart';
import '../widgets/rows.dart';

export '../widgets/pass.dart' show JourneyGraphic, Endpoints;

enum HomeTab { overview, shipments, documents, invoices, account }

/// The shipment worth leading with: anything in trouble first, then
/// whatever arrives soonest.
Shipment? heroShipment(List<Shipment> shipments) {
  final active = shipments.where((s) => !s.delivered).toList();
  if (active.isEmpty) return null;
  final trouble = active.where((s) => s.status == 'exception');
  if (trouble.isNotEmpty) return trouble.first;
  final dated = active.where((s) => s.eta != null).toList()..sort((a, b) => a.eta!.compareTo(b.eta!));
  return dated.isNotEmpty ? dated.first : active.first;
}

class OverviewScreen extends StatelessWidget {
  const OverviewScreen({super.key, required this.onNavigate});
  final ValueChanged<HomeTab> onNavigate;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final controller = AppScope.of(context);
    return AsyncPage<OverviewBundle>(
      title: l.chromeOverview,
      load: () async {
        final bundle = await controller.api.overview();
        controller.updateSession(bundle.session);
        return bundle;
      },
      builder: (context, bundle) => _body(context, bundle),
    );
  }

  List<Widget> _body(BuildContext context, OverviewBundle bundle) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final overview = bundle.overview;
    final session = bundle.session;
    final hero = heroShipment(overview.shipments);
    final rest = overview.shipments.where((s) => s != hero).take(5).toList();
    final finance = session.canViewFinance ? overview.finance : null;

    return [
      _AccountLine(session: session),
      PushPrimer(copy: customerPushCopy(l)),
      if (hero != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 0),
          child: HeroShipment(shipment: hero),
        ),
      const SizedBox(height: 24),
      _Figures(overview: overview, onNavigate: onNavigate),
      if (overview.freeTime.isNotEmpty) ...[
        SectionHeader(l.overviewFreeTimeTitle),
        RowGroup(
          children: [
            for (final row in overview.freeTime)
              RowTile(
                onTap: () => openShipment(context, row.reference),
                leading: Icon(
                  KIcons.timer,
                  size: 22,
                  color: p.of(freeTimeEmphasis(row.status) == Emphasis.attention ? Emphasis.attention : Emphasis.normal),
                ),
                title: Text(freeTimeSummary(l, row.location, row.status)),
                subtitle: Text('${row.reference} · ${l.freeTimeDeadline} ${formatShortDate(row.status.deadline)}'),
                chevron: true,
              ),
          ],
        ),
      ],
      if (overview.outstanding.isNotEmpty) ...[
        SectionHeader(l.overviewOutstandingTitle),
        RowGroup(
          children: [
            for (final item in overview.outstanding)
              RowTile(
                onTap: () => openShipment(context, item.reference),
                leading: Icon(KIcons.upload, size: 22, color: p.accent),
                title: Text(item.rows.map((row) => documentTypeLabel(l, row.documentType)).join(', ')),
                subtitle: Text(
                  '${item.reference} · ${place(item.origin)} – ${place(item.destination)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                chevron: true,
              ),
          ],
        ),
      ],
      if (finance != null && finance.balances.isNotEmpty) ...[
        SectionHeader(l.overviewAccountTitle, actionLabel: l.overviewViewInvoices, onAction: () => onNavigate(HomeTab.invoices)),
        for (final balance in finance.balances) BalanceFigure(balance: balance),
      ],
      // The hero already leads; the list carries the others.
      if (hero == null || rest.isNotEmpty)
        SectionHeader(l.overviewMovementsTitle, actionLabel: l.overviewAllShipments, onAction: () => onNavigate(HomeTab.shipments)),
      if (hero == null)
        EmptyState(
          icon: KIcons.shipments,
          title: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredTitle : l.overviewEmptyNoneTitle,
          description: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredDescription : l.overviewEmptyNoneDescription,
        )
      else if (rest.isNotEmpty)
        RowGroup(children: [for (final shipment in rest) ShipmentRow(shipment)]),
      SectionHeader(l.overviewPaperworkTitle, actionLabel: l.overviewAllDocuments, onAction: () => onNavigate(HomeTab.documents)),
      if (overview.documents.isEmpty)
        EmptyState(icon: KIcons.document, title: l.overviewNoDocumentsTitle, description: l.overviewNoDocumentsDescription)
      else
        RowGroup(children: [for (final document in overview.documents.take(3)) DocumentRowTile(document)]),
    ];
  }
}

/// The figures as a bento: where the active shipments are, what arrives
/// this week, and what has gone wrong.
class _Figures extends StatelessWidget {
  const _Figures({required this.overview, required this.onNavigate});
  final Overview overview;
  final ValueChanged<HomeTab> onNavigate;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final active = overview.shipments.where((s) => !s.delivered).toList();
    int count(bool Function(String status) test) => active.where((s) => test(s.status)).length;
    final trouble = active.where((s) => s.status == 'exception').map((s) => s.reference).toList();
    final arrivals = [for (final s in active) ?DateTime.tryParse(s.eta ?? '')];
    return Bento(
      rows: [
        [
          BentoTile(
            label: l.overviewKpiActive,
            value: overview.activeCount,
            icon: KIcons.shipments,
            large: true,
            onTap: () => onNavigate(HomeTab.shipments),
            chart: StageBar(
              stages: [
                Stage(l.statusBookingConfirmed, count((s) => journeyStage(s) == 0 && s != 'exception')),
                Stage(l.statusInTransit, count((s) => s == 'in_transit')),
                Stage(l.statusCustomsClearance, count((s) => s == 'customs_clearance')),
                Stage(l.statusOutForDelivery, count((s) => s == 'out_for_delivery')),
                if (trouble.isNotEmpty) Stage(l.statusException, trouble.length, attention: true),
              ],
            ),
          ),
        ],
        [
          BentoTile(
            label: l.overviewKpiArriving,
            value: overview.arrivingCount,
            chart: WeekStrip(dates: arrivals),
          ),
          BentoTile(
            label: l.overviewKpiAttention,
            value: overview.attentionCount,
            icon: KIcons.warning,
            attention: true,
            caption: trouble.isEmpty ? null : trouble.take(2).join('\n'),
            onTap: () => onNavigate(HomeTab.shipments),
          ),
        ],
      ],
    );
  }
}

/// Which customer this is, under the title. An agent taps it to switch.
class _AccountLine extends StatelessWidget {
  const _AccountLine({required this.session});
  final SessionView session;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final many = session.customers.length > 1;
    final label = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: Text(
            session.customerName,
            style: context.type.bodyLarge?.copyWith(color: p.secondary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (many) Icon(KIcons.expand, size: 20, color: p.secondary),
      ],
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: kGutter - 4),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: many
            ? InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => showCustomerSheet(context),
                child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2), child: label),
              )
            : Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: label),
      ),
    );
  }
}

/// The lead shipment, as the dark pass.
class HeroShipment extends StatelessWidget {
  const HeroShipment({super.key, required this.shipment});
  final Shipment shipment;

  @override
  Widget build(BuildContext context) => JourneyGraphic(
    shipment: shipment,
    onTap: () => openShipment(context, shipment.reference, preview: shipment),
  );
}

class Figure extends StatelessWidget {
  const Figure({super.key, required this.label, required this.value, this.attention = false, this.onTap});
  final String label;
  final int value;
  final bool attention;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.only(right: 8, top: 4, bottom: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CountUp(
                value: value.toDouble(),
                format: (v) => '${v.round()}',
                style: context.type.headlineSmall?.copyWith(
                  color: attention ? p.accent : p.ink,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 2),
              Text(label, style: context.type.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

/// One currency's balance, in the large figure a balance deserves.
class BalanceFigure extends StatelessWidget {
  const BalanceFigure({super.key, required this.balance, this.detail = false});
  final CurrencyBalance balance;
  final bool detail;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.overviewCurrencyOutstanding(balance.currency), style: context.type.bodySmall),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: CountUp(value: balance.outstanding, format: (v) => formatMoney(v, balance.currency), style: context.type.headlineLarge),
          ),
          const SizedBox(height: 6),
          if (balance.overdue > 0)
            StatusText(l.overviewAmountOverdue(formatMoney(balance.overdue, balance.currency)), Emphasis.attention)
          else
            StatusText(l.overviewNothingOverdue, Emphasis.muted),
          if (detail) ...[
            const SizedBox(height: 4),
            Text(
              l.invInvoicedReceipted(formatMoney(balance.invoiced, balance.currency), formatMoney(balance.paid, balance.currency)),
              style: context.type.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}
