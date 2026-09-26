import '../api/models.dart';
import 'file_opener_io.dart' if (dart.library.js_interop) 'file_opener_web.dart' as impl;

/// Hands a downloaded document to the platform: on a phone, the system viewer
/// (PDF reader, gallery); on the web build, the browser's download. Swapped
/// in tests, where there is no viewer to hand it to.
Future<void> Function(DownloadedFile file) openDownloadedFile = impl.openDownloadedFile;
