import 'dart:math' as math;
import 'dart:typed_data';

/// Pictures for the demo build's proof of delivery, drawn here rather than
/// shipped as assets, so the store build carries none of them: a signature
/// on paper, and a parcel at a door.
class DemoImages {
  static final Uint8List signature = _signature();
  static final Uint8List parcel = _parcel();

  static Uint8List _signature() {
    const w = 360, h = 140;
    final canvas = _Canvas(w, h, (250, 250, 247));
    // A name written in one stroke: loops riding a gently falling baseline.
    (double, double) at(double t) => (
      28 + t * 290 + 14 * math.sin(t * 38),
      76 - t * 14 + 26 * math.sin(t * 19) * math.cos(t * 5.5) - 10 * math.sin(t * 38 + 1.2),
    );
    for (var i = 0; i <= 4000; i++) {
      final (x, y) = at(i / 4000);
      canvas.dot(x, y, 1.7, (24, 32, 58));
    }
    // The flourish under it.
    for (var i = 0; i <= 900; i++) {
      final t = i / 900;
      canvas.dot(60 + t * 230, 112 + 6 * math.sin(t * math.pi), 1.3, (24, 32, 58));
    }
    return canvas.png();
  }

  static Uint8List _parcel() {
    const w = 360, h = 270;
    final canvas = _Canvas(w, h, (0, 0, 0));
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final floor = y > 190;
        final shade = floor ? 120 - (y - 190) ~/ 2 : 214 - y ~/ 6;
        canvas.set(x, y, floor ? (shade, shade - 8, shade - 18) : (shade, shade - 4, shade - 12));
      }
    }
    // A door frame behind, the box in front, packing tape across its top.
    canvas.rect(250, 20, 300, 190, (140, 98, 64));
    canvas.rect(256, 26, 294, 190, (168, 122, 82));
    canvas.rect(80, 110, 230, 215, (176, 132, 84));
    canvas.rect(80, 110, 230, 124, (150, 108, 66));
    canvas.rect(146, 110, 164, 215, (205, 180, 130));
    canvas.rect(96, 150, 140, 176, (245, 245, 240));
    for (var x = 100; x < 136; x += 3) {
      canvas.rect(x, 156, x + 1, 170, (30, 30, 30));
    }
    return canvas.png();
  }
}

typedef _Rgb = (int, int, int);

class _Canvas {
  _Canvas(this.w, this.h, _Rgb fill) : pixels = Uint8List(w * h * 3) {
    rect(0, 0, w, h, fill);
  }

  final int w;
  final int h;
  final Uint8List pixels;

  void set(int x, int y, _Rgb c) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    final i = (y * w + x) * 3;
    pixels[i] = c.$1.clamp(0, 255);
    pixels[i + 1] = c.$2.clamp(0, 255);
    pixels[i + 2] = c.$3.clamp(0, 255);
  }

  void rect(int x0, int y0, int x1, int y1, _Rgb c) {
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        set(x, y, c);
      }
    }
  }

  void dot(double cx, double cy, double r, _Rgb c) {
    for (var y = (cy - r).floor(); y <= (cy + r).ceil(); y++) {
      for (var x = (cx - r).floor(); x <= (cx + r).ceil(); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(x, y, c);
      }
    }
  }

  /// An uncompressed PNG: stored deflate blocks, which every decoder reads.
  Uint8List png() {
    final raw = BytesBuilder(copy: false);
    for (var y = 0; y < h; y++) {
      raw.addByte(0);
      raw.add(Uint8List.sublistView(pixels, y * w * 3, (y + 1) * w * 3));
    }
    final data = raw.takeBytes();
    final zlib = BytesBuilder(copy: false)..add(const [0x78, 0x01]);
    for (var at = 0; at < data.length; at += 0xFFFF) {
      final end = math.min(at + 0xFFFF, data.length);
      final length = end - at;
      zlib
        ..addByte(end == data.length ? 1 : 0)
        ..add([length & 0xFF, length >> 8, ~length & 0xFF, (~length >> 8) & 0xFF])
        ..add(Uint8List.sublistView(data, at, end));
    }
    zlib.add(_u32(_adler32(data)));

    final out = BytesBuilder(copy: false)..add(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    void chunk(String type, List<int> body) {
      final typed = [...type.codeUnits, ...body];
      out
        ..add(_u32(body.length))
        ..add(typed)
        ..add(_u32(_crc32(typed)));
    }

    chunk('IHDR', [..._u32(w), ..._u32(h), 8, 2, 0, 0, 0]);
    chunk('IDAT', zlib.takeBytes());
    chunk('IEND', const []);
    return out.takeBytes();
  }

  static List<int> _u32(int v) => [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];

  static int _adler32(List<int> data) {
    var a = 1, b = 0;
    for (final byte in data) {
      a = (a + byte) % 65521;
      b = (b + a) % 65521;
    }
    return (b << 16) | a;
  }

  static final List<int> _crcTable = List.generate(256, (n) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
    }
    return c;
  });

  static int _crc32(List<int> data) {
    var c = 0xFFFFFFFF;
    for (final byte in data) {
      c = _crcTable[(c ^ byte) & 0xFF] ^ (c >> 8);
    }
    return (c ^ 0xFFFFFFFF) & 0xFFFFFFFF;
  }
}
