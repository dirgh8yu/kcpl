import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../labels.dart';
import '../widgets/async_view.dart';
import '../widgets/common.dart';
import 'shipment_detail_screen.dart';

class InvoiceDetailScreen extends StatelessWidget {
  const InvoiceDetailScreen({super.key, required this.reference});
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: Text(reference)),
      body: AsyncView<Invoice>(
        load: () => api.invoice(reference),
        onMissing: (context, _) => ListView(children: [
          EmptyState(icon: Icons.search_off_rounded, title: l.invdNotFoundTitle, description: l.invdNotFoundDescription),
        ]),
        builder: (context, invoice) => _InvoiceBody(invoice: invoice),
      ),
    );
  }
}

class _InvoiceBody extends StatelessWidget {
  const _InvoiceBody({required this.invoice});
  final Invoice invoice;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    String money(double value) => formatMoney(value, invoice.currency);
    final tabular = const [FontFeature.tabularFigures()];

    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(invoice.recordType == 'statement' ? l.invdStatement : l.invBillingTitle, style: muted)),
                TrailingBadge(invoiceStatusLabel(l, invoice), invoiceTone(invoice)),
              ]),
              const SizedBox(height: 8),
              Text(l.invdBalanceDue, style: muted),
              Text(money(invoice.balanceDue), style: theme.textTheme.headlineSmall?.copyWith(fontFeatures: tabular)),
              const SizedBox(height: 4),
              Text(
                [
                  l.invdIssuedOn(formatDate(invoice.issueDate)),
                  if (invoice.dueDate.isNotEmpty) l.invdDueOn(formatDate(invoice.dueDate)),
                ].join(' · '),
                style: muted,
              ),
            ],
          ),
        ),
        if (invoice.shipmentReference != null) ...[
          const SizedBox(height: 16),
          Panel(children: [
            ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: Text(l.commonShipment),
              subtitle: Text(invoice.shipmentReference!),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => ShipmentDetailScreen(reference: invoice.shipmentReference!),
              )),
            ),
          ]),
        ],
        SectionHeader(l.invdColCharge),
        if (invoice.lines.isEmpty)
          EmptyState(icon: Icons.receipt_long_outlined, title: l.invdNoLinesTitle, description: l.invdNoLinesDescription)
        else
          Panel(children: [
            for (final line in invoice.lines)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(line.description, style: theme.textTheme.bodyMedium),
                          if (line.quantity != 1)
                            Text('${line.quantity.toStringAsFixed(line.quantity % 1 == 0 ? 0 : 2)} × ${money(line.unitPrice)}', style: muted),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(money(line.total), style: theme.textTheme.bodyMedium?.copyWith(fontFeatures: tabular)),
                  ],
                ),
              ),
          ]),
        const SizedBox(height: 12),
        Panel(children: [
          InfoRow(l.invdSubtotal, money(invoice.subtotal)),
          InfoRow(l.invdTax, money(invoice.taxTotal)),
          InfoRow(l.invColTotal, money(invoice.total), emphasis: true),
          InfoRow(l.invdReceipted, money(invoice.amountPaid)),
          InfoRow(l.invdBalanceDue, money(invoice.balanceDue), emphasis: true),
        ]),
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Text(l.invFootnote, style: muted)),
      ],
    );
  }
}
