import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
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

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final session = AppScope.of(context).session;
    final canViewFinance = session?.canViewFinance ?? false;
    // A login without finance access never sees the tab, as on the web.
    final tabs = [for (final tab in HomeTab.values) if (tab != HomeTab.invoices || canViewFinance) tab];
    final tab = tabs.contains(_tab) ? _tab : HomeTab.overview;

    final titles = {
      HomeTab.overview: l.chromeOverview,
      HomeTab.shipments: l.chromeShipments,
      HomeTab.documents: l.chromeDocuments,
      HomeTab.invoices: l.chromeInvoices,
      HomeTab.account: l.chromeAccount,
    };
    final icons = {
      HomeTab.overview: (Icons.space_dashboard_outlined, Icons.space_dashboard_rounded),
      HomeTab.shipments: (Icons.inventory_2_outlined, Icons.inventory_2_rounded),
      HomeTab.documents: (Icons.description_outlined, Icons.description_rounded),
      HomeTab.invoices: (Icons.receipt_long_outlined, Icons.receipt_long_rounded),
      HomeTab.account: (Icons.account_circle_outlined, Icons.account_circle_rounded),
    };

    final Widget body = switch (tab) {
      HomeTab.overview => OverviewScreen(onNavigate: (next) => setState(() => _tab = next)),
      HomeTab.shipments => const ShipmentsScreen(),
      HomeTab.documents => const DocumentsScreen(),
      HomeTab.invoices => const InvoicesScreen(),
      HomeTab.account => AccountScreen(version: widget.version),
    };

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titles[tab]!, style: theme.appBarTheme.titleTextStyle),
            if (session != null)
              Text(
                session.customerName,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        bottom: widget.demo
            ? PreferredSize(
                preferredSize: const Size.fromHeight(28),
                child: Container(
                  height: 28,
                  width: double.infinity,
                  alignment: Alignment.center,
                  color: ToneColors.of(context, Tone.warning).background,
                  child: Text(l.demoBanner,
                      style: theme.textTheme.labelSmall?.copyWith(color: ToneColors.of(context, Tone.warning).foreground)),
                ),
              )
            : null,
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 160),
        switchInCurve: Curves.easeOut,
        child: KeyedSubtree(key: ValueKey(tab), child: body),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabs.indexOf(tab),
        onDestinationSelected: (index) => setState(() => _tab = tabs[index]),
        destinations: [
          for (final item in tabs)
            NavigationDestination(icon: Icon(icons[item]!.$1), selectedIcon: Icon(icons[item]!.$2), label: titles[item]!),
        ],
      ),
    );
  }
}
