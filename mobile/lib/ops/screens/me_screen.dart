import 'package:flutter/material.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/large_title.dart';
import '../../ui/widgets/push_ui.dart';
import '../../ui/widgets/tab_bar.dart' show KTabBar;
import '../ops_controller.dart';
import '../ops_format.dart';

class MeScreen extends StatelessWidget {
  const MeScreen({super.key, required this.version});
  final String version;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final controller = OpsScope.of(context);
    final session = controller.session;
    return CustomScrollView(
      slivers: [
        const LargeTitleBar(title: 'Me'),
        SliverList(
          delegate: SliverChildListDelegate([
            if (session != null) ...[
              GroupCard(
                padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: p.fill,
                      child: Text(initials(session.displayName), style: context.type.headlineSmall?.copyWith(color: p.secondary)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(session.displayName, style: context.type.headlineSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 1),
                          Text(
                            session.email,
                            style: context.type.bodyMedium?.copyWith(color: p.secondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              RowGroup(
                children: [
                  DetailRow('Role', session.roleLabel),
                  DetailRow('Branches', session.canAccessAllBranches ? 'All branches' : session.branches.join(', ')),
                  DetailRow('Costs and margins', session.canViewCosts ? 'Visible' : 'Not shared with this role'),
                ],
              ),
            ],
            const Footnote('Roles and branch access are managed by KCPL Management in the web admin.'),
            const SectionHeader('Notifications'),
            const RowGroup(children: [PushSettingRow(copy: opsPushCopy)]),
            const SizedBox(height: 28),
            RowGroup(
              children: [
                RowTile(
                  onTap: controller.signOut,
                  title: Center(
                    child: Text('Sign out', style: TextStyle(color: p.accent)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Center(child: Text('KCPL Ops $version', style: context.type.bodySmall)),
            SizedBox(height: KTabBar.height + 28 + MediaQuery.paddingOf(context).bottom),
          ]),
        ),
      ],
    );
  }
}
