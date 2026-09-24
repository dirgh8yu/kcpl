import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_repository.dart';
import 'token_store.dart';

/// Firebase Auth over its public REST API: the same email and password
/// accounts the web portal signs in with, with no native Firebase SDK and no
/// platform config files to ship.
///
/// The refresh token is persisted in [TokenStore]; ID tokens (one hour) are
/// kept in memory and renewed shortly before they expire.
class FirebaseRestAuth implements AuthRepository {
  FirebaseRestAuth({
    required this.apiKey,
    required this.store,
    http.Client? client,
    DateTime Function()? clock,
  })  : _client = client ?? http.Client(),
        _now = clock ?? DateTime.now;

  final String apiKey;
  final TokenStore store;
  final http.Client _client;
  final DateTime Function() _now;

  static const refreshKey = 'kcpl.refresh_token';

  /// Renew this long before expiry, so a token never expires mid-request.
  static const _renewMargin = Duration(minutes: 5);

  String? _idToken;
  DateTime? _expiresAt;
  String? _refreshToken;
  Future<String>? _pendingRefresh;

  @override
  Future<bool> restore() async {
    _refreshToken = await store.read(refreshKey);
    return _refreshToken != null;
  }

  @override
  Future<void> signIn(String email, String password) async {
    final body = await _post(
      Uri.https('identitytoolkit.googleapis.com', '/v1/accounts:signInWithPassword', {'key': apiKey}),
      jsonEncode({'email': email.trim(), 'password': password, 'returnSecureToken': true}),
      contentType: 'application/json',
    );
    await _accept(
      idToken: body['idToken'] as String,
      refreshToken: body['refreshToken'] as String,
      expiresIn: body['expiresIn'],
    );
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    try {
      await _post(
        Uri.https('identitytoolkit.googleapis.com', '/v1/accounts:sendOobCode', {'key': apiKey}),
        jsonEncode({'requestType': 'PASSWORD_RESET', 'email': email.trim()}),
        contentType: 'application/json',
      );
    } on AuthFailure catch (failure) {
      // An unknown address is reported exactly like a known one, so this
      // screen cannot be used to find out who has a KCPL login.
      if (failure.kind != AuthFailureKind.invalidCredentials) rethrow;
    }
  }

  @override
  Future<String> idToken({bool forceRefresh = false}) {
    final token = _idToken;
    final expiresAt = _expiresAt;
    if (!forceRefresh && token != null && expiresAt != null && _now().isBefore(expiresAt.subtract(_renewMargin))) {
      return Future.value(token);
    }
    // Screens load in parallel; they share one refresh instead of racing.
    return _pendingRefresh ??= _refresh().whenComplete(() => _pendingRefresh = null);
  }

  Future<String> _refresh() async {
    final refreshToken = _refreshToken ?? await store.read(refreshKey);
    if (refreshToken == null) throw const SignedOutException();
    final Map<String, dynamic> body;
    try {
      body = await _post(
        Uri.https('securetoken.googleapis.com', '/v1/token', {'key': apiKey}),
        'grant_type=refresh_token&refresh_token=${Uri.encodeQueryComponent(refreshToken)}',
        contentType: 'application/x-www-form-urlencoded',
      );
    } on AuthFailure catch (failure) {
      if (failure.kind == AuthFailureKind.network) rethrow;
      // Revoked, disabled, deleted or password changed: the stored credential
      // is dead, and keeping it would only fail again on every launch.
      await signOut();
      throw const SignedOutException();
    }
    await _accept(
      idToken: body['id_token'] as String,
      refreshToken: body['refresh_token'] as String,
      expiresIn: body['expires_in'],
    );
    return _idToken!;
  }

  Future<void> _accept({required String idToken, required String refreshToken, required Object? expiresIn}) async {
    _idToken = idToken;
    _refreshToken = refreshToken;
    final seconds = int.tryParse('$expiresIn') ?? 3600;
    _expiresAt = _now().add(Duration(seconds: seconds));
    await store.write(refreshKey, refreshToken);
  }

  @override
  Future<void> signOut() async {
    _idToken = null;
    _expiresAt = null;
    _refreshToken = null;
    await store.delete(refreshKey);
  }

  Future<Map<String, dynamic>> _post(Uri uri, String body, {required String contentType}) async {
    final http.Response response;
    try {
      response = await _client
          .post(uri, headers: {'content-type': contentType}, body: body)
          .timeout(const Duration(seconds: 20));
    } on TimeoutException {
      throw const AuthFailure(AuthFailureKind.network);
    } on http.ClientException {
      throw const AuthFailure(AuthFailureKind.network);
    }

    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(response.body) as Map<String, dynamic>;
    } on FormatException {
      decoded = const {};
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return decoded;
    throw AuthFailure(failureKind(firebaseErrorCode(decoded)));
  }
}

/// Firebase REST errors come in two shapes: `{error: {message}}` from Identity
/// Toolkit and `{error: "..."}` from Secure Token. The message may carry a
/// suffix such as "TOO_MANY_ATTEMPTS_TRY_LATER : Access disabled...".
String firebaseErrorCode(Map<String, dynamic> body) {
  final error = body['error'];
  final message = error is Map ? error['message'] : error;
  return '${message ?? ''}'.split(' ').first.trim();
}

AuthFailureKind failureKind(String code) {
  switch (code) {
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_EMAIL':
    case 'MISSING_PASSWORD':
    case 'USER_NOT_FOUND':
    case 'TOKEN_EXPIRED':
    case 'INVALID_REFRESH_TOKEN':
      return AuthFailureKind.invalidCredentials;
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return AuthFailureKind.tooManyAttempts;
    case 'USER_DISABLED':
      return AuthFailureKind.disabled;
    default:
      return AuthFailureKind.unknown;
  }
}
