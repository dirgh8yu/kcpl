import 'dart:io' show File;

import 'package:cunning_document_scanner/cunning_document_scanner.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart' show CupertinoActionSheet, CupertinoActionSheetAction, showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../format.dart';
import '../motion.dart';
import '../theme.dart';
import 'common.dart';

/// Where a photo or file comes from. Swapped in tests and the demo build,
/// where there is no camera to open.
abstract class AttachmentSource {
  const AttachmentSource();

  /// Null when the person backs out.
  Future<Attachment?> camera();
  Future<Attachment?> photos();
  Future<Attachment?> files();

  /// The phone's own document scanner: edges found, pages flattened, all
  /// of them in one PDF. Where there is none, the camera.
  Future<Attachment?> scan() => camera();

  static AttachmentSource current = const DeviceAttachmentSource();
}

/// The server accepts these, sniffed, and nothing else.
const _types = {'pdf': 'application/pdf', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'};

/// A reason a file can't be sent, shown where it was chosen.
class AttachmentRefused implements Exception {
  const AttachmentRefused(this.reason);
  final String reason;
}

class DeviceAttachmentSource extends AttachmentSource {
  const DeviceAttachmentSource();

  // A phone photo re-encoded at this size stays sharp enough to read small
  // print and lands well under the server's limit. Re-encoding also turns an
  // iPhone's HEIC into a JPEG, which the server accepts.
  static const _edge = 2400.0;
  static const _quality = 82;

  Future<Attachment?> _image(ImageSource source) async {
    final XFile? picked;
    try {
      picked = await ImagePicker().pickImage(source: source, maxWidth: _edge, maxHeight: _edge, imageQuality: _quality);
    } on PlatformException catch (error) {
      if (error.code.contains('access_denied')) throw const AttachmentRefused('camera');
      rethrow;
    }
    if (picked == null) return null;
    return _attachment(picked.name, await picked.readAsBytes());
  }

  @override
  Future<Attachment?> camera() => _image(ImageSource.camera);

  @override
  Future<Attachment?> photos() => _image(ImageSource.gallery);

  /// Apple's VisionKit camera on iPhone, Google's ML Kit scanner on Android.
  @override
  Future<Attachment?> scan() async {
    final List<String>? paths;
    try {
      paths = await CunningDocumentScanner.getPictures(noOfPages: 20, asPdf: true);
    } on CunningDocumentScannerException catch (error) {
      if (error.code == 'permission_denied') throw const AttachmentRefused('camera');
      rethrow;
    }
    if (paths == null || paths.isEmpty) return null;
    final bytes = await File(paths.first).readAsBytes();
    try {
      await CunningDocumentScanner.cleanCache();
    } catch (_) {
      // Only a tidy-up of the scanner's own copies.
    }
    return Attachment(filename: 'scan.pdf', bytes: bytes, contentType: 'application/pdf');
  }

  @override
  Future<Attachment?> files() async {
    final picked = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: _types.keys.toList());
    if (picked.isEmpty) return null;
    final file = picked.first;
    return _attachment(file.name, await file.xFile.readAsBytes());
  }
}

Attachment _attachment(String name, List<int> bytes) {
  final dot = name.lastIndexOf('.');
  final extension = dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
  final type = _types[extension];
  if (type == null) throw const AttachmentRefused('type');
  return Attachment(filename: name, bytes: bytes, contentType: type);
}

/// The server's ceiling for a customer upload.
const attachmentMaxBytes = 10 * 1024 * 1024;

