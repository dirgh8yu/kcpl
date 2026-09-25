import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart';
import '../../session_host.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/brand_hero.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/kcpl_loader.dart';

import 'package:sign_in_with_apple/sign_in_with_apple.dart' show SignInWithAppleButton, SignInWithAppleButtonStyle;

import '../../auth/social_sign_in.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key, this.title, this.subtitle});

  /// Overrides for an app other than the customer one (the staff app).
  final String? title;
  final String? subtitle;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  final _shake = GlobalKey<ShakeState>();
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  String? _notice;

  /// The email form, once asked for (it leads when there are no providers).
  bool _showEmail = false;

  /// A Google or Apple identity to connect once the password is accepted.
  IdpCredential? _link;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = l.signInFailed);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await SessionScope.read(context).signIn(_email.text, _password.text, link: _link);
    } catch (error) {
      setState(() => _error = _failure(l, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (_error != null) {
      HapticFeedback.heavyImpact();
      _shake.currentState?.shake();
    }
  }

  /// Continue with Apple or Google: the phone's own sheet proves who the
  /// person is, then KCPL decides, exactly as for a password.
  Future<void> _withProvider({required bool apple}) async {
    final l = AppLocalizations.of(context);
    final host = SessionScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final credential = apple ? await host.social.withApple() : await host.social.withGoogle();
      if (credential != null) await host.signInWithProvider(credential);
    } on NeedsLinking catch (needs) {
      // The address already has a password: one sign-in with it connects
      // the provider for next time.
      setState(() {
        _link = needs.credential;
        _showEmail = true;
        if (needs.email.isNotEmpty) _email.text = needs.email;
        _notice = l.linkProvider(needs.credential.providerName);
      });
      _passwordFocus.requestFocus();
    } catch (error) {
      setState(() => _error = _failure(l, error, provider: apple ? 'Apple' : 'Google'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (_error != null) HapticFeedback.heavyImpact();
  }

  String _failure(AppLocalizations l, Object error, {String? provider}) => switch (error) {
    AuthFailure(kind: AuthFailureKind.tooManyAttempts) => l.tooManyAttempts,
    AuthFailure(kind: AuthFailureKind.network) => l.networkError,
    AuthFailure(kind: AuthFailureKind.providerOff) when provider != null => l.providerOff(provider),
    // KCPL's own refusal (no portal access, unverified email, a hidden Apple
    // address) is worded by the server, identically to the web sign-in.
    ApiException(code: 'network') => l.networkError,
    ApiException(:final message) when message.isNotEmpty => message,
    ApiException() => l.commonUnavailableDetail,
    _ => l.signInFailed,
  };

  Future<void> _reset() async {
    final l = AppLocalizations.of(context);
    if (_email.text.trim().isEmpty) {
      setState(() {
        _notice = null;
        _error = l.resetNeedsEmail;
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).auth.sendPasswordReset(_email.text);
      setState(() => _notice = l.resetSent);
    } on AuthFailure catch (failure) {
      setState(() => _error = failure.kind == AuthFailureKind.network ? l.networkError : l.tooManyAttempts);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// A field on the form's card: no fill or border of its own.
  InputDecoration _field(String hint) => InputDecoration(
    hintText: hint,
    filled: false,
    border: InputBorder.none,
    enabledBorder: InputBorder.none,
    focusedBorder: InputBorder.none,
    disabledBorder: InputBorder.none,
    contentPadding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 14),
  );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final controller = SessionScope.of(context);
    final language = Localizations.localeOf(context).languageCode;

    Widget languageButton(String code, String label) => TextButton(
      onPressed: language == code
          ? null
          : () {
              HapticFeedback.selectionClick();
              controller.setLocale(Locale(code));
            },
      style: TextButton.styleFrom(
        disabledForegroundColor: p.ink,
        foregroundColor: p.tertiary,
        textStyle: context.type.labelLarge,
      ),
      child: Text(label),
    );

    final message = _error ?? _notice ?? (controller.sessionEnded ? l.sessionEnded : null);
    final social = controller.social;
    final emailOpen = !social.any || _showEmail;
    final messageView = AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Motion.easeOut,
      alignment: Alignment.topCenter,
      child: message == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Notice(
                card: false,
                title: message,
                emphasis: _error != null ? Emphasis.attention : Emphasis.normal,
              ),
            ),
    );

    // Light status bar icons on the crimson head.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        // Crimson shows in the bounce above the head, as if it went on.
        backgroundColor: KcplColors.crimson,
        body: LayoutBuilder(
          // Scrolls when the form outgrows the screen (large text, the email
          // form open, the keyboard up). Nothing here needs every child's
          // natural height measured first.
          builder: (context, constraints) => CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: BrandHero(height: math.max(300, constraints.maxHeight * 0.42))),
              SliverToBoxAdapter(
                // The form on a sheet that rises over the crimson, its
                // corners showing the brand behind. Crimson only behind the
                // corners: anywhere else it would bleed through at the
                // sheet's anti-aliased bottom edge.
                child: CustomPaint(
                  painter: const _Band(KcplColors.crimson, top: 0, height: 24),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: p.paper,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 420),
                            child: AutofillGroup(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const SizedBox(height: 28),
                                  Reveal(
                                    index: 1,
                                    child: Text(widget.title ?? l.signInTitle, style: context.type.displaySmall),
                                  ),
                                  const SizedBox(height: 6),
                                  Reveal(
                                    index: 2,
                                    child: Text(
                                      widget.subtitle ?? l.signInSubtitle,
                                      style: context.type.bodyLarge?.copyWith(color: p.secondary),
                                    ),
                                  ),
                                  const SizedBox(height: 28),
                                  // Continue with Apple or Google leads; email follows,
                                  // quieter, for addresses neither provider holds.
                                  if (social.any) ...[
                                    Reveal(
                                      index: 3,
                                      child: _Providers(
                                        social: social,
                                        busy: _busy,
                                        onApple: () => _withProvider(apple: true),
                                        onGoogle: () => _withProvider(apple: false),
                                      ),
                                    ),
                                    if (!emailOpen) ...[
                                      messageView,
                                      const SizedBox(height: 8),
                                      Center(
                                        child: TextButton(
                                          onPressed: _busy ? null : () => setState(() => _showEmail = true),
                                          style: TextButton.styleFrom(foregroundColor: p.secondary),
                                          child: Text(l.signInWithEmail),
                                        ),
                                      ),
                                    ],
                                    if (emailOpen) _OrLine(label: l.orWithEmail),
                                  ],
                                  if (emailOpen) ...[
                                    Reveal(
                                      index: 3,
                                      child: Shake(
                                        key: _shake,
                                        // Both fields on one card, split by a hairline,
                                        // as iOS lays out a sign-in form.
                                        child: GroupCard(
                                          margin: EdgeInsets.zero,
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.stretch,
                                            children: [
                                              TextField(
                                                controller: _email,
                                                enabled: !_busy,
                                                keyboardType: TextInputType.emailAddress,
                                                textInputAction: TextInputAction.next,
                                                autocorrect: false,
                                                enableSuggestions: false,
                                                autofillHints: const [AutofillHints.email, AutofillHints.username],
                                                style: context.type.bodyLarge,
                                                decoration: _field(l.emailLabel),
                                                onSubmitted: (_) => _passwordFocus.requestFocus(),
                                              ),
                                              const Divider(indent: kGutter),
                                              TextField(
                                                controller: _password,
                                                focusNode: _passwordFocus,
                                                enabled: !_busy,
                                                obscureText: _obscure,
                                                textInputAction: TextInputAction.go,
                                                autofillHints: const [AutofillHints.password],
                                                style: context.type.bodyLarge,
                                                decoration: _field(l.passwordLabel).copyWith(
                                                  suffixIcon: IconButton(
                                                    tooltip: _obscure ? l.showPassword : l.hidePassword,
                                                    icon: Icon(
                                                      _obscure ? KIcons.show : KIcons.hide,
                                                      size: 20,
                                                      color: p.secondary,
                                                    ),
                                                    onPressed: () => setState(() => _obscure = !_obscure),
                                                  ),
                                                ),
                                                onSubmitted: (_) => _signIn(),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    messageView,
                                    const SizedBox(height: 24),
                                    Reveal(
                                      index: 4,
                                      child: Pressable(
                                        child: FilledButton(
                                          onPressed: _busy ? null : _signIn,
                                          // The one crimson control in the app: the way in.
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
                                                ? Semantics(
                                                    key: const ValueKey('busy'),
                                                    label: l.signingIn,
                                                    child: KcplLoader(
                                                      size: 22,
                                                      color: Colors.white,
                                                      base: Colors.white.withValues(alpha: 0.35),
                                                      assemble: false,
                                                    ),
                                                  )
                                                : Text(l.signIn, key: const ValueKey('idle')),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Center(
                                      child: TextButton(
                                        onPressed: _busy ? null : _reset,
                                        style: TextButton.styleFrom(foregroundColor: p.secondary),
                                        child: Text(l.forgotPassword),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 40),
                                  Reveal(
                                    index: 5,
                                    child: Text(
                                      l.helpContact,
                                      textAlign: TextAlign.center,
                                      style: context.type.bodySmall,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  if (controller.multilingual)
                                    Wrap(
                                      alignment: WrapAlignment.center,
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      children: [
                                        languageButton('en', 'English'),
                                        Text('·', style: TextStyle(color: p.tertiary)),
                                        languageButton('ne', 'नेपाली'),
                                      ],
                                    ),
                                  const SizedBox(height: 12),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // The sheet runs to the bottom of the screen, and through the
              // bounce past it, so its edge never shows. Painted a point up
              // under the form so no crimson shows at the seam.
              SliverFillRemaining(
                hasScrollBody: false,
                fillOverscroll: true,
                child: CustomPaint(painter: _Band(p.paper, top: -1)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Continue with Apple, then Google, at equal size, as both companies'
/// guidelines ask: Apple's own button (its logo and type), and Google's
/// white button with the four-colour G.
class _Providers extends StatelessWidget {
  const _Providers({required this.social, required this.busy, required this.onApple, required this.onGoogle});
  final SocialSignIn social;
  final bool busy;
  final VoidCallback onApple;
  final VoidCallback onGoogle;

  static const height = 50.0;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (social.apple)
          Pressable(
            // Sized here: Apple's button reports no height of its own, which
            // the page's intrinsic layout needs.
            child: SizedBox(
              height: height,
              child: SignInWithAppleButton(
                onPressed: busy ? null : onApple,
                text: l.continueWithApple,
                height: height,
                style: p.isDark ? SignInWithAppleButtonStyle.white : SignInWithAppleButtonStyle.black,
                borderRadius: BorderRadius.circular(kCardRadius),
              ),
            ),
          ),
        if (social.apple && social.google) const SizedBox(height: 12),
        if (social.google)
          Pressable(
            child: Semantics(
              button: true,
              child: Material(
                color: p.isDark ? const Color(0xFF131314) : Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kCardRadius),
                  side: BorderSide(color: p.isDark ? const Color(0xFF8E918F) : const Color(0xFF747775), width: 1),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: busy ? null : onGoogle,
                  child: SizedBox(
                    height: height,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox.square(dimension: 19, child: CustomPaint(painter: _GoogleG())),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Text(
                            l.continueWithGoogle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.type.labelLarge?.copyWith(
                              color: p.isDark ? const Color(0xFFE3E3E3) : const Color(0xFF1F1F1F),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Google's G in its four colours: a ring open at the upper right, and the
/// blue bar into its middle.
class _GoogleG extends CustomPainter {
  const _GoogleG();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final stroke = s * 0.2;
    final centre = Offset(s / 2, s / 2);
    final rect = Rect.fromCircle(center: centre, radius: s / 2 - stroke / 2);
    double rad(double degrees) => degrees * 3.141592653589793 / 180;
    Paint ring(int colour) => Paint()
      ..color = Color(colour)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(rect, rad(-40), rad(-128), false, ring(0xFFEA4335)); // red, over the top
    canvas.drawArc(rect, rad(-168), rad(-58), false, ring(0xFFFBBC05)); // yellow, left
    canvas.drawArc(rect, rad(134), rad(-104), false, ring(0xFF34A853)); // green, bottom
    canvas.drawArc(rect, rad(30), rad(-30), false, ring(0xFF4285F4)); // blue, right
    canvas.drawRect(Rect.fromLTWH(s / 2, s / 2 - stroke / 2, s / 2, stroke), Paint()..color = const Color(0xFF4285F4));
  }

  @override
  bool shouldRepaint(_GoogleG oldDelegate) => false;
}

/// "or with your email", between hairlines.
class _OrLine extends StatelessWidget {
  const _OrLine({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(label, style: context.type.bodySmall),
        ),
        const Expanded(child: Divider()),
      ],
    ),
  );
}

/// A band of [color] across the box, from [top] (negative reaches above it)
/// down [height] points, or to the bottom when [height] is null.
class _Band extends CustomPainter {
  const _Band(this.color, {required this.top, this.height});

  final Color color;
  final double top;
  final double? height;

  @override
  void paint(Canvas canvas, Size size) {
    final bottom = height == null ? size.height : top + height!;
    canvas.drawRect(Rect.fromLTRB(0, top, size.width, bottom), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_Band old) => old.color != color || old.top != top || old.height != height;
}
