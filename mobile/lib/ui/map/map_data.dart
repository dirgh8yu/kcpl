import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/services.dart' show rootBundle;

/// Web Mercator's y for a latitude, in degree-like units so it shares a
/// scale with longitude, and north up (smaller is further north).
double mercatorY(double lat) {
  final clamped = lat.clamp(-85.0, 85.0) * math.pi / 180;
  return -math.log(math.tan(math.pi / 4 + clamped / 2)) * 180 / math.pi;
}

/// A town the map can label.
class MapPlace {
  const MapPlace(this.rank, this.lat, this.lon, this.name);
  final int rank;
  final double lat;
  final double lon;
  final String name;
}

/// The bundled basemap (assets/map/asia.kmap, built by tool/build_map_data.mjs
/// from Natural Earth), as paths in Mercator units ready to draw at any zoom.
class MapData {
  MapData._();

  final land = Path();
  final lakes = Path();
  final riversMajor = Path();
  final riversMinor = Path();
  final states = Path();
  final borders = Path();

  /// Roads by importance: national highways, main roads, the rest.
  final roadsMajor = Path();
  final roadsMid = Path();
  final roadsMinor = Path();
  final places = <MapPlace>[];

  static Future<MapData>? _loading;
  static MapData? _ready;

  /// The map, if it has finished loading.
  static MapData? get ready => _ready;

  static Future<MapData> load() => _loading ??= rootBundle.load('assets/map/asia.kmap').then((bytes) {
    return _ready = MapData.decode(bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes));
  });

  factory MapData.decode(Uint8List bytes) {
    final data = MapData._();
    final view = ByteData.sublistView(bytes);
    if (utf8.decode(bytes.sublist(0, 4)) != 'KMAP' || bytes[4] != 1) throw const FormatException('Not a KCPL map');
    final west = view.getFloat32(5, Endian.little);
    final south = view.getFloat32(9, Endian.little);
    final step = view.getFloat32(13, Endian.little);
    var at = 17;

    int varint() {
      var result = 0;
      var shift = 0;
      while (true) {
        final byte = bytes[at++];
        result |= (byte & 127) << shift;
        if (byte < 128) return result;
        shift += 7;
      }
    }

    // Arithmetic rather than bitwise: on the web, bitwise results are
    // unsigned, which would turn every step west or south into a leap.
    int zigzag(int v) => v.isOdd ? -((v + 1) ~/ 2) : v ~/ 2;

    while (at < bytes.length) {
      final id = bytes[at++];
      if (id == 255) {
        final count = varint();
        for (var i = 0; i < count; i++) {
          final rank = bytes[at++];
          final lon = west + varint() * step;
          final lat = south + varint() * step;
          final length = varint();
          final name = utf8.decode(bytes.sublist(at, at + length));
          at += length;
          data.places.add(MapPlace(rank, lat, lon, name));
        }
        continue;
      }
      final features = varint();
      for (var f = 0; f < features; f++) {
        final rank = bytes[at++];
        final parts = varint();
        final target = switch (id) {
          1 => data.land,
          2 => data.lakes,
          3 => rank <= 5 ? data.riversMajor : data.riversMinor,
          4 => data.states,
          5 => data.borders,
          _ => rank <= 4 ? data.roadsMajor : (rank <= 7 ? data.roadsMid : data.roadsMinor),
        };
        final closed = id == 1 || id == 2;
        for (var p = 0; p < parts; p++) {
          final points = varint();
          var x = 0;
          var y = 0;
          for (var i = 0; i < points; i++) {
            x += zigzag(varint());
            y += zigzag(varint());
            final lon = west + x * step;
            final my = mercatorY(south + y * step);
            i == 0 ? target.moveTo(lon, my) : target.lineTo(lon, my);
          }
          if (closed) target.close();
        }
      }
    }
    return data;
  }
}
