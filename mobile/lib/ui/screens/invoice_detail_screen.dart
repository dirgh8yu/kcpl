import 'package:flutter/material.dart';

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

class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({super.key, required this.reference});
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: AsyncPage<Invoice>(
        title: reference,
        load: () => api.invoice(reference),
        onMissing: (context, _) => EmptyState(icon: KIcons.noResults, title: l.invdNotFoundTitle, description: l.invdNotFoundDescription),
        builder: (context, invoice) => _body(context, invoice),
      ),
    );
  }

  List<Widget> _body(BuildContext context, Invoice invoice) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    String money(double value) => formatMoney(value, invoice.currency);
    const tabular = [FontFeature.tabularFigures()];

    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: kGutter),
        child: Text(
          [
            l.invdIssuedOn(formatDate(invoice.issueDate)),
            if (invoice.dueDate.isNotEmpty) l.invdDueOn(formatDate(invoice.dueDate)),
          ].join(' · '),
          style: context.type.bodyLarge?.copyWith(color: p.secondary),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 28, kGutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.invdBalanceDue, style: context.type.bodySmall),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: CountUp(value: invoice.balanceDue, format: money, style: context.type.headlineMedium),
            ),
            const SizedBox(height: 6),
            StatusText(invoiceStatusLabel(l, invoice), invoiceEmphasis(invoice)),
          ],
        ),
      ),
      if (invoice.shipmentReference != null) ...[
        const SizedBox(height: 20),
        const Divider(indent: kGutter, endIndent: kGutter),
        RowTile(
          onTap: () => openShipment(context, invoice.shipmentReference!),
          leading: const IconTile(icon: KIcons.shipments),
          title: Text(invoice.shipmentReference!),
          subtitle: Text(l.commonShipment),
          chevron: true,
        ),
        const Divider(indent: kGutter, endIndent: kGutter),
      ],
      SectionHeader(invoice.recordType == 'statement' ? l.invdStatement : l.invdColCharge),
      if (invoice.lines.isEmpty)
        EmptyState(icon: KIcons.invoices, title: l.invdNoLinesTitle, description: l.invdNoLinesDescription)
      else
        RowGroup(
          children: [
            for (final line in invoice.lines)
              RowTile(
                title: Text(line.description, style: context.type.bodyLarge),
                subtitle: line.quantity != 1
                    ? Text('${line.quantity.toStringAsFixed(line.quantity % 1 == 0 ? 0 : 2)} × ${money(line.unitPrice)}')
                    : null,
                trailing: Text(money(line.total), style: context.type.titleSmall?.copyWith(fontFeatures: tabular)),
              ),
          ],
        ),
      const SizedBox(height: 16),
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
    ];
  }
}
