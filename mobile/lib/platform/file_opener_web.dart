import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import '../api/models.dart';

Future<void> openDownloadedFile(DownloadedFile file) async {
  final blob = web.Blob([Uint8List.fromList(file.bytes).toJS].toJS, web.BlobPropertyBag(type: file.contentType));
  final url = web.URL.createObjectURL(blob);
  final anchor = web.HTMLAnchorElement()
    ..href = url
    ..download = file.filename;
  anchor.click();
  web.URL.revokeObjectURL(url);
}
