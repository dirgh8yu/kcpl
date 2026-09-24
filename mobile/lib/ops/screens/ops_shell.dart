import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ui/motion.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart' show autoRefreshEvery;
import '../ops_controller.dart';
import 'alerts_screen.dart';
import 'jobs_screen.dart';
import 'me_screen.dart';
import 'today_screen.dart';

class OpsShell extends StatefulWidget {
  const OpsShell({super.key, required this.demo, required this.version});
  final bool demo;
  final String version;

  @override
  State<OpsShell> createState() => _OpsShellState();
}

class _OpsShellState extends State<OpsShell> with WidgetsBindingObserver {
  OpsTab _tab = OpsTab.today;
  final Set<OpsTab> _visited = {OpsTab.today};
  int _selections = 0;

  Timer? _badgeTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // The badge should be right before Alerts is ever opened, and stay right
    // on every tab: counted now, then every minute while the app is open.
    WidgetsBinding.instance.addPostFrameCallback((_) => _countUnread());
    _badgeTimer = Timer.periodic(autoRefreshEvery, (_) => _countUnread());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _badgeTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _badgeTimer?.cancel();
    _badgeTimer = null;
    if (state != AppLifecycleState.resumed) return;
    _countUnread();
    _badgeTimer = Timer.periodic(autoRefreshEvery, (_) => _countUnread());
  }

  Future<void> _countUnread() async {
    if (!mounted) return;
    final controller = OpsScope.read(context);
    try {
      controller.setUnread((await controller.api.alerts()).unreadCount);
    } catch (_) {
      // A missing badge is not worth an error; Alerts will say why.
    }
  }

  void _select(OpsTab tab) {
    if (tab == _tab) return;
    HapticFeedback.selectionClick();
    setState(() {
      _tab = tab;
      _visited.add(tab);
      _selections++;
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final unread = OpsScope.of(context).unread;
    const labels = {OpsTab.today: 'Today', OpsTab.jobs: 'Jobs', OpsTab.alerts: 'Alerts', OpsTab.me: 'Me'};
    const icons = {
      OpsTab.today: (Icons.wb_sunny_outlined, Icons.wb_sunny_rounded),
      OpsTab.jobs: (Icons.inventory_2_outlined, Icons.inventory_2_rounded),
      OpsTab.alerts: (Icons.notifications_none_rounded, Icons.notifications_rounded),
      OpsTab.me: (Icons.person_outline_rounded, Icons.person_rounded),
    };

    Widget screen(OpsTab tab) => switch (tab) {
          OpsTab.today => TodayScreen(onNavigate: _select),
          OpsTab.jobs => const JobsScreen(),
          OpsTab.alerts => const AlertsScreen(),
          OpsTab.me => MeScreen(version: widget.version),
        };

    Widget icon(OpsTab tab, IconData data) => tab == OpsTab.alerts
        ? Badge(
            isLabelVisible: unread > 0,
            backgroundColor: p.accent,
            textColor: Colors.white,
            label: Text(unread > 99 ? '99+' : '$unread'),
            child: Icon(data),
          )
        : Icon(data);

    return Scaffold(
      body: IndexedStack(
        index: _tab.index,
        // Hidden tabs have tickers off: their animations stop, and their
        // pages know not to refresh until they are shown again.
        children: [
          for (final tab in OpsTab.values)
            TickerMode(enabled: tab == _tab, child: _visited.contains(tab) ? screen(tab) : const SizedBox.shrink()),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: p.hairline, width: 0.5))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (widget.demo)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Demo data, not real operations', style: context.type.labelSmall?.copyWith(color: p.tertiary)),
            ),
          NavigationBar(
            selectedIndex: _tab.index,
            onDestinationSelected: (index) => _select(OpsTab.values[index]),
            destinations: [
              for (final tab in OpsTab.values)
                NavigationDestination(
                  icon: icon(tab, icons[tab]!.$1),
                  selectedIcon: PopIn(key: ValueKey('$tab-$_selections'), child: icon(tab, icons[tab]!.$2)),
                  label: labels[tab]!,
                ),
            ],
          ),
        ]),
      ),
    );
  }
}
