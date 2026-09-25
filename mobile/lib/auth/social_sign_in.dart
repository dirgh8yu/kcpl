import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'auth_repository.dart';

/// Gets a Google or Apple identity from the phone's own sign-in sheet, to
/// hand to [AuthRepository.signInWithIdp]. Each returns null when the person
/// cancels.
abstract class SocialSignIn {
  const SocialSignIn();

  /// Neither provider: the email form is the only way in.
  static const SocialSignIn none = _NoSocial();

  /// Whether each button is shown.
  bool get google;
  bool get apple;
  bool get any => google || apple;

  Future<IdpCredential?> withGoogle();
  Future<IdpCredential?> withApple();
}

class _NoSocial extends SocialSignIn {
  const _NoSocial();
  @override
  bool get google => false;
  @override
  bool get apple => false;
  @override
  Future<IdpCredential?> withGoogle() async => null;
  @override
  Future<IdpCredential?> withApple() async => null;
}

/// The sample-data build: both buttons, each signing straight in.
class DemoSocial extends SocialSignIn {
  const DemoSocial();
  @override
  bool get google => true;
  @override
  bool get apple => true;
  @override
  Future<IdpCredential?> withGoogle() async => const IdpCredential(providerId: 'google.com', idToken: 'demo');
  @override
  Future<IdpCredential?> withApple() async => const IdpCredential(providerId: 'apple.com', idToken: 'demo');
}

/// The real thing, switched on per build:
/// - Google needs its OAuth client IDs: [googleIosClientId] (from the iOS
///   app's GoogleService-Info.plist, with its reversed form registered as a
///   URL scheme) on iPhone, and [googleServerClientId] (the "Web client" ID
///   Firebase creates) on Android, whose signing key's SHA-1 must be in
///   Firebase.
/// - Apple needs the Sign in with Apple capability, which a free Apple ID
///   cannot have, so it is off unless [appleEnabled] is set. iPhone only: Apple's
///   own guidelines ask for it where Google is offered, which is iOS.
class PlatformSocial extends SocialSignIn {
  PlatformSocial({this.googleIosClientId, this.googleServerClientId, this.appleEnabled = false});

  final String? googleIosClientId;
  final String? googleServerClientId;

  /// Whether this build has the Sign in with Apple capability.
  final bool appleEnabled;

  bool get _ios => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
  bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  bool get google => (_ios && _set(googleIosClientId)) || (_android && _set(googleServerClientId));

  @override
  bool get apple => appleEnabled && _ios;

  static bool _set(String? value) => value != null && value.isNotEmpty;

  Future<void>? _googleReady;

  @override
  Future<IdpCredential?> withGoogle() async {
    final google = GoogleSignIn.instance;
    await (_googleReady ??= google.initialize(
      clientId: _ios ? googleIosClientId : null,
      serverClientId: _set(googleServerClientId) ? googleServerClientId : null,
    ));
    try {
      final account = await google.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw const AuthFailure(AuthFailureKind.unknown);
      return IdpCredential(providerId: 'google.com', idToken: token);
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled || error.code == GoogleSignInExceptionCode.interrupted) return null;
      throw const AuthFailure(AuthFailureKind.unknown);
    }
  }

  @override
  Future<IdpCredential?> withApple() async {
    // Apple signs a hash of a fresh nonce into its token; Firebase checks it
    // against the raw one, so a token cannot be replayed.
    final nonce = _nonce();
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
        nonce: sha256.convert(utf8.encode(nonce)).toString(),
      );
      final token = credential.identityToken;
      if (token == null) throw const AuthFailure(AuthFailureKind.unknown);
      return IdpCredential(providerId: 'apple.com', idToken: token, nonce: nonce);
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled) return null;
      throw const AuthFailure(AuthFailureKind.unknown);
    }
  }

  static String _nonce([int length = 32]) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => chars[random.nextInt(chars.length)]).join();
  }
}
