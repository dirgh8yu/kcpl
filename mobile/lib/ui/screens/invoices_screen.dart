import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/rows.dart';
import '../icons.dart';
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
