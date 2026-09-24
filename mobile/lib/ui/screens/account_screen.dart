import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/common.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.version});
  final String version;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final controller = AppScope.of(context);
    final session = controller.session;
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    final language = Localizations.localeOf(context).languageCode;

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        if (session != null) ...[
          SectionHeader(l.settingsSignedInAs),
          Panel(children: [
            InfoRow(l.emailLabel, session.email, stacked: true),
            InfoRow(l.settingsAccount, session.customerName, stacked: true),
            InfoRow(l.settingsAccessLevel, session.role == 'owner' ? l.roleOwner : l.roleMember),
          ]),
          if (session.customers.length > 1) ...[
            SectionHeader(l.switchAccount),
            RadioGroup<String>(
              groupValue: session.customerId,
              onChanged: (id) async {
                if (id == null || id == session.customerId) return;
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await controller.switchCustomer(id);
                } catch (_) {
                  messenger.showSnackBar(SnackBar(content: Text(l.chromeAccountSwitchFailed)));
                }
              },
              child: Panel(children: [
                for (final customer in session.customers) RadioListTile<String>(value: customer.id, title: Text(customer.name)),
              ]),
            ),
          ],
        ],
        SectionHeader(l.settingsLanguage),
        RadioGroup<String>(
          groupValue: language,
          onChanged: (value) => controller.setLocale(Locale(value!)),
          child: Panel(children: [
            for (final (code, name) in const [('en', 'English'), ('ne', 'नेपाली')])
              RadioListTile<String>(value: code, title: Text(name)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text(l.settingsProvisioningNote, style: muted),
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: OutlinedButton.icon(
            onPressed: controller.signOut,
            icon: const Icon(Icons.logout_rounded),
            label: Text(l.signOut),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
        ),
        const SizedBox(height: 16),
        Center(child: Text(l.appVersion(version), style: muted)),
      ],
    );
  }
}
