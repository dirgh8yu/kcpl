import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../format.dart';
import '../labels.dart';
import '../screens/invoice_detail_screen.dart';
import '../screens/shipment_detail_screen.dart';
import '../theme.dart';
import 'common.dart';
import 'journey.dart';

void openShipment(BuildContext context, String reference) => Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ShipmentDetailScreen(reference: reference)),
    );

/// A shipment as a flight tracker lists a flight: where it's going in bold,
/// the reference and status beneath, the date that matters on the right,
/// and a thin journey line underneath while it's moving.
class ShipmentRow extends StatelessWidget {
  const ShipmentRow(this.shipment, {super.key});
  final Shipment shipment;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final emphasis = statusEmphasis(shipment.status);
    final date = shipment.delivered ? shipment.updatedAt : shipment.eta;

    return RowTile(
      onTap: () => openShipment(context, shipment.reference),
      title: RouteText(place(shipment.origin), place(shipment.destination)),
      subtitle: Text.rich(
        TextSpan(children: [
          TextSpan(text: '${shipment.reference} · '),
          TextSpan(
            text: statusLabel(l, shipment.status),
            style: TextStyle(color: emphasis == Emphasis.attention ? p.accent : null),
          ),
        ]),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            date == null ? '—' : formatShortDate(date),
            style: context.type.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          const SizedBox(height: 3),
          Text(shipment.delivered ? l.statusDelivered : l.overviewColEta, style: context.type.bodySmall),
        ],
      ),
      below: shipment.delivered ? null : JourneyBar(status: shipment.status),
    );
  }
}

class DocumentRowTile extends StatefulWidget {
  const DocumentRowTile(this.document, {super.key, this.showShipment = true});
  final DocumentRow document;
  final bool showShipment;

  @override
  State<DocumentRowTile> createState() => _DocumentRowTileState();
}

class _DocumentRowTileState extends State<DocumentRowTile> {
  bool _busy = false;

  Future<void> _open() async {
    final l = AppLocalizations.of(context);
    final controller = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    HapticFeedback.selectionClick();
    setState(() => _busy = true);
    try {
      final file = await controller.api.download(widget.document);
      await openDownloadedFile(file);
    } on SignedOutException {
      await controller.expire();
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.downloadFailed)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final document = widget.document;
    final state = reviewState(l, document.reviewState);
    // Only what KCPL has released can be fetched back; a customer's own
    // upload is listed for its review state.
    final downloadable = !document.fromCustomer;

    return RowTile(
      onTap: downloadable && !_busy ? _open : null,
      leading: Icon(
        document.contentType.startsWith('image/') ? Icons.image_outlined : Icons.description_outlined,
        color: p.ink,
        size: 22,
      ),
      title: Text(documentTypeLabel(l, document.documentType)),
      subtitle: Text(
        [
          if (widget.showShipment) document.shipmentReference,
          formatShortDate(document.uploadedAt),
          if (document.fromCustomer) l.docsSentByYou else formatBytes(document.sizeBytes),
        ].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: !downloadable
          ? (state == null ? null : StatusText(state.$1, state.$2))
          : _busy
              ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: p.ink))
              : Icon(Icons.arrow_downward_rounded, size: 20, color: p.ink, semanticLabel: l.commonDownload),
    );
  }
}

class InvoiceRow extends StatelessWidget {
  const InvoiceRow(this.invoice, {super.key});
  final Invoice invoice;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final open = invoice.balanceDue > 0;
    return RowTile(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => InvoiceDetailScreen(reference: invoice.reference),
      )),
      title: Text(invoice.externalInvoiceNumber ?? invoice.reference, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        open && invoice.dueDate.isNotEmpty
            ? l.invdDueOn(formatShortDate(invoice.dueDate))
            : l.invdIssuedOn(formatShortDate(invoice.issueDate)),
      ),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            formatMoney(open ? invoice.balanceDue : invoice.total, invoice.currency),
            style: context.type.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          const SizedBox(height: 3),
          StatusText(invoiceStatusLabel(l, invoice), invoiceEmphasis(invoice), style: context.type.bodySmall),
        ],
      ),
    );
  }
}
