import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/push_ui.dart';
import '../widgets/rows.dart' show openShipment;
import '../widgets/tab_bar.dart';
import 'account_screen.dart';
import 'documents_screen.dart';
import 'invoices_screen.dart';
import 'overview_screen.dart';
import 'shipments_screen.dart';

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

  void _select(HomeTab tab) {
    if (tab == _tab) return;
    HapticFeedback.selectionClick();
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

    // A tapped notification opens the shipment it is about.
    return PushRouter(
      onTarget: (context, target) {
        final reference = target.reference;
        if (target.kind == 'shipment' && reference != null) openShipment(context, reference);
      },
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
        bottomNavigationBar: FloatingTabBar(
          note: widget.demo ? l.demoBanner : null,
          selected: tabs.indexOf(tab),
          onSelected: (index) => _select(tabs[index]),
          items: [for (final item in tabs) TabItem(icon: icons[item]!.$1, selectedIcon: icons[item]!.$2, label: labels[item]!)],
        ),
      ),
    );
  }
}
