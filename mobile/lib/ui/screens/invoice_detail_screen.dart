import 'package:flutter/material.dart';

import '../../api/kcpl_api.dart';
import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart' show IconTile;
import '../widgets/rows.dart';
import 'send_receipt_screen.dart';

class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({super.key, required this.reference});
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<(Invoice, List<Remittance>)>(
        title: reference,
        load: () async {
          final invoice = api.invoice(reference);
          // Receipts are a courtesy on the invoice: if they can't be read,
          // the invoice still shows.
          final receipts = api.remittances(reference).catchError((Object _) => <Remittance>[], test: (e) => e is ApiException);
          return (await invoice, await receipts);
        },
        onMissing: (context, _) => EmptyState(icon: KIcons.noResults, title: l.invdNotFoundTitle, description: l.invdNotFoundDescription),
        builder: (context, loaded) => _body(context, loaded.$1, loaded.$2),
      ),
    );
  }

  List<Widget> _body(BuildContext context, Invoice invoice, List<Remittance> receipts) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    String money(double value) => formatMoney(value, invoice.currency);
    const tabular = [FontFeature.tabularFigures()];

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
        child: Text(
          [
            l.invdIssuedOn(formatDate(invoice.issueDate)),
            if (invoice.dueDate.isNotEmpty) l.invdDueOn(formatDate(invoice.dueDate)),
          ].join(' · '),
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
        ),
      ),
      const SizedBox(height: 16),
      RowGroup(
        indent: RowGroup.iconIndent,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.invdBalanceDue, style: context.type.bodySmall),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: FigureText(
                    value: invoice.balanceDue,
                    format: money,
                    style: context.type.headlineMedium?.copyWith(fontFeatures: tabular),
                  ),
                ),
                const SizedBox(height: 4),
                StatusText(invoiceStatusLabel(l, invoice), invoiceEmphasis(invoice)),
              ],
            ),
          ),
          // Paying is done at the bank; what the app can do is tell KCPL.
          if (invoice.balanceDue > 0 && invoice.recordType == 'invoice')
            RowTile(
              onTap: () async {
                if (await openSendReceipt(context, invoice) && context.mounted) await AsyncPage.reload(context);
              },
              leading: const IconTile(icon: KIcons.upload, attention: true),
              title: Text(l.receiptSend, style: TextStyle(color: p.accent)),
            ),
          if (invoice.shipmentReference != null)
            RowTile(
              onTap: () => openShipment(context, invoice.shipmentReference!),
              leading: const IconTile(icon: KIcons.shipments),
              title: Text(invoice.shipmentReference!),
              subtitle: Text(l.commonShipment),
              chevron: true,
            ),
        ],
      ),
      SectionHeader(invoice.recordType == 'statement' ? l.invdStatement : l.invdColCharge),
      if (invoice.lines.isEmpty)
        GroupCard(
          child: EmptyState(icon: KIcons.invoices, title: l.invdNoLinesTitle, description: l.invdNoLinesDescription),
        )
      else
        RowGroup(
          children: [
            for (final line in invoice.lines)
              RowTile(
                title: Text(line.description),
                subtitle: line.quantity != 1
                    ? Text('${line.quantity.toStringAsFixed(line.quantity % 1 == 0 ? 0 : 2)} × ${money(line.unitPrice)}')
                    : null,
                trailing: Text(money(line.total), style: context.type.bodyLarge?.copyWith(fontFeatures: tabular)),
              ),
          ],
        ),
      const SizedBox(height: 20),
      RowGroup(
        children: [
          DetailRow(l.invdSubtotal, money(invoice.subtotal)),
          DetailRow(l.invdTax, money(invoice.taxTotal)),
          DetailRow(l.invColTotal, money(invoice.total), strong: true),
          DetailRow(l.invdReceipted, money(invoice.amountPaid)),
          DetailRow(
            l.invdBalanceDue,
            money(invoice.balanceDue),
            strong: true,
            emphasis: invoice.status == 'overdue' ? Emphasis.attention : Emphasis.normal,
          ),
        ],
      ),
      Footnote(l.invFootnote),
      if (receipts.isNotEmpty) ...[
        SectionHeader(l.receiptsTitle),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            for (final receipt in receipts)
              RowTile(
                leading: const IconTile(icon: KIcons.document),
                title: Text(
                  receipt.amount == null ? receipt.filename : formatMoney(receipt.amount!, receipt.currency ?? invoice.currency),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(l.receiptPaidOnDate(formatDate(receipt.paidOn ?? receipt.uploadedAt))),
                trailing: StatusText(
                  receipt.acknowledged ? l.receiptAcknowledged : l.receiptWithAccounts,
                  receipt.acknowledged ? Emphasis.normal : Emphasis.muted,
                ),
              ),
          ],
        ),
        Footnote(l.receiptFootnote),
      ],
    ];
  }
}
