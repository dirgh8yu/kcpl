import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/choice_rows.dart';
import '../widgets/common.dart';
import '../widgets/large_title.dart';
import '../widgets/push_ui.dart';
import '../widgets/tab_bar.dart' show KTabBar;

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.version});
  final String version;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final controller = AppScope.of(context);
    final session = controller.session;
    final language = Localizations.localeOf(context).languageCode;
    final name = session?.displayName ?? '';
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();

    return CustomScrollView(
      slivers: [
        LargeTitleBar(title: l.chromeAccount),
        SliverList(
          delegate: SliverChildListDelegate([
            if (session != null) ...[
              // Who is signed in, as Settings heads itself with the Apple ID.
              GroupCard(
                padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: p.fill,
                      child: Text(initial, style: context.type.headlineSmall?.copyWith(color: p.secondary)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: context.type.headlineSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
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
                  DetailRow(l.settingsAccount, session.customerName),
                  DetailRow(l.settingsAccessLevel, session.role == 'owner' ? l.roleOwner : l.roleMember),
                ],
              ),
              if (session.customers.length > 1) ...[
                SectionHeader(l.switchAccount),
                RowGroup(
                  children: [
                    for (final customer in session.customers)
                      CheckRow(
                        label: customer.name,
                        selected: customer.id == session.customerId,
                        onTap: () => switchCustomer(context, customer.id),
                      ),
                  ],
                ),
              ],
            ],
            SectionHeader(l.pushSection),
            RowGroup(children: [PushSettingRow(copy: customerPushCopy(l))]),
            SectionHeader(l.settingsLanguage),
            RowGroup(
              children: [
                for (final (code, label) in const [('en', 'English'), ('ne', 'नेपाली')])
                  CheckRow(label: label, selected: language == code, onTap: () => controller.setLocale(Locale(code))),
              ],
            ),
            Footnote(l.settingsProvisioningNote),
            const SizedBox(height: 28),
            RowGroup(
              children: [
                RowTile(
                  onTap: controller.signOut,
                  title: Center(
                    child: Text(l.signOut, style: TextStyle(color: p.accent)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Center(child: Text(l.appVersion(version), style: context.type.bodySmall)),
            SizedBox(height: KTabBar.height + 28 + MediaQuery.paddingOf(context).bottom),
          ]),
        ),
      ],
    );
  }
}
