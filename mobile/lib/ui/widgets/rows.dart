import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../format.dart';
import '../labels.dart';
import '../motion.dart';
import '../screens/invoice_detail_screen.dart';
import '../screens/shipment_detail_screen.dart';
import '../theme.dart';
import 'common.dart';
import 'journey.dart';
import 'sheet_route.dart';
import 'split_view.dart';

/// Opens a shipment. [preview] is what the caller already knows, so the
/// detail page draws its journey on the first frame instead of a skeleton.
/// Beside the list on a tablet; as a sheet otherwise.
void openInvoice(BuildContext context, String reference) {
  if (SplitView.select(context, reference)) return;
  Navigator.of(context).push(SheetRoute<void>(builder: (_) => InvoiceDetailScreen(reference: reference)));
}

/// Beside the list on a tablet; as a sheet otherwise.
void openShipment(BuildContext context, String reference, {Shipment? preview}) {
  if (SplitView.select(context, reference)) return;
  Navigator.of(context).push(
    SheetRoute<void>(
      builder: (_) => ShipmentDetailScreen(reference: reference, preview: preview),
    ),
  );
}

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

    return SplitSelected(
      id: shipment.reference,
      child: RowTile(
        onTap: () => openShipment(context, shipment.reference, preview: shipment),
        leading: ModeBadge(mode: shipment.mode, status: shipment.status),
        title: RouteText(place(shipment.origin), place(shipment.destination)),
        subtitle: Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '${shipment.reference} · '),
              TextSpan(
                text: statusLabel(l, shipment.status),
                style: TextStyle(color: emphasis == Emphasis.attention ? p.accent : null),
              ),
            ],
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        accessory: Text(date == null ? '—' : formatShortDate(date)),
        // Under the text, clear of the icon.
        below: shipment.delivered ? null : JourneyBar(status: shipment.status),
      ),
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
  bool _done = false;

  Future<void> _open() async {
    final l = AppLocalizations.of(context);
    final controller = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final file = await controller.api.download(widget.document);
      await openDownloadedFile(file);
      // A tick where the arrow was, briefly, then back to ready.
      if (mounted) setState(() => _done = true);
      HapticFeedback.lightImpact();
      Future<void>.delayed(const Duration(milliseconds: 1600), () {
        if (mounted) setState(() => _done = false);
      });
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

    // On a tablet the document opens beside the list, whoever sent it.
    final key = '${document.shipmentReference}/${document.id}';
    final beside = SplitView.beside(context);
    return SplitSelected(
      id: key,
      child: RowTile(
        onTap: beside
            ? () => SplitView.select(context, key, item: document)
            : downloadable && !_busy
            ? _open
            : null,
        leading: IconTile(icon: document.contentType.startsWith('image/') ? KIcons.image : KIcons.document),
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
            : SizedBox(
                width: 24,
                height: 24,
                child: AnimatedSwitcher(
                  duration: Motion.swap,
                  switchInCurve: Motion.easeOut,
                  switchOutCurve: Motion.easeOut,
                  transitionBuilder: morphTransition,
                  child: _busy
                      ? CupertinoActivityIndicator(key: const ValueKey('busy'), radius: 9, color: p.secondary)
                      : _done
                      ? Icon(KIcons.done, key: const ValueKey('done'), size: 22, color: p.ink)
                      : Icon(KIcons.download, key: const ValueKey('ready'), size: 22, color: p.secondary, semanticLabel: l.commonDownload),
                ),
              ),
      ),
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
    return SplitSelected(
      id: invoice.reference,
      child: RowTile(
        onTap: () => openInvoice(context, invoice.reference),
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
              style: context.type.bodyLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            ),
            const SizedBox(height: 2),
            StatusText(invoiceStatusLabel(l, invoice), invoiceEmphasis(invoice), style: context.type.bodyMedium),
          ],
        ),
      ),
    );
  }
}

/// "KCPL-S-24091 · Kolkata → Birgunj ICD" in grey: which shipment a form is
/// about, under its title.
class ShipmentLine extends StatelessWidget {
  const ShipmentLine(this.shipment, {super.key});
  final Shipment shipment;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final style = context.type.bodyMedium?.copyWith(color: p.secondary);
    final size = (style?.fontSize ?? 15) * 0.78;
    // One run of text, so at large sizes it wraps rather than overflowing.
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '${shipment.reference} · ${place(shipment.origin)}'),
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: size * 0.35),
              child: Icon(KIcons.arrowRight, size: size, color: p.tertiary),
            ),
          ),
          TextSpan(text: place(shipment.destination)),
        ],
      ),
      style: style,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }
}
