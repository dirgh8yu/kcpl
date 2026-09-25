import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../format.dart';
import '../labels.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/kcpl_loader.dart';
import '../widgets/large_title.dart';
import '../widgets/rows.dart' show openShipment;

/// A document beside the list on a tablet: a photo shown as it is, anything
/// else by what it is, with the file one tap away (Quick Look on an iPad)
/// and the shipment it belongs to.
class DocumentPane extends StatefulWidget {
  const DocumentPane({super.key, required this.document});
  final DocumentRow document;

  @override
  State<DocumentPane> createState() => _DocumentPaneState();
}

class _DocumentPaneState extends State<DocumentPane> {
  Future<DownloadedFile>? _preview;
  bool _opening = false;

  bool get _image => widget.document.contentType.startsWith('image/');

  /// Only what KCPL has released can be fetched back.
  bool get _downloadable => !widget.document.fromCustomer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_image && _downloadable) _preview ??= AppScope.read(context).api.download(widget.document);
  }

  Future<void> _open() async {
    final l = AppLocalizations.of(context);
    final controller = AppScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _opening = true);
    try {
      await openDownloadedFile(await (_preview ?? controller.api.download(widget.document)));
    } on SignedOutException {
      await controller.expire();
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.downloadFailed)));
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final document = widget.document;
    final state = reviewState(l, document.reviewState);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          LargeTitleBar(title: documentTypeLabel(l, document.documentType)),
          SliverList(
            delegate: SliverChildListDelegate([
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: kGutter + 4),
                child: Text(document.shipmentReference, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
              ),
              if (_preview != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(kGutter, 16, kGutter, 0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(kCardRadius),
                    child: FutureBuilder<DownloadedFile>(
                      future: _preview,
                      builder: (context, snapshot) {
                        final file = snapshot.data;
                        if (file != null) {
                          return Semantics(
                            image: true,
                            label: document.filename,
                            child: Image.memory(
                              Uint8List.fromList(file.bytes),
                              fit: BoxFit.contain,
                              errorBuilder: (_, _, _) => Notice(title: l.docPreviewFailed, emphasis: Emphasis.normal),
                            ),
                          );
                        }
                        if (snapshot.hasError) return Notice(title: l.docPreviewFailed, emphasis: Emphasis.normal);
                        return ColoredBox(
                          color: p.fill,
                          child: const SizedBox(height: 220, child: Center(child: KcplLoader(size: 28))),
                        );
                      },
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              RowGroup(
                children: [
                  DetailRow(l.docFile, document.filename),
                  DetailRow(l.docAdded, formatDate(document.uploadedAt)),
                  if (document.sizeBytes > 0) DetailRow(l.docSize, formatBytes(document.sizeBytes)),
                  if (state != null) DetailRow(l.docState, state.$1, emphasis: state.$2),
                ],
              ),
              const SizedBox(height: 16),
              if (_downloadable)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: kGutter),
                  child: FilledButton.icon(
                    onPressed: _opening ? null : _open,
                    style: FilledButton.styleFrom(backgroundColor: p.accent, foregroundColor: Colors.white),
                    icon: _opening ? const KcplLoader(size: 18) : const Icon(KIcons.download, size: 18),
                    label: Text(l.docOpen),
                  ),
                ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: kGutter),
                child: OutlinedButton(
                  onPressed: () => openShipment(context, document.shipmentReference),
                  child: Text(l.docShipment(document.shipmentReference)),
                ),
              ),
              const SizedBox(height: 32),
            ]),
          ),
        ],
      ),
    );
  }
}
