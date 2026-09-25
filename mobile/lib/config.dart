/// Build-time configuration, passed with `--dart-define`.
///
/// Nothing here is a secret. The Firebase web API key identifies the project
/// to Firebase Auth and is already shipped to every browser that opens the
/// portal; access is decided by KCPL's server, never by the key.
class AppConfig {
  const AppConfig({
    required this.apiBase,
    required this.firebaseApiKey,
    required this.demo,
    this.googleIosClientId = '',
    this.googleServerClientId = '',
    this.appleSignIn = false,
  });

  /// The KCPL site serving `/api/mobile/v1`. Defaults to the App Hosting
  /// address rather than the public domain, whose DNS still sends some
  /// resolvers to the old WordPress host.
  final Uri apiBase;
  final String firebaseApiKey;

  /// Runs the app against built-in sample data with no network, for store
  /// screenshots and design review. Never on by default.
  final bool demo;

  /// Continue with Google: the iOS OAuth client ID (CLIENT_ID in the iOS
  /// app's GoogleService-Info.plist) and the Web client ID Firebase creates,
  /// which Android signs in against. Public identifiers, not secrets.
  final String googleIosClientId;
  final String googleServerClientId;

  /// Continue with Apple, on iPhone. Needs the Sign in with Apple
  /// capability, which only a paid Apple Developer account can have.
  final bool appleSignIn;

  bool get configured => demo || firebaseApiKey.isNotEmpty;

  static const appHostingBase = 'https://kcpl--kcpl-82574.asia-southeast1.hosted.app';

  factory AppConfig.fromEnvironment() {
    const base = String.fromEnvironment('KCPL_API_BASE', defaultValue: appHostingBase);
    const key = String.fromEnvironment('KCPL_FIREBASE_API_KEY');
    const demo = bool.fromEnvironment('KCPL_DEMO');
    return AppConfig(
      apiBase: Uri.parse(base),
      firebaseApiKey: key,
      demo: demo,
      googleIosClientId: const String.fromEnvironment('KCPL_GOOGLE_IOS_CLIENT_ID'),
      googleServerClientId: const String.fromEnvironment('KCPL_GOOGLE_SERVER_CLIENT_ID'),
      appleSignIn: const bool.fromEnvironment('KCPL_APPLE_SIGN_IN'),
    );
  }
}
