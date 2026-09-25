import 'package:flutter/widgets.dart';

import 'auth/auth_repository.dart';
import 'auth/social_sign_in.dart';
import 'push/push_service.dart';

/// What the shared screens need from whichever app they are in: the customer
/// app's controller and the staff app's both provide it.
abstract class SessionHost extends ChangeNotifier {
  AuthRepository get auth;

  /// Bumped when the data a signed-in screen shows is replaced wholesale
  /// (an agent switching customer), so open screens refetch.
  int get generation;

  /// Set when the app was sent back to sign-in rather than signing out.
  bool get sessionEnded;

  /// With [link], a Google or Apple identity is connected to this login
  /// once the password is accepted (see [NeedsLinking]).
  Future<void> signIn(String email, String password, {IdpCredential? link});

  /// Continue with Google or Apple, where this app offers them.
  SocialSignIn get social => SocialSignIn.none;

  /// Signs in with a Google or Apple identity. Throws [NeedsLinking] when
  /// the email already has a password login.
  Future<void> signInWithProvider(IdpCredential credential) => throw UnsupportedError('No provider sign-in in this app');

  /// Called by a screen that found the credential no longer accepted.
  Future<void> expire();

  Future<void> signOut();

  /// Push for this app; a [NoPushService] when the build has no Firebase
  /// config.
  PushService get push;

  /// The person's "Turn on" / "Turn off" for push on this phone.
  Future<PushState> enablePush();
  Future<void> disablePush();

  /// Whether the app offers a language choice.
  bool get multilingual;
  Future<void> setLocale(Locale locale);
}

class SessionScope extends InheritedNotifier<SessionHost> {
  const SessionScope({super.key, required SessionHost host, required super.child}) : super(notifier: host);

  static SessionHost of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static SessionHost read(BuildContext context) => context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
