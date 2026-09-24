import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import 'invoice_detail_screen.dart';

class InvoicesScreen extends StatelessWidget {
  const InvoicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    return AsyncView<InvoicesPage>(
      load: AppScope.of(context).api.invoices,
      builder: (context, page) => ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          if (page.summary.balances.isNotEmpty) ...[
            SectionHeader(l.invPositionTitle, description: l.invPositionDescription),
            Panel(children: [
              for (final balance in page.summary.balances)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: Text(l.overviewCurrencyOutstanding(balance.currency), style: muted)),
                        if (balance.overdue > 0)
                          TrailingBadge(l.overviewAmountOverdue(formatMoney(balance.overdue, balance.currency)), Tone.danger),
                      ]),
                      const SizedBox(height: 2),
                      Text(formatMoney(balance.outstanding, balance.currency),
                          style: theme.textTheme.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                      const SizedBox(height: 2),
                      Text(
                        l.invInvoicedReceipted(formatMoney(balance.invoiced, balance.currency), formatMoney(balance.paid, balance.currency)),
                        style: muted,
                      ),
                    ],
                  ),
                ),
            ]),
          ],
          SectionHeader(l.invBillingTitle),
          if (page.invoices.isEmpty)
            EmptyState(icon: Icons.receipt_long_outlined, title: l.invEmptyTitle, description: l.invEmptyDescription)
          else
            Panel(children: [for (final invoice in page.invoices) InvoiceTile(invoice)]),
          Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Text(l.invFootnote, style: muted)),
        ],
      ),
    );
  }
}

class InvoiceTile extends StatelessWidget {
  const InvoiceTile(this.invoice, {super.key});
  final Invoice invoice;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => InvoiceDetailScreen(reference: invoice.reference),
      )),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(invoice.externalInvoiceNumber ?? invoice.reference, style: theme.textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(
                    [
                      l.invdIssuedOn(formatDate(invoice.issueDate)),
                      if (invoice.balanceDue > 0 && invoice.dueDate.isNotEmpty) l.invdDueOn(formatDate(invoice.dueDate)),
                    ].join(' · '),
                    style: muted,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatMoney(invoice.balanceDue > 0 ? invoice.balanceDue : invoice.total, invoice.currency),
                  style: theme.textTheme.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                const SizedBox(height: 4),
                StatusBadge(invoiceStatusLabel(l, invoice), invoiceTone(invoice)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
