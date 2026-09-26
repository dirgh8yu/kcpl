import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/choice_rows.dart';
import '../widgets/common.dart';
import '../widgets/compose.dart';
import '../widgets/journey.dart' show IconTile;
import '../widgets/sheet_route.dart';

/// Account's SMS / WhatsApp row: shown only when KCPL offers a channel,
/// with what is set now. Opens the setting as a sheet.
class TextNoticesSection extends StatefulWidget {
  const TextNoticesSection({super.key});

  @override
  State<TextNoticesSection> createState() => _TextNoticesSectionState();
}

class _TextNoticesSectionState extends State<TextNoticesSection> {
  TextNotices? _notices;
  int _generation = -1;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final controller = AppScope.of(context);
    if (controller.generation != _generation) {
      _generation = controller.generation;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final notices = await AppScope.read(context).api.textNotices();
      if (mounted) setState(() => _notices = notices);
    } on SignedOutException {
      if (mounted) await AppScope.read(context).expire();
    } catch (_) {
      // Not offered, or not reachable now: the row simply isn't shown.
    }
  }

  Future<void> _open(TextNotices notices) async {
    final saved = await Navigator.of(context).push<TextNotices>(SheetRoute<TextNotices>(builder: (_) => TextNoticesScreen(current: notices)));
    if (saved != null && mounted) setState(() => _notices = saved);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final notices = _notices;
    if (notices == null || notices.offered.isEmpty) return const SizedBox.shrink();
    final state = switch (notices.channel) {
      'sms' => '${l.textSms} · ${notices.phone ?? ''}',
      'whatsapp' => '${l.textWhatsapp} · ${notices.phone ?? ''}',
      _ => l.textOff,
    };
    // Under the email switches: another way the same updates arrive.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        RowGroup(
          indent: RowGroup.iconIndent,
          children: [
            RowTile(
              onTap: () => _open(notices),
              leading: const IconTile(icon: KIcons.message),
              title: Text(l.textTitle),
              accessory: Text(state),
              chevron: true,
            ),
          ],
        ),
      ],
    );
  }
}

/// Which channel, which number, and the customer's own agreement to be
/// messaged there. Nothing is sent without the box ticked; the server
/// refuses it too.
class TextNoticesScreen extends StatefulWidget {
  const TextNoticesScreen({super.key, required this.current});
  final TextNotices current;

  @override
  State<TextNoticesScreen> createState() => _TextNoticesScreenState();
}

class _TextNoticesScreenState extends State<TextNoticesScreen> {
  late String _channel = widget.current.channel;
  late final _phone = TextEditingController(text: widget.current.phone ?? '');
  late bool _consent = widget.current.on;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    if (_channel != 'none' && !_consent) {
      HapticFeedback.heavyImpact();
      setState(() => _error = l.textNeedConsent);
      return;
    }
    final api = AppScope.read(context).api;
    final navigator = Navigator.of(context);
    setState(() => (_busy = true, _error = null));
    TextNotices? saved;
    final error = await attempt(context, () async {
      saved = await api.setTextNotices(_channel, phone: _phone.text.trim(), consent: _consent);
    });
    if (!mounted) return;
    if (saved != null) {
      HapticFeedback.mediumImpact();
      navigator.pop(saved);
      return;
    }
    HapticFeedback.heavyImpact();
    setState(() => (_busy = false, _error = error));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final offered = widget.current.offered;
    final on = _channel != 'none';
    return ComposeScaffold(
      title: l.textTitle,
      error: _error,
      action: SendButton(label: l.textSave, onPressed: _save, busy: _busy),
      children: [
        RowGroup(
          children: [
            CheckRow(label: l.textOff, selected: _channel == 'none', onTap: () => setState(() => (_channel = 'none', _error = null))),
            if (offered.contains('sms'))
              CheckRow(label: l.textSms, selected: _channel == 'sms', onTap: () => setState(() => (_channel = 'sms', _error = null))),
            if (offered.contains('whatsapp'))
              CheckRow(
                label: l.textWhatsapp,
                selected: _channel == 'whatsapp',
                onTap: () => setState(() => (_channel = 'whatsapp', _error = null)),
              ),
          ],
        ),
        if (on) ...[
          SectionHeader(l.textPhone),
          GroupCard(
            child: TextField(
              controller: _phone,
              enabled: !_busy,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              style: context.type.bodyLarge,
              decoration: cardField(_channel == 'sms' ? l.textPhoneHintSms : l.textPhoneHintWhatsapp),
            ),
          ),
          const SizedBox(height: 12),
          GroupCard(
            child: CheckboxListTile.adaptive(
              value: _consent,
              onChanged: _busy
                  ? null
                  : (value) {
                      HapticFeedback.selectionClick();
                      setState(() => (_consent = value ?? false, _error = null));
                    },
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: p.ink,
              contentPadding: const EdgeInsets.symmetric(horizontal: kGutter - 4, vertical: 4),
              horizontalTitleGap: 8,
              title: Text(l.textConsent, style: context.type.bodyMedium),
            ),
          ),
        ],
        Footnote(l.textFootnote),
      ],
    );
  }
}
