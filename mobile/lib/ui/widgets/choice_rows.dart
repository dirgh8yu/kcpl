import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';

/// A settings-style choice: the label, and a checkmark on the chosen one.
class CheckRow extends StatelessWidget {
  const CheckRow({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    inMutuallyExclusiveGroup: true,
    child: RowTile(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      title: Text(label),
      trailing: AnimatedSwitcher(
        duration: Motion.swap,
        switchInCurve: Motion.easeOut,
        transitionBuilder: morphTransition,
        child: selected
            ? Icon(KIcons.check, key: const ValueKey('on'), size: 20, color: context.palette.ink)
            : const SizedBox(key: ValueKey('off'), width: 22, height: 22),
      ),
    ),
  );
}

Future<void> switchCustomer(BuildContext context, String id) async {
  final controller = AppScope.read(context);
  final messenger = ScaffoldMessenger.of(context);
  final failed = AppLocalizations.of(context).chromeAccountSwitchFailed;
  if (id == controller.session?.customerId) return;
  try {
    await controller.switchCustomer(id);
  } catch (_) {
    messenger.showSnackBar(SnackBar(content: Text(failed)));
  }
}

/// The agent's customers in a sheet, from the name under the title.
Future<void> showCustomerSheet(BuildContext context) {
  final session = AppScope.read(context).session;
  if (session == null) return Future.value();
  final l = AppLocalizations.of(context);
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 8),
            child: Text(l.switchAccount, style: sheet.type.titleLarge),
          ),
          RowGroup(
            children: [
              for (final customer in session.customers)
                CheckRow(
                  label: customer.name,
                  selected: customer.id == session.customerId,
                  onTap: () {
                    Navigator.of(sheet).pop();
                    switchCustomer(context, customer.id);
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );
}
