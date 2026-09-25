import 'package:flutter/material.dart';

import '../../ui/theme.dart';
import '../../ui/widgets/choice_rows.dart' show CheckRow;
import '../../ui/widgets/common.dart';
import '../../ui/widgets/large_title.dart';
import '../../ui/widgets/push_ui.dart';
import '../../ui/widgets/tab_bar.dart' show KTabBar;
import '../ops_controller.dart';
import '../ops_format.dart';
import '../ops_l10n.dart';

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
        LargeTitleBar(title: context.l.opsMe),
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
                  DetailRow(context.l.opsRole, session.roleLabel),
                  DetailRow(context.l.opsBranches, session.canAccessAllBranches ? context.l.opsAllBranches : session.branches.join(', ')),
                  DetailRow(context.l.opsCostsAndMargins, session.canViewCosts ? context.l.opsVisible : context.l.opsNotShared),
                ],
              ),
            ],
            Footnote(context.l.opsRolesFootnote),
            SectionHeader(context.l.opsNotifications),
            RowGroup(children: [PushSettingRow(copy: opsPushCopy(context.l))]),
            SectionHeader(context.l.opsLanguage),
            RowGroup(
              children: [
                for (final (code, label) in const [('en', 'English'), ('ne', 'नेपाली')])
                  CheckRow(label: label, selected: controller.locale.languageCode == code, onTap: () => controller.setLocale(Locale(code))),
              ],
            ),
            Footnote(context.l.opsLanguageFootnote),
            const SizedBox(height: 28),
            RowGroup(
              children: [
                RowTile(
                  onTap: controller.signOut,
                  title: Center(
                    child: Text(context.l.opsSignOut, style: TextStyle(color: p.accent)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Center(child: Text(context.l.opsVersion(version), style: context.type.bodySmall)),
            SizedBox(height: KTabBar.height + 28 + MediaQuery.paddingOf(context).bottom),
          ]),
        ),
      ],
    );
  }
}
