import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/choice_rows.dart';
import '../widgets/common.dart';
import '../widgets/large_title.dart';
import '../widgets/push_ui.dart';

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

    return CustomScrollView(slivers: [
      LargeTitleBar(title: l.chromeAccount),
      SliverList(
        delegate: SliverChildListDelegate([
          if (session != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
              child: Row(children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: p.ink,
                  child: Text(initial, style: context.type.titleLarge?.copyWith(color: p.paper)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, style: context.type.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(session.email, style: context.type.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            RowGroup(children: [
              DetailRow(l.settingsAccount, session.customerName),
              DetailRow(l.settingsAccessLevel, session.role == 'owner' ? l.roleOwner : l.roleMember),
            ]),
            if (session.customers.length > 1) ...[
              SectionHeader(l.switchAccount),
              RowGroup(children: [
                for (final customer in session.customers)
                  CheckRow(
                    label: customer.name,
                    selected: customer.id == session.customerId,
                    onTap: () => switchCustomer(context, customer.id),
                  ),
              ]),
            ],
          ],
          SectionHeader(l.pushSection),
          PushSettingRow(copy: customerPushCopy(l)),
          SectionHeader(l.settingsLanguage),
          RowGroup(children: [
            for (final (code, label) in const [('en', 'English'), ('ne', 'नेपाली')])
              CheckRow(label: label, selected: language == code, onTap: () => controller.setLocale(Locale(code))),
          ]),
          Footnote(l.settingsProvisioningNote),
          const SizedBox(height: 28),
          const Divider(indent: kGutter, endIndent: kGutter),
          RowTile(
            onTap: controller.signOut,
            title: Text(l.signOut, style: TextStyle(color: p.accent)),
          ),
          const Divider(indent: kGutter, endIndent: kGutter),
          const SizedBox(height: 20),
          Center(child: Text(l.appVersion(version), style: context.type.bodySmall)),
          SizedBox(height: 40 + MediaQuery.paddingOf(context).bottom),
        ]),
      ),
    ]);
  }
}
