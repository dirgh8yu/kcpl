import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/tab_bar.dart';
import '../../ui/widgets/push_ui.dart';
import '../ops_rows.dart' show openJob;
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
    });
  }

  @override
  Widget build(BuildContext context) {
    final unread = OpsScope.of(context).unread;
    const labels = {OpsTab.today: 'Today', OpsTab.jobs: 'Jobs', OpsTab.alerts: 'Alerts', OpsTab.me: 'Me'};
    const icons = {
      OpsTab.today: (KIcons.today, KIcons.todayOn),
      OpsTab.jobs: (KIcons.shipments, KIcons.shipmentsOn),
      OpsTab.alerts: (KIcons.alerts, KIcons.alertsOn),
      OpsTab.me: (KIcons.account, KIcons.accountOn),
    };

    Widget screen(OpsTab tab) => switch (tab) {
      OpsTab.today => TodayScreen(onNavigate: _select),
      OpsTab.jobs => const JobsScreen(),
      OpsTab.alerts => const AlertsScreen(),
      OpsTab.me => MeScreen(version: widget.version),
    };

    // A tapped notification opens its job, or the Alerts tab.
    return PushRouter(
      onTarget: (context, target) {
        final reference = target.reference;
        if (target.kind == 'job' && reference != null) {
          openJob(context, reference);
        } else {
          _select(OpsTab.alerts);
        }
      },
      child: Scaffold(
        // Content runs beneath the tab bar and shows through its frosted glass.
        extendBody: true,
        body: IndexedStack(
          index: _tab.index,
          // Hidden tabs have tickers off: their animations stop, and their
          // pages know not to refresh until they are shown again.
          children: [
            for (final tab in OpsTab.values)
              TickerMode(enabled: tab == _tab, child: _visited.contains(tab) ? screen(tab) : const SizedBox.shrink()),
          ],
        ),
        bottomNavigationBar: FloatingTabBar(
          note: widget.demo ? 'Demo data, not real operations' : null,
          selected: _tab.index,
          onSelected: (index) => _select(OpsTab.values[index]),
          items: [
            for (final tab in OpsTab.values)
              TabItem(
                icon: icons[tab]!.$1,
                selectedIcon: icons[tab]!.$2,
                label: labels[tab]!,
                badge: tab == OpsTab.alerts ? unread : 0,
              ),
          ],
        ),
      ),
    );
  }
}
