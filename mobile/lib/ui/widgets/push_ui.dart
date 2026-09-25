import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../l10n/app_localizations.dart';
import '../../push/push_service.dart';
import '../../session_host.dart';
import '../motion.dart';
import '../theme.dart';
import 'stats.dart' show Surface;
import 'common.dart';
import 'glass.dart';

/// The words for the push surfaces, so the customer app can pass its
/// translated strings and the staff app its English ones.
class PushCopy {
  const PushCopy({
    required this.primerTitle,
    required this.primerBody,
    required this.turnOn,
    required this.notNow,
    required this.setting,
    required this.on,
    required this.off,
    required this.blocked,
    required this.unavailable,
    required this.blockedHelp,
  });

  final String primerTitle;
  final String primerBody;
  final String turnOn;
  final String notNow;
  final String setting;
  final String on;
  final String off;
  final String blocked;
  final String unavailable;
  final String blockedHelp;
}

/// The customer app's push words, in the person's language.
PushCopy customerPushCopy(AppLocalizations l) => PushCopy(
  primerTitle: l.pushPrimerTitle,
  primerBody: l.pushPrimerBody,
  turnOn: l.pushTurnOn,
  notNow: l.pushNotNow,
  setting: l.pushSetting,
  on: l.pushOn,
  off: l.pushOff,
  blocked: l.pushBlocked,
  unavailable: l.pushUnavailable,
  blockedHelp: l.pushBlockedHelp,
);

/// The staff app's push words (the admin portal is English).
const opsPushCopy = PushCopy(
  primerTitle: 'Get alerts as they happen',
  primerBody: 'Assignments, overdue tasks, customs and exceptions for your jobs, on this phone.',
  turnOn: 'Turn on',
  notNow: 'Not now',
  setting: 'Push notifications',
  on: 'On',
  off: 'Off',
  blocked: "Blocked in your phone's Settings",
  unavailable: 'Not available in this build',
  blockedHelp: "Allow notifications for KCPL Ops in your phone's Settings.",
);

/// A one-time invitation to turn push on, shown only while it would do
/// something, and never again once answered. The OS permission dialog only
/// follows the person's own "Turn on".
class PushPrimer extends StatelessWidget {
  const PushPrimer({super.key, required this.copy});
  final PushCopy copy;

  Future<void> _turnOn(BuildContext context) async {
    final host = SessionScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    HapticFeedback.selectionClick();
    final state = await host.enablePush();
    await host.push.dismissPrimer();
    if (state == PushState.blocked) messenger.showSnackBar(SnackBar(content: Text(copy.blockedHelp)));
  }

  @override
  Widget build(BuildContext context) {
    final push = SessionScope.of(context).push;
    final p = context.palette;
    return ListenableBuilder(
      listenable: push,
      builder: (context, _) {
        final show = push.state == PushState.off && !push.primerDismissed;
        final card = !show
            ? const SizedBox(width: double.infinity)
            : Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Surface(
                  padding: const EdgeInsets.fromLTRB(kGutter, 14, 8, 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Icon(KIcons.alertsOn, size: 20, color: p.ink),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Text(copy.primerTitle, style: context.type.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                            ),
                            const SizedBox(height: 2),
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Text(copy.primerBody, style: context.type.bodyMedium?.copyWith(color: p.secondary)),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () => push.dismissPrimer(),
                                  style: TextButton.styleFrom(foregroundColor: p.secondary, textStyle: context.type.bodyMedium),
                                  child: Text(copy.notNow),
                                ),
                                TextButton(
                                  onPressed: () => _turnOn(context),
                                  style: TextButton.styleFrom(foregroundColor: p.ink, textStyle: context.type.titleSmall),
                                  child: Text(copy.turnOn),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
        // Folds away when answered; under reduce-motion it simply goes.
        if (Motion.reduced(context)) return card;
        return AnimatedSize(
          duration: const Duration(milliseconds: 320),
          curve: Motion.easeOut,
          alignment: Alignment.topCenter,
          child: card,
        );
      },
    );
  }
}

/// The settings row: a switch while push can be changed here, and plain
/// words when it cannot (blocked in Settings, or not in this build).
class PushSettingRow extends StatelessWidget {
  const PushSettingRow({super.key, required this.copy});
  final PushCopy copy;

  @override
  Widget build(BuildContext context) {
    final host = SessionScope.of(context);
    final p = context.palette;
    return ListenableBuilder(
      listenable: host.push,
      builder: (context, _) {
        final state = host.push.state;
        final status = switch (state) {
          PushState.on => copy.on,
          PushState.off => copy.off,
          PushState.blocked => copy.blocked,
          PushState.unavailable => copy.unavailable,
        };
        final changeable = state == PushState.on || state == PushState.off;
        return RowTile(
          title: Text(copy.setting),
          subtitle: Text(status),
          trailing: Switch.adaptive(
            value: state == PushState.on,
            activeTrackColor: p.ink,
            onChanged: !changeable
                ? null
                : (value) async {
                    HapticFeedback.selectionClick();
                    final messenger = ScaffoldMessenger.of(context);
                    if (value) {
                      final result = await host.enablePush();
                      await host.push.dismissPrimer();
                      if (result == PushState.blocked) messenger.showSnackBar(SnackBar(content: Text(copy.blockedHelp)));
                    } else {
                      await host.disablePush();
                    }
                  },
          ),
        );
      },
    );
  }
}

/// Listens for pushes once signed in: a tap on a notification opens what it
/// is about, and one arriving while the app is open drops in as a banner.
class PushRouter extends StatefulWidget {
  const PushRouter({super.key, required this.child, required this.onTarget});
  final Widget child;
  final void Function(BuildContext context, PushTarget target) onTarget;

  @override
  State<PushRouter> createState() => _PushRouterState();
}

class _PushRouterState extends State<PushRouter> {
  StreamSubscription<PushTarget>? _taps;
  StreamSubscription<PushNotice>? _notices;
  OverlayEntry? _banner;
  GlobalKey<_BannerState>? _bannerKey;
  Timer? _hide;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_taps != null) return;
    final push = SessionScope.read(context).push;
    _taps = push.taps.listen((target) {
      if (mounted) widget.onTarget(context, target);
    });
    _notices = push.notices.listen(_show);
  }

