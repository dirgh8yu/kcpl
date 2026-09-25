import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart';
import '../../session_host.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../map/route_map.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/kcpl_loader.dart';

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
      await SessionScope.read(context).signIn(_email.text, _password.text);
    } on AuthFailure catch (failure) {
      setState(
        () => _error = switch (failure.kind) {
          AuthFailureKind.tooManyAttempts => l.tooManyAttempts,
          AuthFailureKind.network => l.networkError,
          _ => l.signInFailed,
        },
      );
    } on ApiException catch (failure) {
      // KCPL's own refusal (no portal access, unverified email) is worded by
      // the server, identically to the web sign-in.
      setState(
        () => _error = failure.code == 'network'
            ? l.networkError
            : failure.message.isNotEmpty
            ? failure.message
            : l.commonUnavailableDetail,
      );
    } on SignedOutException {
      setState(() => _error = l.signInFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (_error != null) {
      HapticFeedback.heavyImpact();
      _shake.currentState?.shake();
    }
  }

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
      style: TextButton.styleFrom(disabledForegroundColor: p.ink, foregroundColor: p.tertiary, textStyle: context.type.labelLarge),
      child: Text(label),
    );

    final message = _error ?? _notice ?? (controller.sessionEnded ? l.sessionEnded : null);

    return Scaffold(
      body: Stack(
        children: [
          // KCPL's lanes into Nepal, moving behind the mark.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: MediaQuery.sizeOf(context).height * 0.46,
            child: IgnorePointer(
              child: Reveal(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AmbientRouteMap(style: RouteMapStyle.page(p)),
                    // The map gives way to the page beneath it.
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [p.paper.withValues(alpha: 0), p.paper.withValues(alpha: 0), p.paper],
                          stops: const [0, 0.55, 1],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: IntrinsicHeight(
                        child: AutofillGroup(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const SizedBox(height: 28),
                              // The screen assembles top to bottom on launch.
                              Reveal(
                                index: 0,
                                child: Align(
                                  alignment: AlignmentDirectional.centerStart,
                                  child: Image.asset('assets/brand/k-mark.png', width: 34, height: 34, semanticLabel: 'KCPL'),
                                ),
                              ),
                              // On a tall screen the map has room to breathe.
                              SizedBox(height: constraints.maxHeight > 700 ? MediaQuery.sizeOf(context).height * 0.46 - 120 : 56),
                              Reveal(index: 1, child: Text(widget.title ?? l.signInTitle, style: context.type.displaySmall)),
                              const SizedBox(height: 6),
                              Reveal(
                                index: 2,
                                child: Text(
                                  widget.subtitle ?? l.signInSubtitle,
                                  style: context.type.bodyLarge?.copyWith(color: p.secondary),
                                ),
                              ),
                              const SizedBox(height: 28),
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
                                              icon: Icon(_obscure ? KIcons.show : KIcons.hide, size: 20, color: p.secondary),
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
                              AnimatedSize(
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
                              ),
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
                              const Spacer(),
                              const SizedBox(height: 32),
                              Reveal(
                                index: 5,
                                child: Text(l.helpContact, textAlign: TextAlign.center, style: context.type.bodySmall),
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
        ],
      ),
    );
  }
}
