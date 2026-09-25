import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'quote_screen.dart';

import '../../api/models.dart';
import '../../api/offline_cache.dart';
import '../../platform/home_widget_bridge.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../map/route_map.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/choice_rows.dart';
import '../widgets/common.dart';
import '../widgets/detent_sheet.dart';
import '../widgets/journey.dart';
import '../widgets/push_ui.dart';
import '../widgets/rows.dart';

export '../widgets/shipment_card.dart' show JourneyGraphic;

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

/// Active shipments, the lead one first.
List<Shipment> activeShipments(List<Shipment> shipments) {
  final hero = heroShipment(shipments);
  return [?hero, ...shipments.where((s) => !s.delivered && s != hero)];
}

/// Home, as a ride-hailing app opens: the map fills the screen with every
/// shipment on its way, and a sheet over it says how things stand and lists
/// them. Pull the sheet up for the rest of the account.
class OverviewScreen extends StatefulWidget {
  const OverviewScreen({super.key, required this.onNavigate});
  final ValueChanged<HomeTab> onNavigate;

  @override
  State<OverviewScreen> createState() => _OverviewScreenState();
}

class _OverviewScreenState extends State<OverviewScreen> {
  final _extent = ValueNotifier<double>(0);
  bool _refreshing = false;

  Future<void> _pullToRefresh(Future<void> Function() refresh) async {
    if (_refreshing) return;
    setState(() => _refreshing = true);
    try {
      await refresh();
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  void dispose() {
    _extent.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final l = AppLocalizations.of(context);
    return AsyncPage<OverviewBundle>.custom(
      load: () async {
        final bundle = await controller.api.overview();
        controller.updateSession(bundle.session);
        // The widget shows only what was true just now, never a kept answer.
        if (!OfflineReport.servedOffline) {
          unawaited(controller.homeWidget.publish(widgetSnapshot(l, bundle.overview), emptyTitle: l.homeOnTheWay(0)));
        }
        return bundle;
      },
      layout: _layout,
    );
  }

  Widget _layout(BuildContext context, OverviewBundle? bundle, Widget? failure, Future<void> Function() refresh) {
    final p = context.palette;
    final media = MediaQuery.of(context);
    // The tab bar's height, which the scaffold reports as bottom padding.
    final chrome = media.padding.bottom;
    final active = bundle == null ? const <Shipment>[] : activeShipments(bundle.overview.shipments);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: p.isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final height = constraints.maxHeight;
          final top = media.padding.top;
          final peek = chrome + 150;
          final half = math.max(peek + 140, height * 0.5);
          final full = height - top - 8;
          final detents = [peek, half, full];
          return Stack(
            children: [
              Positioned.fill(
                child: FleetMap(
                  style: RouteMapStyle.page(p),
                  focus: active.firstOrNull?.reference,
                  padding: EdgeInsets.fromLTRB(28, top + 36, 28, half + 16),
                  routes: [
                    for (final s in active)
                      FleetRoute(
                        id: s.reference,
                        origin: s.origin,
                        destination: s.destination,
                        current: s.currentLocation,
                        progress: journeyFraction(s.status),
                        vehicle: modeSolidIcon(s.mode),
                        attention: s.status == 'exception',
                      ),
                  ],
                ),
              ),
              // The map dims as the sheet comes up over it, as iOS dims what
              // a sheet covers.
              Positioned.fill(
                child: IgnorePointer(
                  child: ValueListenableBuilder<double>(
                    valueListenable: _extent,
                    builder: (context, extent, _) {
                      final t = ((extent - half) / (full - half)).clamp(0.0, 1.0);
                      return t == 0 ? const SizedBox.shrink() : ColoredBox(color: Colors.black.withValues(alpha: 0.22 * t));
                    },
                  ),
                ),
              ),
              DetentSheet(
                detents: (_) => detents,
                initial: 1,
                extent: _extent,
                onRefresh: () => _pullToRefresh(refresh),
                builder: (context, sheet) => _Sheet(
                  controller: sheet,
                  refreshing: _refreshing,
                  bundle: bundle,
                  active: active,
                  failure: failure,
                  bottom: chrome,
                  onNavigate: widget.onNavigate,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The sheet over the map: a grabber, how things stand, then the account
/// in grouped cards.
class _Sheet extends StatelessWidget {
  const _Sheet({
    required this.controller,
    required this.refreshing,
    required this.bundle,
    required this.active,
    required this.failure,
    required this.bottom,
    required this.onNavigate,
  });
  final DetentSheetController controller;
  final bool refreshing;
  final OverviewBundle? bundle;
  final List<Shipment> active;
  final Widget? failure;
  final double bottom;
  final ValueChanged<HomeTab> onNavigate;

  @override
  Widget build(BuildContext context) {
    final theme = raisedTheme(Theme.of(context));
    final p = theme.extension<Palette>()!;
    final bundle = this.bundle;
    return Theme(
      data: theme,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: p.paper,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: p.isDark ? 0.5 : 0.1),
              blurRadius: 24,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: CustomScrollView(
              controller: controller,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _Grabber(onTap: controller.cycle)),
                if (bundle != null)
                  SliverList(delegate: SliverChildListDelegate(_body(context, bundle)))
                else if (failure != null)
                  SliverToBoxAdapter(child: failure)
                else
                  const SliverToBoxAdapter(child: Skeleton(rows: 4)),
                SliverToBoxAdapter(child: SizedBox(height: bottom + 28)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, OverviewBundle bundle) {
    final l = AppLocalizations.of(context);
    final overview = bundle.overview;
    final session = bundle.session;
    final finance = session.canViewFinance ? overview.finance : null;
    final needsYou = overview.freeTime.isNotEmpty || overview.outstanding.isNotEmpty;

    return [
      _Headline(session: session, overview: overview, active: active.length, refreshing: refreshing),
      // A new shipment starts the way a ride does: where is it going?
      if (session.canSubmitRequests) _WhereTo(onTap: () => openQuote(context, recent: recentPlaces(overview.shipments))),
      PushPrimer(copy: customerPushCopy(l)),
      if (needsYou) ...[
        SectionHeader(l.homeNeedsYou, top: 20),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final row in overview.freeTime)
              RowTile(
                onTap: () => openShipment(context, row.reference),
                leading: IconTile(icon: KIcons.timer, attention: freeTimeEmphasis(row.status) == Emphasis.attention),
                title: Text(freeTimeSummary(l, row.location, row.status)),
                subtitle: Text('${row.reference} · ${l.freeTimeDeadline} ${formatShortDate(row.status.deadline)}'),
                chevron: true,
              ),
            for (final item in overview.outstanding)
              RowTile(
                onTap: () => openShipment(context, item.reference),
                leading: const IconTile(icon: KIcons.upload, attention: true),
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
      SectionHeader(
        l.overviewMovementsTitle,
        top: needsYou ? 28 : 20,
        actionLabel: l.overviewAllShipments,
        onAction: () => onNavigate(HomeTab.shipments),
      ),
      if (active.isEmpty)
        GroupCard(
          child: EmptyState(
            icon: KIcons.shipments,
            title: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredTitle : l.overviewEmptyNoneTitle,
            description: overview.deliveredCount > 0 ? l.overviewEmptyDeliveredDescription : l.overviewEmptyNoneDescription,
          ),
        )
      else
        RowGroup(indent: RowGroup.iconIndent, children: [for (final shipment in active.take(8)) ShipmentRow(shipment)]),
      if (finance != null && finance.balances.isNotEmpty) ...[
        SectionHeader(l.overviewAccountTitle, actionLabel: l.overviewViewInvoices, onAction: () => onNavigate(HomeTab.invoices)),
        RowGroup(children: [for (final balance in finance.balances) BalanceFigure(balance: balance)]),
      ],
      SectionHeader(l.overviewPaperworkTitle, actionLabel: l.overviewAllDocuments, onAction: () => onNavigate(HomeTab.documents)),
      if (overview.documents.isEmpty)
        GroupCard(
          child: EmptyState(icon: KIcons.document, title: l.overviewNoDocumentsTitle, description: l.overviewNoDocumentsDescription),
        )
      else
        RowGroup(indent: RowGroup.iconIndent, children: [for (final document in overview.documents.take(3)) DocumentRowTile(document)]),
    ];
  }
}

/// "Where is your cargo going?": the way into a quote request, as a
/// ride-hailing app leads with "Where to?".
class _WhereTo extends StatelessWidget {
  const _WhereTo({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter, 14, kGutter, 0),
      child: Pressable(
        child: Semantics(
          button: true,
          child: Material(
            color: p.surface,
            borderRadius: BorderRadius.circular(kCardRadius),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: SizedBox(
                height: 52,
                child: Row(
                  children: [
                    const SizedBox(width: kGutter),
                    Icon(KIcons.search, size: 20, color: p.ink),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(l.quoteWhereTo, style: context.type.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 8),
                    Icon(KIcons.chevron, size: 15, color: p.tertiary),
                    const SizedBox(width: kGutter),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The sheet's handle. A tap moves it to the next height.
class _Grabber extends StatelessWidget {
  const _Grabber({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: AppLocalizations.of(context).sheetGrabber,
    onTap: onTap,
    excludeSemantics: true,
    child: GestureDetector(
      key: const ValueKey('home-sheet-grabber'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: 22,
        child: Align(
          alignment: const Alignment(0, -0.2),
          child: Container(
            width: 36,
            height: 5,
            decoration: BoxDecoration(color: context.palette.tertiary, borderRadius: BorderRadius.circular(3)),
          ),
        ),
      ),
    ),
  );
}

/// How things stand, in a sentence and a line: which account, how many
/// shipments are on their way, and whether any needs the customer.
class _Headline extends StatelessWidget {
  const _Headline({required this.session, required this.overview, required this.active, required this.refreshing});
  final SessionView session;
  final Overview overview;
  final int active;

  /// A pull to refresh is under way: a small spinner beside the account.
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final many = session.customers.length > 1;
    final attention = overview.attentionCount;
    final arriving = overview.arrivingCount;
    final account = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: Text(
            session.customerName,
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (many) ...[const SizedBox(width: 3), Icon(KIcons.expand, size: 13, color: p.secondary)],
        if (refreshing) ...[const SizedBox(width: 8), CupertinoActivityIndicator(radius: 7, color: p.secondary)],
      ],
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter + 4, 2, kGutter + 4, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // An agent switches customer from here.
          if (many) GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => showCustomerSheet(context), child: account) else account,
          const SizedBox(height: 2),
          Text(l.homeOnTheWay(active), style: context.type.headlineMedium),
          const SizedBox(height: 3),
          Text.rich(
            TextSpan(
              children: [
                if (attention > 0)
                  TextSpan(
                    text: l.homeNeedsAttention(attention),
                    style: TextStyle(color: p.accent),
                  ),
                if (attention > 0 && arriving > 0) const TextSpan(text: '  ·  '),
                if (arriving > 0) TextSpan(text: l.homeArriving(arriving)),
                if (attention == 0 && arriving == 0 && active > 0) TextSpan(text: l.homeAllClear),
              ],
            ),
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
          ),
        ],
      ),
    );
  }
}

/// One currency's balance as a row: the amount outstanding, and whether
/// any of it is overdue.
class BalanceFigure extends StatelessWidget {
  const BalanceFigure({super.key, required this.balance, this.detail = false});
  final CurrencyBalance balance;
  final bool detail;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.overviewCurrencyOutstanding(balance.currency), style: context.type.bodySmall),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: FigureText(
              value: balance.outstanding,
              format: (v) => formatMoney(v, balance.currency),
              style: context.type.headlineMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
          const SizedBox(height: 4),
          if (balance.overdue > 0)
            StatusText(l.overviewAmountOverdue(formatMoney(balance.overdue, balance.currency)), Emphasis.attention)
          else
            StatusText(l.overviewNothingOverdue, Emphasis.muted),
          if (detail) ...[
            const SizedBox(height: 2),
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

/// The widget's glance, in the reader's language.
WidgetSnapshot? widgetSnapshot(AppLocalizations l, Overview overview) {
  final lead = leadShipment(overview.shipments);
  if (lead == null) return null;
  final active = activeShipments(overview.shipments).length;
  return WidgetSnapshot(
    reference: lead.reference,
    route: route(place(lead.origin), place(lead.destination)),
    status: statusLabel(l, lead.status),
    detail: lead.currentLocation != null && lead.status != 'booking_confirmed'
        ? l.overviewNowAt(lead.currentLocation!)
        : lead.eta != null
        ? l.shareExpected(formatDate(lead.eta))
        : '',
    progress: journeyFraction(lead.status),
    attention: statusEmphasis(lead.status) == Emphasis.attention,
    summary: l.homeOnTheWay(active),
  );
}
