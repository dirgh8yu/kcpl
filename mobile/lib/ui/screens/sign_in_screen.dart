import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../theme.dart';
import '../widgets/common.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
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
      await AppScope.read(context).signIn(_email.text, _password.text);
    } on AuthFailure catch (failure) {
      setState(() => _error = switch (failure.kind) {
            AuthFailureKind.tooManyAttempts => l.tooManyAttempts,
            AuthFailureKind.network => l.networkError,
            _ => l.signInFailed,
          });
    } on ApiException catch (failure) {
      // KCPL's own refusal (no portal access, unverified email) is worded by
      // the server, identically to the web sign-in.
      setState(() => _error = failure.code == 'network'
          ? l.networkError
          : failure.message.isNotEmpty
              ? failure.message
              : l.commonUnavailableDetail);
    } on SignedOutException {
      setState(() => _error = l.signInFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (_error != null) HapticFeedback.heavyImpact();
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
      await AppScope.read(context).auth.sendPasswordReset(_email.text);
      setState(() => _notice = l.resetSent);
    } on AuthFailure catch (failure) {
      setState(() => _error = failure.kind == AuthFailureKind.network ? l.networkError : l.tooManyAttempts);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final controller = AppScope.of(context);
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

    return Scaffold(
      body: SafeArea(
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
                          Align(
                            alignment: AlignmentDirectional.centerStart,
                            child: Image.asset('assets/brand/k-mark.png', width: 34, height: 34, semanticLabel: 'KCPL'),
                          ),
                          const SizedBox(height: 56),
                          Text(l.signInTitle, style: context.type.headlineMedium),
                          const SizedBox(height: 10),
                          Text(l.signInSubtitle, style: context.type.bodyLarge?.copyWith(color: p.secondary)),
                          const SizedBox(height: 36),
                          TextField(
                            controller: _email,
                            enabled: !_busy,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            enableSuggestions: false,
                            autofillHints: const [AutofillHints.email, AutofillHints.username],
                            style: context.type.bodyLarge,
                            decoration: InputDecoration(hintText: l.emailLabel),
                            onSubmitted: (_) => _passwordFocus.requestFocus(),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password,
                            focusNode: _passwordFocus,
                            enabled: !_busy,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.go,
                            autofillHints: const [AutofillHints.password],
                            style: context.type.bodyLarge,
                            decoration: InputDecoration(
                              hintText: l.passwordLabel,
                              suffixIcon: IconButton(
                                tooltip: _obscure ? l.showPassword : l.hidePassword,
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 22),
                                onPressed: () => setState(() => _obscure = !_obscure),
                              ),
                            ),
                            onSubmitted: (_) => _signIn(),
                          ),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeOutCubic,
                            alignment: Alignment.topCenter,
                            child: message == null
                                ? const SizedBox(width: double.infinity)
                                : Padding(
                                    padding: const EdgeInsets.only(top: 18),
                                    child: Notice(
                                      padding: EdgeInsets.zero,
                                      title: message,
                                      emphasis: _error != null ? Emphasis.attention : Emphasis.normal,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: _busy ? null : _signIn,
                            child: _busy
                                ? Semantics(
                                    label: l.signingIn,
                                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: p.tertiary)),
                                  )
                                : Text(l.signIn),
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
                          Text(l.helpContact, textAlign: TextAlign.center, style: context.type.bodySmall),
                          const SizedBox(height: 6),
                          Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [
                            languageButton('en', 'English'),
                            Text('·', style: TextStyle(color: p.tertiary)),
                            languageButton('ne', 'नेपाली'),
                          ]),
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
    );
  }
}