/// Offers camera, photos and files, as iOS does from an attach button, and
/// returns the chosen file named for what it is: "packing-list-KCPL-S-24091.jpg"
/// reads better in KCPL's vault than "IMG_4471.jpg". Refusals are shown by
/// the caller. [direct] skips the choice and opens the scanner at once, for
/// a document KCPL has asked for.
Future<Attachment?> pickAttachment(BuildContext context, {required String name, bool files = true, bool scan = false, bool direct = false}) async {
  final l = AppLocalizations.of(context);
  final source = AttachmentSource.current;
  final choice = direct ? source.scan : await showCupertinoModalPopup<Future<Attachment?> Function()>(
    context: context,
    builder: (sheet) => CupertinoActionSheet(
      actions: [
        if (scan) CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, source.scan), child: Text(l.captureScan)),
        CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, source.camera), child: Text(l.captureTakePhoto)),
        CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, source.photos), child: Text(l.captureChoosePhoto)),
        if (files) CupertinoActionSheetAction(onPressed: () => Navigator.pop(sheet, source.files), child: Text(l.captureChooseFile)),
      ],
      cancelButton: CupertinoActionSheetAction(isDefaultAction: true, onPressed: () => Navigator.pop(sheet), child: Text(l.cancel)),
    ),
  );
  if (choice == null) return null;
  final picked = await choice();
  if (picked == null) return null;
  if (picked.bytes.length > attachmentMaxBytes) throw const AttachmentRefused('size');
  final extension = picked.filename.substring(picked.filename.lastIndexOf('.') + 1).toLowerCase();
  final safe = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '-');
  return Attachment(filename: '$safe.$extension', bytes: picked.bytes, contentType: picked.contentType);
}

/// What a refusal means to the person holding the phone.
String attachmentRefusal(AppLocalizations l, AttachmentRefused refused) => switch (refused.reason) {
  'camera' => l.captureCameraDenied,
  'size' => l.captureTooLarge('${attachmentMaxBytes ~/ (1024 * 1024)}'),
  _ => l.captureUnsupported,
};

/// The file slot of a form: an invitation to add one, then the file itself,
/// large enough to check it is the right page before it goes.
class AttachmentField extends StatelessWidget {
  const AttachmentField({super.key, required this.file, required this.onPick, this.enabled = true, this.hint, this.label});
  final Attachment? file;
  final VoidCallback onPick;
  final bool enabled;

  /// The invitation, when it is more than "Take photo".
  final String? label;

  /// A line of advice under the empty slot.
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final file = this.file;
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? const Duration(milliseconds: 150) : Motion.reveal,
      switchInCurve: Motion.easeOut,
      switchOutCurve: Motion.easeOut,
      // Full width, as every card on the page is: the default layout would
      // let the card shrink to its content while it fades.
      layoutBuilder: (current, previous) =>
          Stack(alignment: Alignment.topCenter, fit: StackFit.passthrough, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: reduced ? child : ScaleTransition(scale: Tween(begin: 0.98, end: 1.0).animate(animation), child: child),
      ),
      child: file == null
          ? Pressable(
              key: const ValueKey('empty'),
              child: GroupCard(
                child: InkWell(
                  onTap: enabled ? onPick : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 22),
                    child: Column(
                      children: [
                        Icon(KIcons.camera, size: 28, color: p.accent),
                        const SizedBox(height: 10),
                        Text(label ?? l.captureTakePhoto, textAlign: TextAlign.center, style: context.type.titleMedium?.copyWith(color: p.accent)),
                        if (hint != null) ...[
                          const SizedBox(height: 4),
                          Text(hint!, textAlign: TextAlign.center, style: context.type.bodySmall),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            )
          : GroupCard(
              key: ValueKey(file),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (file.isImage)
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(kCardRadius)),
                      child: Image.memory(
                        Uint8List.fromList(file.bytes),
                        height: 200,
                        fit: BoxFit.cover,
                        gaplessPlayback: true,
                        // Decoded no larger than it is drawn.
                        cacheHeight: (200 * MediaQuery.devicePixelRatioOf(context)).round(),
                        semanticLabel: file.filename,
                      ),
                    ),
                  RowTile(
                    leading: Icon(file.isImage ? KIcons.image : KIcons.document, size: 22, color: p.secondary),
                    title: Text(file.filename, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(formatBytes(file.bytes.length)),
                    trailing: TextButton(onPressed: enabled ? onPick : null, child: Text(l.captureReplace)),
                  ),
                ],
              ),
            ),
    );
  }
}
