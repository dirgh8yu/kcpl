import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// The order a driver chose for the day's stops, kept on the phone per day
/// (Nepal's date). A stop the server adds later goes to the end; one that
/// has gone drops out.
abstract class RouteOrderStore {
  Future<List<String>> load(String day);
  Future<void> save(String day, List<String> references);

  /// The stops in the chosen order, with any new ones after.
  static List<T> apply<T>(List<T> stops, List<String> order, String Function(T) reference) {
    final byRef = {for (final stop in stops) reference(stop): stop};
    return [
      for (final ref in order)
        if (byRef.containsKey(ref)) byRef[ref] as T,
      for (final stop in stops)
        if (!order.contains(reference(stop))) stop,
    ];
  }
}

class MemoryRouteOrderStore implements RouteOrderStore {
  final Map<String, List<String>> days = {};

  @override
  Future<List<String>> load(String day) async => days[day] ?? const [];

  @override
  Future<void> save(String day, List<String> references) async => days[day] = [...references];
}

/// One small file, holding only today's order; older days are dropped.
class FileRouteOrderStore implements RouteOrderStore {
  FileRouteOrderStore([Future<Directory> Function()? root]) : _root = root ?? getApplicationSupportDirectory;
  final Future<Directory> Function() _root;

  Future<File> _file() async => File('${(await _root()).path}/kcpl-route.json');

  @override
  Future<List<String>> load(String day) async {
    try {
      final file = await _file();
      if (!await file.exists()) return const [];
      final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return json['day'] == day ? (json['order'] as List).whereType<String>().toList() : const [];
    } catch (_) {
      return const [];
    }
  }

  @override
  Future<void> save(String day, List<String> references) async {
    try {
      final file = await _file();
      await file.writeAsString(jsonEncode({'day': day, 'order': references}), flush: true);
    } catch (_) {
      // A lost order is re-made with two drags; never worth an error.
    }
  }
}
