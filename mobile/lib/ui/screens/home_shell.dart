import 'dart:async';

import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/push_ui.dart';
import '../widgets/rows.dart' show openInvoice, openShipment;
import '../widgets/tab_bar.dart';
import '../../platform/app_shortcuts.dart';
import 'quote_screen.dart' show openQuote;
import 'account_screen.dart';
import 'documents_screen.dart';
import 'invoices_screen.dart';
import 'overview_screen.dart';
import 'shipments_screen.dart';
import '../widgets/sheet_route.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.demo, required this.version});
  final bool demo;
  final String version;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  HomeTab _tab = HomeTab.overview;

  /// Tabs are built on first visit and then kept, so switching back keeps
  /// the scroll position and never refetches, as native tab bars do.
  final Set<HomeTab> _visited = {HomeTab.overview};

  /// A tap on the home screen widget opens the shipment it shows.
  StreamSubscription<String>? _widgetTaps;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final controller = AppScope.read(context);
    _widgetTaps ??= controller.homeWidget.opened.listen((reference) {
      if (mounted) openShipment(context, reference);
    });
    if (_shortcuts == null) {
      _shortcuts = controller.shortcuts;
      _shortcuts!.pending.addListener(_onShortcut);
      // One chosen before sign-in (or that launched the app) is taken now.
      WidgetsBinding.instance.addPostFrameCallback((_) => _onShortcut());
    }
    // The icon's menu, in the reader's language and for what this login may do.
    final l = AppLocalizations.of(context);
    final session = controller.session;
    controller.shortcuts
        .offer(
          track: l.qaTrack,
          quote: session?.canSubmitRequests ?? false ? l.qaQuote : null,
          pay: session?.canViewFinance ?? false ? l.qaPay : null,
        )
        .ignore();
  }

  AppShortcuts? _shortcuts;

  void _onShortcut() {
    final shortcuts = _shortcuts;
    final action = shortcuts?.pending.value;
    if (shortcuts == null || action == null || !mounted) return;
    shortcuts.consume();
    final session = AppScope.read(context).session;
    // Whatever was open gives way to the shortcut.
    Navigator.of(context).popUntil((route) => route.isFirst);
    switch (action) {
      case Shortcut.track:
        _select(HomeTab.shipments);
      case Shortcut.quote when session?.canSubmitRequests ?? false:
        _select(HomeTab.overview);
        openQuote(context);
      case Shortcut.pay when session?.canViewFinance ?? false:
        _select(HomeTab.invoices);
    }
  }

  @override
  void dispose() {
    _widgetTaps?.cancel();
    _shortcuts?.pending.removeListener(_onShortcut);
    super.dispose();
  }

  void _select(HomeTab tab) {
    if (tab == _tab) return;
    setState(() {
      _tab = tab;
      _visited.add(tab);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final session = AppScope.of(context).session;
    final canViewFinance = session?.canViewFinance ?? false;
    // A login without finance access never sees the tab, as on the web.
    final tabs = [
      for (final tab in HomeTab.values)
        if (tab != HomeTab.invoices || canViewFinance) tab,
    ];
    final tab = tabs.contains(_tab) ? _tab : HomeTab.overview;

    final labels = {
      HomeTab.overview: l.chromeOverview,
      HomeTab.shipments: l.chromeShipments,
      HomeTab.documents: l.chromeDocuments,
      HomeTab.invoices: l.chromeInvoices,
      HomeTab.account: l.chromeAccount,
    };
    const icons = {
      HomeTab.overview: (KIcons.home, KIcons.homeOn),
      HomeTab.shipments: (KIcons.shipments, KIcons.shipmentsOn),
      HomeTab.documents: (KIcons.document, KIcons.documentsOn),
      HomeTab.invoices: (KIcons.invoices, KIcons.invoicesOn),
      HomeTab.account: (KIcons.account, KIcons.accountOn),
    };

    Widget screen(HomeTab item) => switch (item) {
      HomeTab.overview => OverviewScreen(onNavigate: _select),
      HomeTab.shipments => const ShipmentsScreen(),
      HomeTab.documents => const DocumentsScreen(),
      HomeTab.invoices => const InvoicesScreen(),
      HomeTab.account => AccountScreen(version: widget.version),
    };

    // A tapped notification opens what it is about: a shipment, or an
    // invoice due or overdue, where Pay online is one tap away.
    return PushRouter(
      onTarget: (context, target) {
        final reference = target.reference;
        if (reference == null) return;
        if (target.kind == 'shipment') openShipment(context, reference);
        if (target.kind == 'invoice') openInvoice(context, reference);
      },
      // Recedes while a detail sheet is up over it.
      child: SheetDepth(
        child: Scaffold(
          // Content runs beneath the tab bar and shows through its frosted glass.
          extendBody: true,
          body: IndexedStack(
            index: tabs.indexOf(tab),
            // Hidden tabs have tickers off: their animations stop, and their
            // pages know not to refresh until they are shown again.
            children: [
              for (final item in tabs)
                TickerMode(enabled: item == tab, child: _visited.contains(item) ? screen(item) : const SizedBox.shrink()),
            ],
          ),
          bottomNavigationBar: KTabBar(
            note: widget.demo ? l.demoBanner : null,
            selected: tabs.indexOf(tab),
            onSelected: (index) => _select(tabs[index]),
            items: [for (final item in tabs) TabItem(icon: icons[item]!.$1, selectedIcon: icons[item]!.$2, label: labels[item]!)],
          ),
        ),
      ),
    );
  }
}
