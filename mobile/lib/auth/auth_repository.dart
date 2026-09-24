/// Why a sign-in attempt did not succeed, in terms the screen can word.
enum AuthFailureKind { invalidCredentials, tooManyAttempts, disabled, network, unknown }

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

  /// Never reveals whether the address has an account.
  Future<void> sendPasswordReset(String email);

  /// A current Firebase ID token for the Authorization header. Throws
  /// [SignedOutException] when there is no usable credential.
  Future<String> idToken({bool forceRefresh = false});

  Future<void> signOut();
}
