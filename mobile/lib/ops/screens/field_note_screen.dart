import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../../ui/labels.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/capture.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/compose.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';

/// True when the note was saved, or kept on the phone to send later.
Future<bool> openFieldNote(BuildContext context, String reference) async {
  // A sheet has a messenger of its own; the word about a kept note belongs
  // on the job it returns to.
  final messenger = ScaffoldMessenger.of(context);
  final result = await Navigator.of(context).push<Object>(SheetRoute<Object>(builder: (_) => FieldNoteScreen(reference: reference)));
  if (result == _kept) {
    messenger.showSnackBar(const SnackBar(content: Text('No signal. Saved on this phone; it goes to the job by itself.')));
  }
  return result != null;
}

const _kept = 'kept';

/// What a photo from the field most often is. Anything else is "Other" and
/// can be refiled from the Document Vault.
const _photoTypes = ['other', 'proof_of_delivery', 'customs_document', 'packing_list', 'delivery_order'];

/// A note, a photo, or both, from wherever the staff member is standing.
/// Written for a thumb and a hurry: the text field is ready, the photo is
/// one tap, and saving goes straight back to the job.
class FieldNoteScreen extends StatefulWidget {
  const FieldNoteScreen({super.key, required this.reference});
  final String reference;

  @override
  State<FieldNoteScreen> createState() => _FieldNoteScreenState();
}

class _FieldNoteScreenState extends State<FieldNoteScreen> {
  final _text = TextEditingController();
  Attachment? _photo;
  String _type = 'other';
  bool _busy = false;
  double? _progress;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final l = AppLocalizations.of(context);
    try {
      final photo = await pickAttachment(context, name: 'field-${widget.reference}-${DateTime.now().millisecondsSinceEpoch}');
      if (photo != null && mounted) setState(() => (_photo = photo, _error = null));
    } on AttachmentRefused catch (refused) {
      if (mounted) setState(() => _error = attachmentRefusal(l, refused));
    }
  }

  Future<void> _save() async {
    final text = _text.text.trim();
    final photo = _photo;
    if (text.isEmpty && photo == null) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Write a note or add a photo.');
      return;
    }
    final controller = OpsScope.read(context);
    setState(() => (_busy = true, _error = null, _progress = photo == null ? null : 0));
    var kept = false;
    final error = await attempt(context, () async {
      try {
        await controller.api.addNote(
          widget.reference,
          text: text,
          photo: photo,
          documentType: _type,
          onProgress: (fraction) {
            if (mounted) setState(() => _progress = fraction);
          },
        );
      } on ApiException catch (failure) {
        // No signal at a border yard is normal: the note waits on the phone
        // and goes by itself, rather than being lost or typed twice.
        if (failure.code != 'network' || !controller.notes.ready) rethrow;
        await controller.notes.add(widget.reference, text: text, photo: photo, documentType: photo == null ? 'other' : _type);
        kept = true;
      }
    });
    if (!mounted) return;
    if (error == null) {
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(kept ? _kept : true);
      return;
    }
    setState(() => (_busy = false, _progress = null, _error = error));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return ComposeScaffold(
      title: 'Add to job',
      error: _error,
      action: SendButton(label: 'Save to ${widget.reference}', onPressed: _save, busy: _busy, progress: _progress),
      children: [
        GroupCard(
          child: TextField(
            controller: _text,
            enabled: !_busy,
            autofocus: true,
            minLines: 3,
            maxLines: 8,
            maxLength: 2000,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
            textCapitalization: TextCapitalization.sentences,
            style: context.type.bodyLarge,
            decoration: cardField('What did you see? Seal, damage, who you spoke to…'),
          ),
        ),
        SectionHeader('Photo'),
        AttachmentField(file: _photo, onPick: _pick, enabled: !_busy, hint: 'Filed in the job’s Document Vault for review.'),
        if (_photo != null) ...[
          SectionHeader('File it as'),
          RowGroup(
            children: [
              for (final type in _photoTypes)
                Semantics(
                  selected: type == _type,
                  inMutuallyExclusiveGroup: true,
                  child: RowTile(
                    onTap: _busy
                        ? null
                        : () {
                            HapticFeedback.selectionClick();
                            setState(() => _type = type);
                          },
                    title: Text(type == 'other' ? 'Photo' : documentTypeLabel(l, type)),
                    trailing: type == _type ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                  ),
                ),
            ],
          ),
        ],
        const Footnote('Shows on the Job File timeline on the web, with your name.'),
      ],
    );
  }
}
