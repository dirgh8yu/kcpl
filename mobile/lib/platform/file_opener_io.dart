import 'dart:io';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../api/models.dart';

Future<void> openDownloadedFile(DownloadedFile file) async {
  // The app's own cache, not shared storage: the OS clears it, and no other
  // app can read a customer's bill of lading from it.
  final directory = await getTemporaryDirectory();
  final safeName = file.filename.replaceAll(RegExp(r'[\\/:*?"<>|\x00-\x1f]'), '_');
  final target = File('${directory.path}/$safeName');
  await target.writeAsBytes(file.bytes, flush: true);
  final result = await OpenFilex.open(target.path, type: file.contentType.split(';').first);
  if (result.type != ResultType.done) {
    throw FileSystemException(result.message, target.path);
  }
}
