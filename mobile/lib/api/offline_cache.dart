import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';

/// The last answer KCPL gave to a read, kept on the phone so a screen can
/// still show something on a weak signal at the border, marked with when it
/// was true. It is the signed-in login's own data, kept in the app's private
/// storage, and deleted at sign-out.
abstract class OfflineCache {
  Future<CachedAnswer?> read(String key);
  Future<void> write(String key, String body);
  Future<void> clear();
}

class CachedAnswer {
  const CachedAnswer(this.body, this.savedAt);
  final String body;
  final DateTime savedAt;
}

/// One file per answer, named by a hash of what was asked, so no reference
/// or customer id appears in a file name.
class FileOfflineCache implements OfflineCache {
  FileOfflineCache([Future<Directory> Function()? root]) : _root = root ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _root;

  Future<Directory> _dir() async => Directory('${(await _root()).path}/kcpl-offline');

  Future<File> _file(String key) async => File('${(await _dir()).path}/${sha256.convert(utf8.encode(key))}.json');

  @override
  Future<CachedAnswer?> read(String key) async {
    try {
      final file = await _file(key);
      if (!await file.exists()) return null;
      final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return CachedAnswer(json['body'] as String, DateTime.parse(json['savedAt'] as String));
    } catch (_) {
      // A damaged entry is no entry.
      return null;
    }
  }

  @override
  Future<void> write(String key, String body) async {
    try {
      final file = await _file(key);
      await file.parent.create(recursive: true);
      // Written beside and renamed, so a read never sees half a file.
      final temp = File('${file.path}.part');
      await temp.writeAsString(jsonEncode({'savedAt': DateTime.now().toUtc().toIso8601String(), 'body': body}), flush: true);
      await temp.rename(file.path);
    } catch (_) {
      // Keeping a copy is a courtesy; a full disk must not fail the read.
    }
  }

  @override
  Future<void> clear() async {
    try {
      final dir = await _dir();
      if (await dir.exists()) await dir.delete(recursive: true);
    } catch (_) {}
  }
}

class MemoryOfflineCache implements OfflineCache {
  final entries = <String, CachedAnswer>{};

  @override
  Future<CachedAnswer?> read(String key) async => entries[key];

  @override
  Future<void> write(String key, String body) async => entries[key] = CachedAnswer(body, DateTime.now());

  @override
  Future<void> clear() async => entries.clear();
}

/// Told when a load was answered from the phone rather than from KCPL. Each
/// screen's load runs in its own zone with its own report, so one screen's
/// offline answer can never be reported on another.
class OfflineReport {
  DateTime? _asOf;

  /// When the oldest answer used was true, or null when all came live.
  DateTime? get asOf => _asOf;

  void _served(DateTime savedAt) {
    final current = _asOf;
    if (current == null || savedAt.isBefore(current)) _asOf = savedAt;
  }

  static const _key = #kcplOfflineReport;

  /// Runs [load] with this report listening.
  Future<T> watch<T>(Future<T> Function() load) => runZoned(load, zoneValues: {_key: this});

  /// Whether the load running now has used a kept answer so far.
  static bool get servedOffline {
    final report = Zone.current[_key];
    return report is OfflineReport && report._asOf != null;
  }

  /// Called by the API when it answers from the cache.
  static void served(DateTime savedAt) {
    final report = Zone.current[_key];
    if (report is OfflineReport) report._served(savedAt);
  }
}
