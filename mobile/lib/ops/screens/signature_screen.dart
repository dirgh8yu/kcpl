import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/models.dart' show Attachment;
import '../../ui/theme.dart';
import '../ops_l10n.dart';

/// Opens the signing page. Null when the person backs out.
Future<Attachment?> captureSignature(BuildContext context, {required String name, required String signer}) =>
    Navigator.of(context).push<Attachment>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => SignatureScreen(name: name, signer: signer)),
    );

/// A page to sign on, the whole width of the phone. Its own page rather than
/// a box in a form: a signature stroke inside a scrolling form fights the
/// scroll, and a recipient signs better with room.
///
/// Strokes are read from raw pointer events, so ink starts under the finger
/// at touch-down with no slop, and drawn as smoothed curves through the
/// midpoints. The saved image is black on white whatever the phone's theme,
/// because that is what a proof of delivery looks like on paper.
class SignatureScreen extends StatefulWidget {
  const SignatureScreen({super.key, required this.name, required this.signer});

  /// The file name, without extension.
  final String name;

  /// Printed under the line, as on a paper POD.
  final String signer;

  @override
  State<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<SignatureScreen> {
  final List<List<Offset>> _strokes = [];
  int? _pointer;
  Size _size = Size.zero;
  bool _saving = false;

  bool get _signed => _strokes.any((s) => s.length > 1);

  void _down(PointerDownEvent event) {
    // One finger signs; a second touch is ignored rather than jumping the line.
    if (_pointer != null) return;
    _pointer = event.pointer;
    if (_strokes.isEmpty) HapticFeedback.selectionClick();
    setState(() => _strokes.add([event.localPosition]));
  }

  void _move(PointerMoveEvent event) {
    if (event.pointer != _pointer) return;
    setState(() => _strokes.last.add(event.localPosition));
  }

  void _up(PointerEvent event) {
    if (event.pointer == _pointer) _pointer = null;
  }

  void _clear() {
    HapticFeedback.lightImpact();
    setState(_strokes.clear);
  }

  Future<void> _done() async {
    if (!_signed || _saving) return;
    setState(() => _saving = true);
    final bytes = await renderSignaturePng(_strokes, _size);
    if (!mounted) return;
    HapticFeedback.mediumImpact();
    Navigator.of(context).pop(Attachment(filename: '${widget.name}.png', bytes: bytes, contentType: 'image/png'));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      backgroundColor: p.paper,
      appBar: AppBar(
        backgroundColor: p.paper,
        leading: TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(context.l.opsCancel)),
        leadingWidth: 88,
        title: Text(context.l.opsSignature),
        actions: [
          TextButton(onPressed: _signed ? _clear : null, child: Text(context.l.opsClear)),
          TextButton(
            onPressed: _signed && !_saving ? _done : null,
            child: Text(context.l.opsDone, style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 16),
          child: DecoratedBox(
            decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(kCardRadius)),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(kCardRadius),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  _size = constraints.biggest;
                  return Semantics(
                    label: context.l.opsSignatureArea,
                    child: Listener(
                      key: const ValueKey('signature-pad'),
                      behavior: HitTestBehavior.opaque,
                      onPointerDown: _down,
                      onPointerMove: _move,
                      onPointerUp: _up,
                      onPointerCancel: _up,
                      child: CustomPaint(
                        size: constraints.biggest,
                        painter: _SignaturePainter(strokes: _strokes, ink: p.ink, guide: p.hairline, hint: p.tertiary, signer: widget.signer, prompt: context.l.opsSignAbove, empty: _strokes.isEmpty),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A smooth path through a stroke: quadratic curves with the recorded points
/// as control points and their midpoints as ends, which removes the corners
/// a finger's sampled points otherwise leave.
Path signaturePath(List<Offset> stroke) {
  final path = Path();
  if (stroke.isEmpty) return path;
  path.moveTo(stroke.first.dx, stroke.first.dy);
  if (stroke.length < 3) {
    for (final point in stroke.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    return path;
  }
  for (var i = 1; i < stroke.length - 1; i++) {
    final mid = Offset((stroke[i].dx + stroke[i + 1].dx) / 2, (stroke[i].dy + stroke[i + 1].dy) / 2);
    path.quadraticBezierTo(stroke[i].dx, stroke[i].dy, mid.dx, mid.dy);
  }
  path.lineTo(stroke.last.dx, stroke.last.dy);
  return path;
}

const _inkWidth = 2.8;

/// The signature as a PNG, black on white, cropped to the ink with a margin
/// and drawn at 3x so it prints sharp.
Future<List<int>> renderSignaturePng(List<List<Offset>> strokes, Size size) async {
  final points = strokes.expand((s) => s);
  var bounds = Rect.fromPoints(points.first, points.first);
  for (final point in points) {
    bounds = bounds.expandToInclude(Rect.fromCircle(center: point, radius: _inkWidth));
  }
  bounds = bounds.inflate(24).intersect(Offset.zero & (size.isEmpty ? bounds.inflate(24).size : size));
  const scale = 3.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder)
    ..scale(scale)
    ..translate(-bounds.left, -bounds.top)
    ..drawRect(bounds, Paint()..color = Colors.white);
  final ink = Paint()
    ..color = Colors.black
    ..style = PaintingStyle.stroke
    ..strokeWidth = _inkWidth
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;
  for (final stroke in strokes) {
    if (stroke.length == 1) {
      canvas.drawCircle(stroke.first, _inkWidth / 2, Paint()..color = Colors.black);
    } else {
      canvas.drawPath(signaturePath(stroke), ink);
    }
  }
  final image = await recorder.endRecording().toImage((bounds.width * scale).ceil(), (bounds.height * scale).ceil());
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return data!.buffer.asUint8List();
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter({required this.strokes, required this.ink, required this.guide, required this.hint, required this.signer, required this.prompt, required this.empty})
    : _version = strokes.fold(0, (n, s) => n + s.length);

  final List<List<Offset>> strokes;
  final Color ink;
  final Color guide;
  final Color hint;
  final String signer;

  /// "Sign above the line", in the reader's language.
  final String prompt;
  final bool empty;
  final int _version;

  @override
  void paint(Canvas canvas, Size size) {
    final baseline = size.height * 0.68;
    canvas.drawLine(Offset(28, baseline), Offset(size.width - 28, baseline), Paint()..color = guide..strokeWidth = 1);
    final label = TextPainter(
      text: TextSpan(text: empty ? prompt : signer, style: TextStyle(color: hint, fontSize: 15)),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width - 56);
    label.paint(canvas, Offset(28, baseline + 10));
    label.dispose();
    final x = TextPainter(text: TextSpan(text: '×', style: TextStyle(color: hint, fontSize: 22)), textDirection: TextDirection.ltr)..layout();
    x.paint(canvas, Offset(28, baseline - x.height - 2));
    x.dispose();

    final paint = Paint()
      ..color = ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = _inkWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (final stroke in strokes) {
      if (stroke.length == 1) {
        canvas.drawCircle(stroke.first, _inkWidth / 2, Paint()..color = ink);
      } else {
        canvas.drawPath(signaturePath(stroke), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter old) => old._version != _version || old.strokes.length != strokes.length || old.ink != ink || old.empty != empty;
}
