/// Why a sign-in attempt did not succeed, in terms the screen can word.
/// [providerOff]: Google or Apple sign-in is not switched on in Firebase.
enum AuthFailureKind { invalidCredentials, tooManyAttempts, disabled, network, providerOff, unknown }

/// Proof of identity from Google or Apple, to exchange for a Firebase
/// sign-in. It proves who the person is and nothing more: what they may see
/// is still decided by KCPL's server, against the account provisioned for
/// their email.
class IdpCredential {
  const IdpCredential({required this.providerId, required this.idToken, this.nonce});

  /// `google.com` or `apple.com`.
  final String providerId;
  final String idToken;

  /// The raw nonce whose hash the provider signed into [idToken] (Apple).
  final String? nonce;

  String get providerName => providerId == 'apple.com' ? 'Apple' : 'Google';
}

/// The email already has a KCPL password login. Signing in with that
/// password once connects [credential] to it, so next time one tap does.
class NeedsLinking implements Exception {
  const NeedsLinking(this.email, this.credential);
  final String email;
  final IdpCredential credential;

  @override
  String toString() => 'NeedsLinking(${credential.providerId})';
}

class AuthFailure implements Exception {
  const AuthFailure(this.kind);
  final AuthFailureKind kind;

  @override
  String toString() => 'AuthFailure($kind)';
}

/// The stored credential is gone or no longer accepted. The only recovery is
/// signing in again.
class SignedOutException implements Exception {
  const SignedOutException();
}

/// Who the phone is signed in as. Kept behind an interface so the screens and
/// API client never depend on how tokens are obtained.
abstract class AuthRepository {
  /// Picks up a sign-in from a previous launch. True when one was found.
  Future<bool> restore();

  Future<void> signIn(String email, String password);

  /// Signs in with Google or Apple. Throws [NeedsLinking] when the email
  /// already has a password login that must be used once first.
  Future<void> signInWithIdp(IdpCredential credential);

  /// Connects [credential] to the login now signed in, so it can be used
  /// next time. Best effort: a failure leaves the sign-in as it is.
  Future<void> link(IdpCredential credential);

  /// Never reveals whether the address has an account.
  Future<void> sendPasswordReset(String email);

  /// A current Firebase ID token for the Authorization header. Throws
  /// [SignedOutException] when there is no usable credential.
  Future<String> idToken({bool forceRefresh = false});

  Future<void> signOut();
}
