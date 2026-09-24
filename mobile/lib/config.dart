/// Build-time configuration, passed with `--dart-define`.
///
/// Nothing here is a secret. The Firebase web API key identifies the project
/// to Firebase Auth and is already shipped to every browser that opens the
/// portal; access is decided by KCPL's server, never by the key.
class AppConfig {
  const AppConfig({required this.apiBase, required this.firebaseApiKey, required this.demo});

  /// The KCPL site serving `/api/mobile/v1`.
  final Uri apiBase;
  final String firebaseApiKey;

  /// Runs the app against built-in sample data with no network, for store
  /// screenshots and design review. Never on by default.
  final bool demo;

  bool get configured => demo || firebaseApiKey.isNotEmpty;

  factory AppConfig.fromEnvironment() {
    const base = String.fromEnvironment('KCPL_API_BASE', defaultValue: 'https://kapileshworcargo.com.np');
    const key = String.fromEnvironment('KCPL_FIREBASE_API_KEY');
    const demo = bool.fromEnvironment('KCPL_DEMO');
    return AppConfig(apiBase: Uri.parse(base), firebaseApiKey: key, demo: demo);
  }
}
