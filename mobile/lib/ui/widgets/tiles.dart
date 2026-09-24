import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../format.dart';
import '../labels.dart';
import '../screens/shipment_detail_screen.dart';
import '../theme.dart';
import 'common.dart';

IconData modeIcon(String mode) => switch (mode) {
      'air' => Icons.flight_rounded,
      'sea' || 'ocean' => Icons.directions_boat_rounded,
      'road' => Icons.local_shipping_rounded,
      'rail' => Icons.train_rounded,
      'courier' => Icons.inventory_2_rounded,
      _ => Icons.route_rounded,
    };

class ShipmentTile extends StatelessWidget {
  const ShipmentTile(this.shipment, {super.key});
  final Shipment shipment;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    final location = shipment.currentLocation;

    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => ShipmentDetailScreen(reference: shipment.reference),
      )),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: theme.colorScheme.surfaceContainer, borderRadius: BorderRadius.circular(9)),
              child: Icon(modeIcon(shipment.mode), size: 18, color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          shipment.reference,
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]),
                        ),
                      ),
                      const SizedBox(width: 8),
                      TrailingBadge(statusLabel(l, shipment.status), statusTone(shipment.status)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(route(shipment.origin, shipment.destination), style: theme.textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (location != null && !shipment.delivered) l.overviewNowAt(location),
                      if (shipment.eta != null && !shipment.delivered) '${l.overviewColEta} ${formatDate(shipment.eta)}',
                      if (shipment.delivered) '${l.commonUpdated} ${formatDate(shipment.updatedAt)}',
                    ].join(' · '),
                    style: muted,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DocumentTile extends StatefulWidget {
  const DocumentTile(this.document, {super.key, this.showShipment = true});
  final DocumentRow document;
  final bool showShipment;

  @override
  State<DocumentTile> createState() => _DocumentTileState();
}

class _DocumentTileState extends State<DocumentTile> {
  bool _busy = false;

  Future<void> _open() async {
    final l = AppLocalizations.of(context);
    final controller = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
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
    final theme = Theme.of(context);
    final document = widget.document;
    final state = reviewState(l, document.reviewState);
    // Only what KCPL has released can be fetched back; a customer's own
    // upload is listed for its review state.
    final downloadable = !document.fromCustomer;

    return InkWell(
      onTap: downloadable && !_busy ? _open : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Row(
          children: [
            Icon(
              document.contentType.startsWith('image/') ? Icons.image_outlined : Icons.description_outlined,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(documentTypeLabel(l, document.documentType), style: theme.textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (widget.showShipment) document.shipmentReference,
                      formatDate(document.uploadedAt),
                      formatBytes(document.sizeBytes),
                    ].join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (document.fromCustomer || state != null) ...[
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, children: [
                      if (document.fromCustomer) StatusBadge(l.docsSentByYou, Tone.neutral),
                      if (state != null) StatusBadge(state.$1, state.$2),
                    ]),
                  ],
                ],
              ),
            ),
            if (downloadable)
              _busy
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  : IconButton(
                      tooltip: l.commonDownload,
                      onPressed: _open,
                      icon: const Icon(Icons.download_rounded),
                    ),
          ],
        ),
      ),
    );
  }
}
