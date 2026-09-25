import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/device_unlock.dart';
import '../theme.dart';
import '../widgets/choice_rows.dart';
import '../widgets/journey.dart' show IconTile;
import '../widgets/common.dart';
import '../widgets/large_title.dart';
import '../widgets/lock_gate.dart' show unlockMethodName;
import '../widgets/push_ui.dart';
import '../widgets/tab_bar.dart' show KTabBar;
import 'team_screen.dart';

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
                  // The server lists a team for owners only.
                  if (session.role == 'owner')
                    RowTile(
                      onTap: () => openTeam(context),
                      leading: const IconTile(icon: KIcons.people),
                      title: Text(l.teamTitle),
                      chevron: true,
                    ),
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
            // Offered only where the phone can prove its owner.
            if (controller.lock.method case final method?) ...[
              SectionHeader(l.lockSection),
              RowGroup(children: [_LockRow(method: method)]),
              Footnote(l.lockFootnote(unlockMethodName(l, method))),
            ],
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

class _LockRow extends StatelessWidget {
  const _LockRow({required this.method});
  final UnlockMethod method;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final lock = AppScope.of(context).lock;
    return ListenableBuilder(
      listenable: lock,
      builder: (context, _) => RowTile(
        title: Text(l.lockRequire(unlockMethodName(l, method))),
        trailing: Switch.adaptive(
          value: lock.enabled,
          activeTrackColor: p.ink,
          onChanged: (on) async {
            HapticFeedback.selectionClick();
            await lock.setEnabled(on, l.lockReason);
          },
        ),
      ),
    );
  }
}
