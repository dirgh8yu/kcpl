import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';

import '../../api/kcpl_api.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../session_host.dart';
import '../motion.dart';
import '../theme.dart';
import 'capture.dart';
import 'common.dart';
import 'large_title.dart';

/// A form in a sheet: a large title, the fields, and one action kept at the
/// foot of the screen where a thumb already is, as the quote request does.
class ComposeScaffold extends StatelessWidget {
  const ComposeScaffold({super.key, required this.title, required this.children, this.action, this.error});
  final String title;
  final List<Widget> children;

  /// Usually a [SendButton]. None for a sheet whose rows are the actions:
  /// the sheet's own close button is the way out.
  final Widget? action;

  /// Shown over the action, where the eye already is when it fails.
  final String? error;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                LargeTitleBar(title: title),
                SliverList(delegate: SliverChildListDelegate([...children, const SizedBox(height: 24)])),
              ],
            ),
          ),
          if (action == null)
            SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 10), child: ErrorLine(error)))
          else
          DecoratedBox(
            decoration: BoxDecoration(
              color: p.paper,
              border: Border(top: BorderSide(color: p.hairline, width: 0.33)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [ErrorLine(error), action!],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A failure over the action. It opens its own space rather than pushing the
/// button down in one jump; under Reduce Motion it simply appears.
class ErrorLine extends StatelessWidget {
  const ErrorLine(this.error, {super.key});
  final String? error;

  @override
  Widget build(BuildContext context) {
    final line = error == null
        ? const SizedBox(width: double.infinity)
        : Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Notice(card: false, title: error!),
          );
    if (Motion.reduced(context)) return line;
    return AnimatedSize(duration: const Duration(milliseconds: 200), curve: Motion.easeOut, alignment: Alignment.bottomCenter, child: line);
  }
}

/// The crimson action of a form. While sending it becomes its own progress
/// bar: the fill runs left to right as bytes leave the phone, so a photo on a
/// weak signal is visibly moving, not stuck. With no [progress] to report it
/// shows a spinner instead.
class SendButton extends StatelessWidget {
  const SendButton({super.key, required this.label, required this.onPressed, this.busy = false, this.progress});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  /// 0 to 1 while an upload is under way.
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    if (!busy) {
      return Pressable(
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(backgroundColor: p.accent, foregroundColor: Colors.white),
          child: Text(label),
        ),
      );
    }
    final progress = this.progress;
    final percent = progress == null ? null : (progress.clamp(0, 1) * 100).round();
    const white = TextStyle(color: Colors.white, fontFeatures: [FontFeature.tabularFigures()]);
    return Semantics(
      liveRegion: true,
      label: percent == null ? l.sending : l.sendingPercent('$percent'),
      excludeSemantics: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kCardRadius),
        child: SizedBox(
          height: 50,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: p.accent.withValues(alpha: 0.55)),
              if (progress != null)
                // Linear and short: it follows the bytes rather than
                // decorating them, and never lags a finished upload by much.
                TweenAnimationBuilder<double>(
                  tween: Tween(end: progress.clamp(0, 1).toDouble()),
                  duration: Motion.reduced(context) ? Duration.zero : const Duration(milliseconds: 180),
                  builder: (context, value, _) => FractionallySizedBox(
                    alignment: AlignmentDirectional.centerStart,
                    widthFactor: value,
                    child: ColoredBox(color: p.accent),
                  ),
                ),
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (percent == null) ...[const CupertinoActivityIndicator(color: Colors.white, radius: 9), const SizedBox(width: 10)],
                    Text(percent == null ? l.sending : l.sendingPercent('$percent'), style: context.type.labelLarge?.merge(white)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Done: a tick, what happened, and the one way out. Rare, so the tick may
/// arrive with a little life; under Reduce Motion it fades in.
class DoneView extends StatelessWidget {
  const DoneView({super.key, required this.title, required this.body, this.reference, this.extra, this.onDone});
  final String title;
  final String body;

  /// Shown whole and selectable, for any call to KCPL.
  final String? reference;

  /// Anything further, such as a link to pass on.
  final Widget? extra;
  final VoidCallback? onDone;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final reduced = Motion.reduced(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: Column(
            children: [
              const Spacer(),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: reduced ? const Duration(milliseconds: 200) : const Duration(milliseconds: 360),
                curve: Motion.easeOut,
                builder: (context, t, child) => Opacity(
                  opacity: t,
                  child: Transform.scale(scale: reduced ? 1 : 0.9 + 0.1 * t, child: child),
                ),
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: p.ink, shape: BoxShape.circle),
                  child: Icon(KIcons.check, size: 30, color: p.surface),
                ),
              ),
              const SizedBox(height: 20),
              Text(title, style: context.type.headlineMedium, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(
                body,
                style: context.type.bodyLarge?.copyWith(color: p.secondary),
                textAlign: TextAlign.center,
              ),
              if (reference != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(10)),
                  child: SelectableText(
                    reference!,
                    style: context.type.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
              ],
              if (extra != null) ...[const SizedBox(height: 20), extra!],
              const Spacer(),
              FilledButton(onPressed: onDone ?? () => Navigator.of(context).maybePop(true), child: Text(l.quoteDone)),
            ],
          ),
        ),
      ),
    );
  }
}

/// A text field on a card: no fill or border of its own.
InputDecoration cardField(String hint, {Widget? suffix}) => InputDecoration(
  hintText: hint,
  filled: false,
  border: InputBorder.none,
  enabledBorder: InputBorder.none,
  focusedBorder: InputBorder.none,
  disabledBorder: InputBorder.none,
  suffix: suffix,
  contentPadding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 14),
);

/// A failed send, in words for the person holding the phone.
String describeFailure(AppLocalizations l, Object error) => switch (error) {
  ApiException(code: 'network') => l.networkError,
  ApiException(:final message) when message.isNotEmpty => message,
  AttachmentRefused() => attachmentRefusal(l, error),
  _ => l.commonUnavailableDetail,
};

/// Runs a send from a sheet: a signed-out reply ends the session, anything
/// else is returned as words for [ErrorLine].
Future<String?> attempt(BuildContext context, Future<void> Function() send) async {
  final l = AppLocalizations.of(context);
  final host = SessionScope.read(context);
  try {
    await send();
    return null;
  } on SignedOutException {
    await host.expire();
    return null;
  } catch (error) {
    return describeFailure(l, error);
  }
}
