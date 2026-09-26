import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/file_opener.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';

/// Who received a delivered shipment, and the signature and photos KCPL
/// checked and chose to share, so nobody has to ask the desk for them. Only
/// what the server sends is shown: never the recipient's phone, the driver,
/// or where it was.
class ProofOfDeliveryCard extends StatefulWidget {
  const ProofOfDeliveryCard({super.key, required this.reference, required this.proof});
  final String reference;
  final ProofOfDelivery proof;

  @override
  State<ProofOfDeliveryCard> createState() => _ProofOfDeliveryCardState();
}

class _ProofOfDeliveryCardState extends State<ProofOfDeliveryCard> {
  /// Each file is fetched once for as long as the card is up.
  final Map<String, Future<DownloadedFile>> _files = {};

  Future<DownloadedFile> _file(ProofItem item) =>
      _files.putIfAbsent(item.id, () => AppScope.read(context).api.proofFile(widget.reference, item));

  void _retry(ProofItem item) => setState(() => _files.remove(item.id));

  String _label(AppLocalizations l, ProofItem item) {
    if (item.kind == 'signature') return l.podSignature;
    if (item.kind == 'photo') {
      final photos = widget.proof.items.where((i) => i.kind == 'photo').toList();
      return l.podPhoto(photos.indexOf(item) + 1);
    }
    return l.podDocument;
  }

  Future<void> _open(ProofItem item, String label) async {
    final l = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    HapticFeedback.selectionClick();
    try {
      final file = await _file(item);
      if (!mounted) return;
      if (item.isImage) {
        await Navigator.of(context).push(_ProofViewerRoute(tag: 'pod-${item.id}', bytes: Uint8List.fromList(file.bytes), label: label));
      } else {
        await openDownloadedFile(file);
      }
    } on SignedOutException {
      if (mounted) await AppScope.read(context).expire();
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.downloadFailed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final proof = widget.proof;
    final name = proof.recipientName;
    final title = name == null
        ? l.podTitle
        : proof.recipientRelation == null
        ? l.podReceivedBy(name)
        : l.podReceivedByAs(name, proof.recipientRelation!);
    return GroupCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 14, kGutter, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.type.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(KIcons.customs, size: 15, color: p.secondary),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        [if (proof.deliveredAt != null) l.podDelivered(formatDateTime(proof.deliveredAt)), l.podChecked].join(' · '),
                        style: context.type.bodyMedium?.copyWith(color: p.secondary),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (proof.items.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 14),
              child: Text(l.podNothingShared, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
            )
          else
            SizedBox(
              height: _ProofTile.height,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 0),
                itemCount: proof.items.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final item = proof.items[index];
                  final label = _label(l, item);
                  return _ProofTile(
                    item: item,
                    label: label,
                    file: _file(item),
                    onOpen: () => _open(item, label),
                    onRetry: () => _retry(item),
                  );
                },
              ),
            ),
          if (proof.items.isNotEmpty) const SizedBox(height: 14),
        ],
      ),
    );
  }
}

class _ProofTile extends StatelessWidget {
  const _ProofTile({required this.item, required this.label, required this.file, required this.onOpen, required this.onRetry});
  final ProofItem item;
  final String label;
  final Future<DownloadedFile> file;
  final VoidCallback onOpen;
  final VoidCallback onRetry;

  static const height = 112.0;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    // A signature is wide, as it is signed; a photo is square.
    final width = item.kind == 'signature' ? height * 2.2 : height;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final radius = BorderRadius.circular(kCardRadius - 4);
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        child: SizedBox(
          width: width,
          child: ClipRRect(
            borderRadius: radius,
            child: Material(
              color: item.kind == 'signature' ? const Color(0xFFFAFAF7) : p.fill,
              child: FutureBuilder<DownloadedFile>(
                future: file,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return InkWell(
                      onTap: onRetry,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(KIcons.undo, size: 20, color: p.secondary),
                            const SizedBox(height: 4),
                            Text(l.podLoadFailed, style: context.type.bodySmall),
                          ],
                        ),
                      ),
                    );
                  }
                  final data = snapshot.data;
                  final Widget content;
                  if (data == null) {
                    content = Center(child: CupertinoActivityIndicator(radius: 9, color: p.secondary));
                  } else if (item.isImage) {
                    content = HeroMode(
                      enabled: !Motion.reduced(context),
                      child: Hero(
                        tag: 'pod-${item.id}',
                        child: Image.memory(
                          Uint8List.fromList(data.bytes),
                          fit: item.kind == 'signature' ? BoxFit.contain : BoxFit.cover,
                          width: width,
                          height: height,
                          gaplessPlayback: true,
                          // Decoded no larger than it is drawn.
                          cacheWidth: (width * dpr).round(),
                        ),
                      ),
                    );
                  } else {
                    content = Center(child: Icon(KIcons.document, size: 28, color: p.secondary));
                  }
                  return InkWell(
                    onTap: data == null ? null : onOpen,
                    child: AnimatedSwitcher(duration: Motion.swap, switchInCurve: Motion.easeOut, child: content),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A proof picture full screen, pinch to zoom, on black like Photos.
class _ProofViewerRoute extends PageRoute<void> {
  _ProofViewerRoute({required this.tag, required this.bytes, required this.label});
  final String tag;
  final Uint8List bytes;
  final String label;

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  bool get opaque => false;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 240);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) => _ProofViewer(
    tag: tag,
    bytes: bytes,
    label: label,
  );

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) =>
      FadeTransition(opacity: CurvedAnimation(parent: animation, curve: Motion.easeOut), child: child);
}

class _ProofViewer extends StatelessWidget {
  const _ProofViewer({required this.tag, required this.bytes, required this.label});
  final String tag;
  final Uint8List bytes;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              maxScale: 5,
              child: Center(
                child: HeroMode(
                  enabled: !Motion.reduced(context),
                  child: Hero(
                    tag: tag,
                    child: Image.memory(bytes, fit: BoxFit.contain, semanticLabel: label),
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, kGutter, 0),
              child: Row(
                children: [
                  IconButton(
                    tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                    constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                    icon: const Icon(KIcons.close, color: Colors.white, size: 22),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(label, style: context.type.titleMedium?.copyWith(color: Colors.white), overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
