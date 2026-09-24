import 'package:flutter/material.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/large_title.dart';
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
    return CustomScrollView(slivers: [
      const LargeTitleBar(title: 'Me'),
      SliverList(
        delegate: SliverChildListDelegate([
          if (session != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
              child: Row(children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: p.ink,
                  child: Text(initials(session.displayName), style: context.type.titleLarge?.copyWith(color: p.paper)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(session.displayName, style: context.type.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(session.email, style: context.type.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            RowGroup(children: [
              DetailRow('Role', session.roleLabel),
              DetailRow('Branches', session.canAccessAllBranches ? 'All branches' : session.branches.join(', ')),
              DetailRow('Costs and margins', session.canViewCosts ? 'Visible' : 'Not shared with this role'),
            ]),
          ],
          const Footnote('Roles and branch access are managed by KCPL Management in the web admin.'),
          const SizedBox(height: 28),
          const Divider(indent: kGutter, endIndent: kGutter),
          RowTile(onTap: controller.signOut, title: Text('Sign out', style: TextStyle(color: p.accent))),
          const Divider(indent: kGutter, endIndent: kGutter),
          const SizedBox(height: 20),
          Center(child: Text('KCPL Ops $version', style: context.type.bodySmall)),
          const SizedBox(height: 40),
        ]),
      ),
    ]);
  }
}
