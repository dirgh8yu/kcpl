import 'package:flutter/widgets.dart';

import 'auth/auth_repository.dart';

/// What the shared screens need from whichever app they are in: the customer
/// app's controller and the staff app's both provide it.
abstract class SessionHost extends ChangeNotifier {
  AuthRepository get auth;

  /// Bumped when the data a signed-in screen shows is replaced wholesale
  /// (an agent switching customer), so open screens refetch.
  int get generation;

  /// Set when the app was sent back to sign-in rather than signing out.
  bool get sessionEnded;

  Future<void> signIn(String email, String password);

  /// Called by a screen that found the credential no longer accepted.
  Future<void> expire();

  Future<void> signOut();

  /// Whether the app offers a language choice.
  bool get multilingual;
  Future<void> setLocale(Locale locale);
}

class SessionScope extends InheritedNotifier<SessionHost> {
  const SessionScope({super.key, required SessionHost host, required super.child}) : super(notifier: host);

  static SessionHost of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static SessionHost read(BuildContext context) => context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
