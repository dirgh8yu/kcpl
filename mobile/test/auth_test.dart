import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kcpl_customer/auth/auth_repository.dart';
import 'package:kcpl_customer/auth/firebase_rest_auth.dart';
import 'package:kcpl_customer/auth/token_store.dart';

http.Response _json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

void main() {
  late MemoryTokenStore store;
  late DateTime now;
  late List<http.Request> requests;

  FirebaseRestAuth build(Future<http.Response> Function(http.Request) handler) => FirebaseRestAuth(
        apiKey: 'test-key',
        store: store,
        clock: () => now,
        client: MockClient((request) {
          requests.add(request);
          return handler(request);
        }),
      );

  setUp(() {
    store = MemoryTokenStore();
    now = DateTime.utc(2026, 9, 24, 10);
    requests = [];
  });

  test('sign-in keeps the refresh token and serves the ID token from memory', () async {
    final auth = build((request) async {
      expect(request.url.path, '/v1/accounts:signInWithPassword');
      expect(request.url.queryParameters['key'], 'test-key');
      expect(jsonDecode(request.body), {'email': 'ops@acme.example', 'password': 'pw', 'returnSecureToken': true});
      return _json({'idToken': 'id-1', 'refreshToken': 'refresh-1', 'expiresIn': '3600'});
    });

    await auth.signIn('  ops@acme.example ', 'pw');
    expect(store.values[FirebaseRestAuth.refreshKey], 'refresh-1');
    expect(await auth.idToken(), 'id-1');
    expect(requests, hasLength(1), reason: 'a fresh token is not refreshed');
  });

  test('a token near expiry is renewed, and parallel callers share one refresh', () async {
    var refreshes = 0;
    final auth = build((request) async {
      if (request.url.host == 'securetoken.googleapis.com') {
        refreshes++;
        expect(request.bodyFields, {'grant_type': 'refresh_token', 'refresh_token': 'refresh-1'});
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return _json({'id_token': 'id-2', 'refresh_token': 'refresh-2', 'expires_in': '3600'});
      }
      return _json({'idToken': 'id-1', 'refreshToken': 'refresh-1', 'expiresIn': '3600'});
    });
    await auth.signIn('ops@acme.example', 'pw');

    now = now.add(const Duration(minutes: 56));
    final tokens = await Future.wait([auth.idToken(), auth.idToken(), auth.idToken()]);
    expect(tokens, ['id-2', 'id-2', 'id-2']);
    expect(refreshes, 1);
    expect(store.values[FirebaseRestAuth.refreshKey], 'refresh-2');
  });

  test('a restored launch refreshes from the stored token', () async {
    store.values[FirebaseRestAuth.refreshKey] = 'stored';
    final auth = build((request) async => _json({'id_token': 'id-9', 'refresh_token': 'stored-2', 'expires_in': '3600'}));
    expect(await auth.restore(), isTrue);
    expect(await auth.idToken(), 'id-9');
  });

  test('a revoked refresh token signs the phone out and forgets the credential', () async {
    store.values[FirebaseRestAuth.refreshKey] = 'revoked';
    final auth = build((request) async => _json({'error': {'message': 'TOKEN_EXPIRED'}}, 400));
    await auth.restore();
    await expectLater(auth.idToken(), throwsA(isA<SignedOutException>()));
    expect(store.values, isEmpty);
  });

  test('being offline is not being signed out', () async {
    store.values[FirebaseRestAuth.refreshKey] = 'kept';
    final auth = build((request) async => throw http.ClientException('offline'));
    await auth.restore();
    await expectLater(auth.idToken(), throwsA(isA<AuthFailure>().having((f) => f.kind, 'kind', AuthFailureKind.network)));
    expect(store.values[FirebaseRestAuth.refreshKey], 'kept');
  });

  test('no stored credential is signed out', () async {
    final auth = build((request) async => fail('no request expected'));
    expect(await auth.restore(), isFalse);
    await expectLater(auth.idToken(), throwsA(isA<SignedOutException>()));
  });

  test('sign-in errors map to what the screen can say', () async {
    for (final (code, kind) in [
      ('INVALID_LOGIN_CREDENTIALS', AuthFailureKind.invalidCredentials),
      ('EMAIL_NOT_FOUND', AuthFailureKind.invalidCredentials),
      ('TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled', AuthFailureKind.tooManyAttempts),
      ('USER_DISABLED', AuthFailureKind.disabled),
      ('SOMETHING_NEW', AuthFailureKind.unknown),
    ]) {
      final auth = build((request) async => _json({'error': {'message': code}}, 400));
      await expectLater(auth.signIn('a@b.example', 'x'), throwsA(isA<AuthFailure>().having((f) => f.kind, 'kind', kind)), reason: code);
    }
    expect(store.values, isEmpty);
  });

  test('a password reset for an unknown address looks exactly like a known one', () async {
    final auth = build((request) async {
      expect(jsonDecode(request.body)['requestType'], 'PASSWORD_RESET');
      return _json({'error': {'message': 'EMAIL_NOT_FOUND'}}, 400);
    });
    await auth.sendPasswordReset('nobody@acme.example');
  });

  test('sign-out clears the stored credential', () async {
    final auth = build((request) async => _json({'idToken': 'id', 'refreshToken': 'r', 'expiresIn': '3600'}));
    await auth.signIn('a@b.example', 'x');
    await auth.signOut();
    expect(store.values, isEmpty);
    await expectLater(auth.idToken(), throwsA(isA<SignedOutException>()));
  });
}
