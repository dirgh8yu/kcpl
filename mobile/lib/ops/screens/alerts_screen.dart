import 'package:flutter/material.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/async_view.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/journey.dart' show IconTile;
import '../ops_controller.dart';
import '../ops_format.dart';
import '../ops_models.dart';
import '../ops_rows.dart';

IconData alertIcon(String category) => switch (category) {
  'assignments' => KIcons.userPlus,
  'tasks' => KIcons.tasks,
  'customs' => KIcons.customs,
  'documents' => KIcons.document,
  'finance' => KIcons.wallet,
  'quotes' => KIcons.invoice,
  _ => KIcons.truck,
};

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final Set<String> _readHere = {};

  Future<void> _open(OpsAlert alert, int unreadAtLoad) async {
    final controller = OpsScope.read(context);
    if (alert.unread && _readHere.add(alert.id)) {
      setState(() {});
      controller.setUnread((unreadAtLoad - _readHere.length).clamp(0, 9999));
      // Best effort: a failed receipt only means it shows unread again later.
      controller.api.markRead(alert.id).ignore();
    }
    final reference = alert.jobReference;
    if (reference != null && mounted) openJob(context, reference);
  }

  @override
  Widget build(BuildContext context) {
    final controller = OpsScope.of(context);
    return AsyncPage<AlertsPage>(
      title: 'Alerts',
      load: () async {
        final page = await controller.api.alerts();
        _readHere.clear();
        controller.setUnread(page.unreadCount);
        return page;
      },
      builder: (context, page) {
        if (page.alerts.isEmpty) {
          return const [
            EmptyState(icon: KIcons.alerts, title: 'All caught up', description: 'Alerts for your branches and jobs appear here.'),
          ];
        }
        final p = context.palette;
        return [
          RowGroup(
            indent: RowGroup.iconIndent,
            children: [
              for (final alert in page.alerts)
                Builder(
                  builder: (context) {
                    final unread = alert.unread && !_readHere.contains(alert.id);
                    final critical = alert.severity == 'critical';
                    return RowTile(
                      onTap: () => _open(alert, page.unreadCount),
                      leading: IconTile(icon: alertIcon(alert.category), attention: critical, muted: !unread),
                      title: Text(
                        alert.title,
                        style: TextStyle(fontWeight: unread ? FontWeight.w600 : FontWeight.w400, color: unread ? p.ink : p.secondary),
                      ),
                      subtitle: Text(
                        '${alert.detail.isEmpty ? '' : '${alert.detail}\n'}${ago(alert.createdAt)}${alert.branch == null ? '' : ' · ${alert.branch}'}',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: AnimatedOpacity(
                        opacity: unread ? 1 : 0,
                        duration: const Duration(milliseconds: 180),
                        child: StatusDot(emphasis: critical ? Emphasis.attention : Emphasis.normal, size: 8),
                      ),
                    );
                  },
                ),
            ],
          ),
        ];
      },
    );
  }
}