  void _show(PushNotice notice) {
    if (!mounted) return;
    _dismiss(animate: false);
    HapticFeedback.lightImpact();
    final overlay = Overlay.of(context);
    final key = GlobalKey<_BannerState>();
    final entry = OverlayEntry(
      builder: (context) => _Banner(
        key: key,
        notice: notice,
        onTap: () {
          _dismiss();
          final target = notice.target;
          if (target != null && mounted) widget.onTarget(this.context, target);
        },
        onDismiss: _dismiss,
      ),
    );
    _banner = entry;
    _bannerKey = key;
    overlay.insert(entry);
    _hide = Timer(const Duration(milliseconds: 4500), _dismiss);
  }

  /// The banner leaves the way it came, back up off the top; replaced by a
  /// newer one, or with the page going away, it simply goes.
  void _dismiss({bool animate = true}) {
    _hide?.cancel();
    _hide = null;
    final entry = _banner;
    final banner = _bannerKey?.currentState;
    _banner = null;
    _bannerKey = null;
    if (entry == null) return;
    if (animate && banner != null) {
      banner.leave().whenComplete(entry.remove);
    } else {
      entry.remove();
    }
  }

  @override
  void dispose() {
    _taps?.cancel();
    _notices?.cancel();
    _dismiss(animate: false);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// A frosted banner that drops in from the top, iOS-style, and can be
/// flicked back up.
class _Banner extends StatefulWidget {
  const _Banner({super.key, required this.notice, required this.onTap, required this.onDismiss});
  final PushNotice notice;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  State<_Banner> createState() => _BannerState();
}

class _BannerState extends State<_Banner> with TickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  // Settles a partial drag back into place instead of snapping.
  late final AnimationController _settle = AnimationController(vsync: this, duration: const Duration(milliseconds: 200))
    ..addListener(() => setState(() => _drag = _from * (1 - Motion.easeOut.transform(_settle.value))));
  double _drag = 0;
  double _from = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _enter.value = 1;
    } else if (!_enter.isAnimating && _enter.value == 0) {
      _enter.forward();
    }
  }

  /// Up follows the finger; down resists more the further it goes, rather
  /// than stopping dead: there is nothing below, but the banner is alive.
  static double _follow(double drag) {
    if (drag <= 0) return drag;
    const dimension = 120.0;
    const constant = 0.55;
    return drag * dimension * constant / (dimension + constant * drag);
  }

  /// Back up and out: 200ms, ease-out, from wherever it is now.
  Future<void> leave() {
    if (Motion.reduced(context)) return Future.value();
    return _enter.animateBack(0, duration: const Duration(milliseconds: 200), curve: Motion.easeOut);
  }

  @override
  void dispose() {
    _enter.dispose();
    _settle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final top = MediaQuery.paddingOf(context).top + 8;
    return Positioned(
      top: top,
      left: 12,
      right: 12,
      child: AnimatedBuilder(
        animation: _enter,
        builder: (context, child) {
          final t = Motion.drawer.transform(_enter.value);
          return Transform.translate(
            offset: Offset(0, (1 - t) * -(top + 90) + _follow(_drag)),
            child: Opacity(opacity: t.clamp(0.0, 1.0), child: child),
          );
        },
        child: GestureDetector(
          onTap: widget.onTap,
          onVerticalDragStart: (_) => _settle.stop(),
          onVerticalDragUpdate: (details) => setState(() => _drag += details.delta.dy),
          onVerticalDragEnd: (details) {
            if (_drag < -24 || (details.primaryVelocity ?? 0) < -110) {
              widget.onDismiss();
            } else if (Motion.reduced(context)) {
              setState(() => _drag = 0);
            } else {
              _from = _drag;
              _settle.forward(from: 0);
            }
          },
          child: Material(
            type: MaterialType.transparency,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 30, offset: const Offset(0, 10))],
              ),
              child: Glass(
                borderRadius: BorderRadius.circular(20),
                opacity: 0.82,
                border: true,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 16, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Image.asset('assets/brand/k-mark.png', width: 22, height: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(widget.notice.title, style: context.type.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                            if (widget.notice.body.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                widget.notice.body,
                                style: context.type.bodySmall?.copyWith(color: p.ink),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
