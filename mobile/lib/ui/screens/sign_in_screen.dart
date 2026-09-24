import 'package:flutter/material.dart';

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
    final theme = Theme.of(context);
    final controller = AppScope.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Image.asset('assets/brand/k-mark.png', width: 32, height: 32, semanticLabel: 'KCPL'),
                        const SizedBox(width: 12),
                        Flexible(child: Text('Kapileshwor Cargo', style: theme.textTheme.titleMedium)),
                      ],
                    ),
                    const SizedBox(height: 40),
                    Text(l.signInTitle, style: theme.textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text(l.signInSubtitle, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 28),
                    if (controller.sessionEnded && _error == null) ...[
                      Callout(margin: EdgeInsets.zero, tone: Tone.info, icon: Icons.lock_clock_outlined, title: l.sessionEnded),
                      const SizedBox(height: 16),
                    ],
                    TextField(
                      controller: _email,
                      enabled: !_busy,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      autofillHints: const [AutofillHints.email, AutofillHints.username],
                      decoration: InputDecoration(labelText: l.emailLabel),
                      onSubmitted: (_) => _passwordFocus.requestFocus(),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      focusNode: _passwordFocus,
                      enabled: !_busy,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: l.passwordLabel,
                        suffixIcon: IconButton(
                          tooltip: _obscure ? l.showPassword : l.hidePassword,
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      onSubmitted: (_) => _signIn(),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(onPressed: _busy ? null : _reset, child: Text(l.forgotPassword)),
                    ),
                    const SizedBox(height: 8),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOut,
                      child: _error != null
                          ? Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Callout(margin: EdgeInsets.zero, tone: Tone.danger, icon: Icons.error_outline_rounded, title: _error!),
                            )
                          : _notice != null
                              ? Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: Callout(margin: EdgeInsets.zero, tone: Tone.success, icon: Icons.mark_email_read_outlined, title: _notice!),
                                )
                              : const SizedBox.shrink(),
                    ),
                    FilledButton(
                      onPressed: _busy ? null : _signIn,
                      child: Text(_busy ? l.signingIn : l.signIn),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      l.helpContact,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'en', label: Text('English')),
                          ButtonSegment(value: 'ne', label: Text('नेपाली')),
                        ],
                        selected: {Localizations.localeOf(context).languageCode},
                        showSelectedIcon: false,
                        onSelectionChanged: (value) => controller.setLocale(Locale(value.first)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
