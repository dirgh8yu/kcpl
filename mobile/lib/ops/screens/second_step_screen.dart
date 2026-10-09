import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../auth/auth_repository.dart' show SignedOutException;
import '../../ui/motion.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/kcpl_loader.dart';
import '../ops_controller.dart';
import '../ops_l10n.dart';

/// The second step for Management and Accounts: the code from their
/// authenticator app, or a recovery code. With [setupOnWeb], the app isn't
/// set up yet, which is done once on the KCPL Operations website.
class SecondStepScreen extends StatefulWidget {
  const SecondStepScreen({super.key, this.setupOnWeb = false});
  final bool setupOnWeb;

  @override
  State<SecondStepScreen> createState() => _SecondStepScreenState();
}

class _SecondStepScreenState extends State<SecondStepScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  final _shake = GlobalKey<ShakeState>();
  bool _recovery = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final controller = OpsScope.read(context);
    try {
      await action();
    } on SignedOutException {
      await controller.signOut();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.code == 'network' ? context.l.networkError : (error.message.isNotEmpty ? error.message : context.l.commonUnavailableDetail));
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = context.l.commonUnavailableDetail);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (_error != null) {
      HapticFeedback.heavyImpact();
      _shake.currentState?.shake();
      _code.clear();
      // Once the field is enabled again.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focus.requestFocus();
      });
    }
  }

  void _confirm() {
    final code = _code.text.trim();
    if (code.isEmpty) return;
    _run(() => OpsScope.read(context).confirmSecondStep(code));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l;
    final p = context.palette;
    final controller = OpsScope.of(context);

    final message = AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Motion.easeOut,
      alignment: Alignment.topCenter,
      child: _error == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Semantics(liveRegion: true, child: Notice(card: false, title: _error!)),
            ),
    );

    final button = Pressable(
      child: FilledButton(
        onPressed: _busy ? null : (widget.setupOnWeb ? () => _run(controller.recheckSecondStep) : _confirm),
        style: FilledButton.styleFrom(
          backgroundColor: p.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: p.accent.withValues(alpha: 0.8),
          disabledForegroundColor: Colors.white,
        ),
        child: AnimatedSwitcher(
          duration: Motion.swap,
          switchInCurve: Motion.easeOut,
          switchOutCurve: Motion.easeOut,
          transitionBuilder: morphTransition,
          child: _busy
              ? KcplLoader(key: const ValueKey('busy'), size: 22, color: Colors.white, base: Colors.white.withValues(alpha: 0.35), assemble: false)
              : Text(widget.setupOnWeb ? l.opsTwoStepSetupDone : l.opsTwoStepConfirm, key: const ValueKey('idle')),
        ),
      ),
    );

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(widget.setupOnWeb ? l.opsTwoStepSetupTitle : l.opsTwoStepTitle, style: context.type.displaySmall),
                  const SizedBox(height: 6),
                  Text(
                    widget.setupOnWeb ? l.opsTwoStepSetupBody : l.opsTwoStepSubtitle,
                    style: context.type.bodyLarge?.copyWith(color: p.secondary),
                  ),
                  const SizedBox(height: 28),
                  if (!widget.setupOnWeb) ...[
                    Shake(
                      key: _shake,
                      child: GroupCard(
                        margin: EdgeInsets.zero,
                        child: TextField(
                          // A new field for each kind, so the keyboard changes with it.
                          key: ValueKey(_recovery),
                          controller: _code,
                          focusNode: _focus,
                          enabled: !_busy,
                          autofocus: true,
                          keyboardType: _recovery ? TextInputType.visiblePassword : TextInputType.number,
                          textCapitalization: TextCapitalization.characters,
                          autocorrect: false,
                          enableSuggestions: false,
                          autofillHints: _recovery ? null : const [AutofillHints.oneTimeCode],
                          inputFormatters: _recovery
                              ? [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\- ]')), LengthLimitingTextInputFormatter(12)]
                              : [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                          textInputAction: TextInputAction.done,
                          style: context.type.titleLarge?.copyWith(letterSpacing: _recovery ? 1 : 6, fontFeatures: const [FontFeature.tabularFigures()]),
                          decoration: InputDecoration(
                            labelText: _recovery ? l.opsTwoStepRecovery : l.opsTwoStepCode,
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 12),
                          ),
                          // Six digits is the whole code: go on without a tap.
                          onChanged: (value) {
                            if (!_recovery && value.length == 6) _confirm();
                          },
                          onSubmitted: (_) => _confirm(),
                        ),
                      ),
                    ),
                    message,
                    const SizedBox(height: 24),
                    button,
                    const SizedBox(height: 8),
                    Center(
                      child: TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                _recovery = !_recovery;
                                _error = null;
                                _code.clear();
                              }),
                        style: TextButton.styleFrom(foregroundColor: p.secondary),
                        child: Text(_recovery ? l.opsTwoStepUseApp : l.opsTwoStepUseRecovery),
                      ),
                    ),
                  ] else ...[
                    button,
                    message,
                  ],
                  Center(
                    child: TextButton(
                      onPressed: _busy ? null : controller.signOut,
                      style: TextButton.styleFrom(foregroundColor: p.secondary),
                      child: Text(l.signOut),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
