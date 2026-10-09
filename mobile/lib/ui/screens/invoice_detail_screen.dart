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
import 'pay_screen.dart';
import 'send_receipt_screen.dart';

class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({super.key, required this.reference, this.title});
  final String reference;

  /// The number the customer files it under, when the list already knew it.
  final String? title;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<(Invoice, List<Remittance>, PaymentOptions)>(
        title: title ?? reference,
        // The tax invoice number, as the web portal titles it.
        titleOf: (loaded) => loaded.$1.number,
        load: () async {
          final invoice = api.invoice(reference);
          // Receipts are a courtesy on the invoice: if they can't be read,
          // the invoice still shows.
          final receipts = api.remittances(reference).catchError((Object _) => <Remittance>[], test: (e) => e is ApiException);
          // So is paying online: offered only when KCPL says it can be, now.
          final options = api.paymentOptions(reference).catchError((Object _) => PaymentOptions.none, test: (e) => e is ApiException);
          return (await invoice, await receipts, await options);
        },
        onMissing: (context, _) => EmptyState(icon: KIcons.noResults, title: l.invdNotFoundTitle, description: l.invdNotFoundDescription),
        builder: (context, loaded) => _body(context, loaded.$1, loaded.$2, loaded.$3),
      ),
    );
  }

  List<Widget> _body(BuildContext context, Invoice invoice, List<Remittance> receipts, PaymentOptions options) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    String money(double value) => formatMoney(value, invoice.currency);
    const tabular = [FontFeature.tabularFigures()];
    final settled = invoice.amountPaid != 0 || invoice.creditTotal != 0 || invoice.movedToCreditTotal != 0;
    // Everything received, including what has since moved to account credit.
    final received = invoice.amountPaid + invoice.movedToCreditTotal;

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
        child: Text(
          [
            // A tax invoice is dated in BS: shown beside the AD date unless
            // the reader already reads every date in BS.
            showingBs || invoice.taxInvoiceNumber == null
                ? l.invdIssuedOn(formatDate(invoice.issueDate))
                : l.invdIssuedBoth(formatDate(invoice.issueDate), formatBsDate(invoice.issueDate)),
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
          if (options.available && invoice.balanceDue > 0)
            RowTile(
              onTap: () async {
                if (await openPay(context, invoice, options) && context.mounted) await AsyncPage.reload(context);
              },
              leading: const IconTile(icon: KIcons.wallet, attention: true),
              title: Text(l.payOnline, style: TextStyle(color: p.accent)),
              subtitle: Text(options.gateways.map((g) => paymentGatewayNames[g] ?? g).join(' · ')),
            ),
          // Paid at the bank instead: what the app can do is tell KCPL.
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
      // Each sum once, as the web portal sets them out: a subtotal only
      // beside the tax or at-cost charges that make it differ from the
      // total, and a balance only once something was received or credited.
      RowGroup(
        children: [
          if (invoice.taxTotal != 0 || invoice.disbursementTotal != 0) ...[
            DetailRow(l.invdSubtotal, money(invoice.subtotal - invoice.disbursementTotal)),
            if (invoice.taxTotal != 0) DetailRow(l.invdTax, money(invoice.taxTotal)),
            if (invoice.disbursementTotal != 0) DetailRow(l.invdPaidOnBehalf, money(invoice.disbursementTotal)),
          ],
          DetailRow(invoice.creditTotal != 0 ? l.invdInvoiceTotal : l.invColTotal, money(invoice.issuedTotal), strong: !settled),
          if (invoice.creditTotal != 0) DetailRow(l.invdCreditNotes, '−${money(invoice.creditTotal)}'),
          if (received != 0) DetailRow(l.invdReceipted, money(received)),
          if (invoice.movedToCreditTotal != 0) DetailRow(l.invdMovedToCredit, '−${money(invoice.movedToCreditTotal)}'),
          if (settled)
            DetailRow(
              l.invdBalanceDue,
              money(invoice.balanceDue),
              strong: true,
              emphasis: invoice.status == 'overdue' ? Emphasis.attention : Emphasis.normal,
            ),
        ],
      ),
      if (invoice.creditNotes.isNotEmpty) ...[
        SectionHeader(l.invdCreditNotes),
        RowGroup(
          children: [
            for (final note in invoice.creditNotes)
              RowTile(
                title: Text(note.number, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text([formatDate(note.date), if (note.reason.isNotEmpty) note.reason].join(' · ')),
                trailing: Text('−${money(note.amount)}', style: context.type.bodyLarge?.copyWith(fontFeatures: tabular)),
              ),
          ],
        ),
      ],
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
