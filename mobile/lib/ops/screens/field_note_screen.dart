import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../l10n/app_localizations.dart';
import '../../ui/labels.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/capture.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/compose.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';

/// True when the note was saved.
Future<bool> openFieldNote(BuildContext context, String reference) async =>
    await Navigator.of(context).push<bool>(SheetRoute<bool>(builder: (_) => FieldNoteScreen(reference: reference))) ?? false;

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
    final api = OpsScope.read(context).api;
    setState(() => (_busy = true, _error = null, _progress = photo == null ? null : 0));
    final error = await attempt(
      context,
      () => api.addNote(
        widget.reference,
        text: text,
        photo: photo,
        documentType: _type,
        onProgress: (fraction) {
          if (mounted) setState(() => _progress = fraction);
        },
      ),
    );
    if (!mounted) return;
    if (error == null) {
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
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
