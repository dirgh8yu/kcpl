import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_lock.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/device_unlock.dart';
import '../motion.dart';
import '../theme.dart';
import 'kcpl_loader.dart' show KPainter;

/// "Face ID", "Touch ID", "fingerprint" or "your passcode", as this phone has it.
String unlockMethodName(AppLocalizations l, UnlockMethod method) => switch (method) {
  UnlockMethod.faceId => l.lockFaceId,
  UnlockMethod.touchId => l.lockTouchId,
  UnlockMethod.fingerprint => l.lockFingerprint,
  UnlockMethod.passcode => l.lockPasscode,
};

/// Covers the signed-in app while it is locked, and in the app switcher.
/// The app underneath keeps its place: unlocking returns to exactly where
/// the person was, mid-form or mid-upload.
class LockGate extends StatelessWidget {
  const LockGate({super.key, required this.lock, required this.child, required this.onSignOut});
  final AppLock lock;
  final Widget child;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: lock,
      child: child,
      builder: (context, child) {
        final hidden = lock.locked || lock.covered;
        return Stack(
          children: [
            // Nothing behind the cover is read out or reachable.
            ExcludeSemantics(excluding: hidden, child: child!),
            AnimatedSwitcher(
              duration: Motion.reduced(context) ? const Duration(milliseconds: 150) : const Duration(milliseconds: 260),
              switchInCurve: Motion.easeOut,
              switchOutCurve: Motion.easeOut,
              // Unlocking lifts the cover away a touch larger, as the Lock
              // Screen does; covering is instant, since it must be there
              // before the app switcher's snapshot is taken.
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: Motion.reduced(context)
                    ? child
                    : ScaleTransition(scale: Tween(begin: 1.04, end: 1.0).animate(animation), child: child),
              ),
              child: lock.locked
                  ? _LockScreen(key: const ValueKey('locked'), lock: lock, onSignOut: onSignOut)
                  : lock.covered
                  ? const _Cover(key: ValueKey('cover'))
                  : const SizedBox.shrink(key: ValueKey('open')),
            ),
          ],
        );
      },
    );
  }
}

/// The brand and nothing else: what the app switcher shows.
class _Cover extends StatelessWidget {
  const _Cover({super.key});

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: KcplColors.crimson,
    child: Center(
      child: SizedBox.square(
        dimension: 64,
        child: CustomPaint(
          painter: KPainter(intro: 1, wave: null, charge: Colors.white, base: Colors.white),
        ),
      ),
    ),
  );
}

class _LockScreen extends StatefulWidget {
  const _LockScreen({super.key, required this.lock, required this.onSignOut});
  final AppLock lock;
  final VoidCallback onSignOut;

  @override
  State<_LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<_LockScreen> with WidgetsBindingObserver {
  bool _asking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Asks at once, as a banking app does, when the app is in front.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) _unlock();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_asking) _unlock();
  }

  Future<void> _unlock() async {
    if (_asking || !mounted) return;
    final reason = AppLocalizations.of(context).lockReason;
    setState(() => _asking = true);
    final ok = await widget.lock.unlock(reason);
    if (ok) HapticFeedback.lightImpact();
    if (mounted) setState(() => _asking = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final method = widget.lock.method;
    return AnnotatedRegion(
      value: SystemUiOverlayStyle.light,
      child: Material(
        color: KcplColors.crimson,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(32, 0, 32, 16),
            child: Column(
              children: [
                const Spacer(flex: 3),
                SizedBox.square(
                  dimension: 64,
                  child: CustomPaint(
                    painter: KPainter(intro: 1, wave: null, charge: Colors.white, base: Colors.white),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  l.lockTitle,
                  textAlign: TextAlign.center,
                  style: context.type.headlineSmall?.copyWith(color: Colors.white),
                ),
                const Spacer(flex: 4),
                Pressable(
                  child: FilledButton.icon(
                    onPressed: _asking ? null : _unlock,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: KcplColors.crimson,
                      disabledBackgroundColor: Colors.white.withValues(alpha: 0.8),
                      disabledForegroundColor: KcplColors.crimson,
                    ),
                    icon: const Icon(KIcons.faceId, size: 20),
                    label: Text(method == null ? l.lockUnlock : '${l.lockUnlock} · ${unlockMethodName(l, method)}'),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: widget.onSignOut,
                  style: TextButton.styleFrom(foregroundColor: Colors.white.withValues(alpha: 0.85)),
                  child: Text(l.signOut),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
