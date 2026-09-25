import 'package:http/http.dart' as http;

import 'models.dart' show SendProgress;

/// A request whose body is handed over in small pieces, reporting each one as
/// the connection takes it. The pieces are pulled, not pushed, so progress
/// follows the socket rather than racing ahead of it.
class ProgressingRequest extends http.BaseRequest {
  ProgressingRequest(super.method, super.url, this._body);
  final Stream<List<int>> _body;

  static const _piece = 32 * 1024;

  static http.BaseRequest wrap(http.MultipartRequest multipart, SendProgress? onProgress) {
    if (onProgress == null) return multipart;
    final body = multipart.finalize();
    final total = multipart.contentLength;
    Stream<List<int>> pieces() async* {
      var sent = 0;
      onProgress(0);
      await for (final chunk in body) {
        for (var start = 0; start < chunk.length; start += _piece) {
          final end = start + _piece < chunk.length ? start + _piece : chunk.length;
          yield chunk.sublist(start, end);
          sent += end - start;
          onProgress(total == 0 ? 1 : sent / total);
        }
      }
    }

    return ProgressingRequest(multipart.method, multipart.url, pieces())
      ..headers.addAll(multipart.headers)
      ..contentLength = total;
  }

  @override
  http.ByteStream finalize() {
    super.finalize();
    return http.ByteStream(_body);
  }
}
