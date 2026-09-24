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
import 'shipment_detail_screen.dart';

enum HomeTab { overview, shipments, documents, invoices, account }

class OverviewScreen extends StatelessWidget {
  const OverviewScreen({super.key, required this.onNavigate});
  final ValueChanged<HomeTab> onNavigate;

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return AsyncView<OverviewBundle>(
      load: () async {
        final bundle = await controller.api.overview();
        controller.updateSession(bundle.session);
        return bundle;
      },
      builder: (context, bundle) => _OverviewBody(bundle: bundle, onNavigate: onNavigate),
    );
  }
}

class _OverviewBody extends StatelessWidget {
  const _OverviewBody({required this.bundle, required this.onNavigate});
  final OverviewBundle bundle;
  final ValueChanged<HomeTab> onNavigate;

  void _openShipment(BuildContext context, String reference) => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => ShipmentDetailScreen(reference: reference)),
      );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final overview = bundle.overview;
    final finance = overview.finance;

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Text(l.overviewDescription, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          // Rows that size to their content rather than a fixed-ratio grid, so
          // a two-line Nepali label or a large system text size never clips.
          child: Column(children: [
            _KpiRow(
              _Kpi(label: l.overviewKpiActive, value: overview.activeCount, onTap: () => onNavigate(HomeTab.shipments)),
              _Kpi(label: l.overviewKpiInTransit, value: overview.inTransitCount, onTap: () => onNavigate(HomeTab.shipments)),
            ),
            const SizedBox(height: 10),
            _KpiRow(
              _Kpi(label: l.overviewKpiArriving, value: overview.arrivingCount),
              _Kpi(
                label: l.overviewKpiAttention,
                value: overview.attentionCount,
                tone: overview.attentionCount > 0 ? Tone.danger : null,
                onTap: () => onNavigate(HomeTab.shipments),
              ),
            ),
          ]),
        ),
        if (overview.freeTime.isNotEmpty) ...[
          SectionHeader(l.overviewFreeTimeTitle, description: l.overviewFreeTimeDescription),
          Panel(children: [
            for (final row in overview.freeTime)
              ListTile(
                onTap: () => _openShipment(context, row.reference),
                leading: Icon(Icons.timer_outlined, color: ToneColors.of(context, freeTimeTone(row.status)).foreground),
                title: Text(freeTimeSummary(l, row.location, row.status)),
                subtitle: Text('${row.reference} · ${l.freeTimeDeadline} ${formatDate(row.status.deadline)}'),
                trailing: const Icon(Icons.chevron_right_rounded),
              ),
          ]),
        ],
        if (overview.outstanding.isNotEmpty) ...[
          SectionHeader(l.overviewOutstandingTitle, description: l.overviewOutstandingDescription),
          Panel(children: [
            for (final item in overview.outstanding)
              ListTile(
                onTap: () => _openShipment(context, item.reference),
                leading: Icon(Icons.upload_file_rounded, color: ToneColors.of(context, Tone.warning).foreground),
                title: Text(item.rows.map((row) => documentTypeLabel(l, row.documentType)).join(', ')),
                subtitle: Text('${item.reference} · ${route(item.origin, item.destination)}', maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: const Icon(Icons.chevron_right_rounded),
              ),
          ]),
        ],
        if (finance != null && finance.balances.isNotEmpty) ...[
          SectionHeader(l.overviewAccountTitle, actionLabel: l.overviewViewInvoices, onAction: () => onNavigate(HomeTab.invoices)),
          Panel(children: [
            for (final balance in finance.balances)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.overviewCurrencyOutstanding(balance.currency),
                              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                          const SizedBox(height: 2),
                          Text(formatMoney(balance.outstanding, balance.currency),
                              style: theme.textTheme.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    balance.overdue > 0
                        ? TrailingBadge(l.overviewAmountOverdue(formatMoney(balance.overdue, balance.currency)), Tone.danger)
                        : TrailingBadge(l.overviewNothingOverdue, Tone.success),
                  ],
                ),
              ),
          ]),
        ],
        SectionHeader(l.overviewMovementsTitle, actionLabel: l.overviewAllShipments, onAction: () => onNavigate(HomeTab.shipments)),
        if (overview.shipments.isEmpty)
          EmptyState(
            icon: Icons.inventory_2_outlined,
            title: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredTitle : l.overviewEmptyNoneTitle,
            description: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredDescription : l.overviewEmptyNoneDescription,
          )
        else
          Panel(children: [for (final shipment in overview.shipments.take(5)) ShipmentTile(shipment)]),
        SectionHeader(l.overviewPaperworkTitle, actionLabel: l.overviewAllDocuments, onAction: () => onNavigate(HomeTab.documents)),
        if (overview.documents.isEmpty)
          EmptyState(icon: Icons.description_outlined, title: l.overviewNoDocumentsTitle, description: l.overviewNoDocumentsDescription)
        else
          Panel(children: [for (final document in overview.documents.take(3)) DocumentTile(document)]),
      ],
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow(this.left, this.right);
  final Widget left;
  final Widget right;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [Expanded(child: left), const SizedBox(width: 10), Expanded(child: right)],
        ),
      );
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value, this.tone, this.onTap});
  final String label;
  final int value;
  final Tone? tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = tone == null ? theme.colorScheme.onSurface : ToneColors.of(context, tone!).foreground;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 10),
              Text('$value',
                  style: theme.textTheme.headlineSmall?.copyWith(color: color, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
        ),
      ),
    );
  }
}
