import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/rows.dart';
import 'overview_screen.dart' show BalanceFigure;

class InvoicesScreen extends StatelessWidget {
  const InvoicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return AsyncPage<InvoicesPage>(
      title: l.chromeInvoices,
      load: AppScope.of(context).api.invoices,
      builder: (context, page) => [
        if (page.summary.balances.isNotEmpty)
          RowGroup(children: [for (final balance in page.summary.balances) BalanceFigure(balance: balance, detail: true)]),
        if (page.summary.balances.length > 1) Footnote(l.invPositionDescription),
        if (page.summary.balances.isNotEmpty) const SizedBox(height: 20),
        const RowGroup(indent: RowGroup.iconIndent, children: [StatementRow()]),
        SectionHeader(l.invBillingTitle),
        if (page.invoices.isEmpty)
          EmptyState(icon: KIcons.invoices, title: l.invEmptyTitle, description: l.invEmptyDescription)
        else
          RowGroup(children: [for (final invoice in page.invoices) InvoiceRow(invoice)]),
        Footnote(l.invFootnote),
      ],
    );
  }
}

/// The statement of account, as a PDF for the phone's own viewer: what is
/// owed, how overdue, and what has been paid, the way accounts would send it.
class StatementRow extends StatefulWidget {
  const StatementRow({super.key});

  @override
  State<StatementRow> createState() => _StatementRowState();
}

class _StatementRowState extends State<StatementRow> {
  bool _busy = false;

  Future<void> _open() async {
    final l = AppLocalizations.of(context);
    final controller = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    HapticFeedback.selectionClick();
    setState(() => _busy = true);
    try {
      await openDownloadedFile(await controller.api.statement());
    } on SignedOutException {
      await controller.expire();
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.statementFailed)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return RowTile(
      onTap: _busy ? null : _open,
      leading: Icon(KIcons.invoice, size: 22, color: p.accent),
      title: Text(l.statementTitle),
      subtitle: Text(l.statementSubtitle),
      trailing: SizedBox(
        width: 24,
        height: 24,
        child: AnimatedSwitcher(
          duration: Motion.swap,
          switchInCurve: Motion.easeOut,
          switchOutCurve: Motion.easeOut,
          transitionBuilder: morphTransition,
          child: _busy
              ? CupertinoActivityIndicator(key: const ValueKey('busy'), radius: 9, color: p.secondary)
              : Icon(KIcons.download, key: const ValueKey('ready'), size: 22, color: p.secondary, semanticLabel: l.commonDownload),
        ),
      ),
    );
  }
}
