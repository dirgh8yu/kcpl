import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../api/kcpl_api.dart' show ApiException;
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../ui/format.dart';
import '../../ui/labels.dart';
import '../../ui/motion.dart';
import '../../ui/theme.dart';
import '../../ui/widgets/common.dart';
import '../../ui/widgets/sheet_route.dart';
import '../ops_controller.dart';
import '../ops_models.dart';
import '../scan_codes.dart';
import 'job_detail_screen.dart';
import '../ops_l10n.dart';

void openScan(BuildContext context) => Navigator.of(context).push(SheetRoute<void>(builder: (_) => const ScanScreen()));

/// The camera and the text reader. Swapped in tests, where there is neither.
abstract final class ScanDevice {
  /// A live camera that reports each barcode or QR code it reads, and stops
  /// looking while [paused].
  static Widget Function(BuildContext context, void Function(String code) onCode, bool paused) camera = _liveCamera;

  /// Takes a photo and returns the lines of text in it, read on the phone.
  /// Null when the person backs out.
  static Future<List<String>?> Function() readText = _readTextFromPhoto;
}

Widget _liveCamera(BuildContext context, void Function(String code) onCode, bool paused) => _LiveCamera(onCode: onCode, paused: paused);

const _text = MethodChannel('kcpl/text');

Future<List<String>?> _readTextFromPhoto() async {
  // Sharper than an upload: small print on a door plate needs the pixels.
  final photo = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 3000, maxHeight: 3000, imageQuality: 92);
  if (photo == null) return null;
  try {
    return await _text.invokeListMethod<String>('recognize', {'path': photo.path}) ?? const [];
  } on MissingPluginException {
    return const [];
  } on PlatformException {
    return const [];
  }
}

enum _Stage { scanning, reading, choosing, typing, finding, found }

/// Finds a job from what is in front of the staff member: a barcode or QR
/// code, a container number painted on a door, or a reference typed in.
/// One match opens the job; several are listed; none says so plainly.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  _Stage _stage = _Stage.scanning;
  List<String> _candidates = const [];
  String _query = '';
  List<ScanMatch> _matches = const [];
  String? _error;
  final _typed = TextEditingController();

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  void _to(_Stage stage) => setState(() {
    _stage = stage;
    _error = null;
  });

  Future<void> _find(String code) async {
    final query = code.trim();
    if (query.isEmpty || _stage == _Stage.finding) return;
    HapticFeedback.selectionClick();
    final controller = OpsScope.read(context);
    setState(() {
      _stage = _Stage.finding;
      _query = query;
      _error = null;
    });
    try {
      final matches = await controller.api.lookup(query);
      if (!mounted) return;
      if (matches.length == 1) {
        HapticFeedback.mediumImpact();
        // The scan has done its job: the job takes its place.
        Navigator.of(context).pushReplacement(SheetRoute<void>(builder: (_) => JobDetailScreen(reference: matches.single.reference)));
        return;
      }
      if (matches.isEmpty) HapticFeedback.heavyImpact();
      setState(() {
        _matches = matches;
        _stage = _Stage.found;
      });
    } on SignedOutException {
      await controller.expire();
    } catch (error) {
      if (!mounted) return;
      final l = AppLocalizations.of(context);
      setState(() {
        _stage = _Stage.found;
        _matches = const [];
        _error = error is ApiException && error.code == 'network'
            ? l.networkError
            : error is ApiException && error.message.isNotEmpty
            ? error.message
            : l.commonUnavailableDetail;
      });
    }
  }

  Future<void> _read() async {
    _to(_Stage.reading);
    final lines = await ScanDevice.readText();
    if (!mounted) return;
    if (lines == null) {
      _to(_Stage.scanning);
      return;
    }
    final candidates = scanCandidates(lines);
    // One clear number needs no choosing.
    if (candidates.length == 1) return _find(candidates.single);
    setState(() {
      _candidates = candidates;
      _stage = _Stage.choosing;
    });
  }

  @override
  Widget build(BuildContext context) {
    final paused = _stage != _Stage.scanning;
    return AnnotatedRegion(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        resizeToAvoidBottomInset: true,
        body: Stack(
          fit: StackFit.expand,
          children: [
            ScanDevice.camera(context, _find, paused),
            // Dims the camera once it has done its part, so the panel reads.
            IgnorePointer(
              child: AnimatedOpacity(
                opacity: paused ? 0.55 : 0,
                duration: Motion.reduced(context) ? Duration.zero : Motion.reveal,
                curve: Motion.easeOut,
                child: const ColoredBox(color: Colors.black),
              ),
            ),
            if (!paused) const IgnorePointer(child: _Viewfinder()),
            Positioned(
              top: MediaQuery.paddingOf(context).top + 8,
              left: 12,
              child: _Round(
                icon: KIcons.close,
                label: MaterialLocalizations.of(context).closeButtonLabel,
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
            Positioned(left: 0, right: 0, bottom: 0, child: _panel(context)),
          ],
        ),
      ),
    );
  }

  Widget _panel(BuildContext context) {
    final p = context.palette.raised;
    final reduced = Motion.reduced(context);
    final content = switch (_stage) {
      _Stage.scanning => _idle(context),
      _Stage.reading => _Busy(label: context.l.opsReadingText),
      _Stage.choosing => _choose(context),
      _Stage.typing => _type(context),
      _Stage.finding => _Busy(label: context.l.opsFinding(_query)),
      _Stage.found => _found(context),
    };
    final body = Padding(
      padding: EdgeInsets.fromLTRB(kGutter, 18, kGutter, 16 + MediaQuery.paddingOf(context).bottom),
      child: KeyedSubtree(key: ValueKey(_stage), child: content),
    );
    return Theme(
      data: raisedTheme(Theme.of(context)),
      child: Material(
        color: p.paper,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        clipBehavior: Clip.antiAlias,
        // Grows and shrinks with what it has to say, rather than jumping.
        child: reduced
            ? body
            : AnimatedSize(duration: Motion.reveal, curve: Motion.easeOut, alignment: Alignment.bottomCenter, child: body),
      ),
    );
  }

  Widget _idle(BuildContext context) {
    final p = context.palette;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(context.l.opsPointAtCode, style: context.type.titleLarge, textAlign: TextAlign.center),
        const SizedBox(height: 4),
        Text(
          context.l.opsScanHint,
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Pressable(
                child: OutlinedButton.icon(onPressed: _read, icon: const Icon(KIcons.camera, size: 18), label: Text(context.l.opsReadText)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Pressable(
                child: OutlinedButton.icon(
                  onPressed: () => _to(_Stage.typing),
                  icon: const Icon(KIcons.search, size: 18),
                  label: Text(context.l.opsTypeIt),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _choose(BuildContext context) {
    final p = context.palette;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _candidates.isEmpty ? context.l.opsNoNumber : context.l.opsTapNumber,
          style: context.type.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          _candidates.isEmpty ? context.l.opsTryCloser : context.l.opsCheckDigitFirst,
          style: context.type.bodyMedium?.copyWith(color: p.secondary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 14),
        if (_candidates.isNotEmpty)
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final code in _candidates)
                ActionChip(
                  label: Text(code, style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                  avatar: isContainerNumber(code) ? Icon(KIcons.check, size: 16, color: p.ink) : null,
                  onPressed: () => _find(code),
                ),
            ],
          ),
        const SizedBox(height: 10),
        TextButton(onPressed: () => _to(_Stage.scanning), child: Text(context.l.opsScanAgain)),
      ],
    );
  }

  Widget _type(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _typed,
          autofocus: true,
          autocorrect: false,
          textCapitalization: TextCapitalization.characters,
          textInputAction: TextInputAction.search,
          onSubmitted: _find,
          decoration: InputDecoration(hintText: context.l.opsLookupHint),
        ),
        const SizedBox(height: 12),
        Pressable(
          child: FilledButton(onPressed: () => _find(_typed.text), child: Text(context.l.opsFindJob)),
        ),
        TextButton(onPressed: () => _to(_Stage.scanning), child: Text(context.l.opsBackToCamera)),
      ],
    );
  }

  Widget _found(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final error = _error;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error != null)
          Notice(card: false, title: error)
        else if (_matches.isEmpty) ...[
          Text(context.l.opsNoJobMatches(_query), style: context.type.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(
            context.l.opsNoMatchBody,
            style: context.type.bodyMedium?.copyWith(color: p.secondary),
            textAlign: TextAlign.center,
          ),
        ] else ...[
          Text(context.l.opsJobsMatch(_matches.length, _query), style: context.type.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.4),
            child: SingleChildScrollView(
              child: RowGroup(
                children: [
                  for (final match in _matches)
                    RowTile(
                      onTap: () =>
                          Navigator.of(context)
                              .pushReplacement(SheetRoute<void>(builder: (_) => JobDetailScreen(reference: match.reference))),
                      title: RouteText(place(match.origin), place(match.destination)),
                      subtitle: Text('${match.reference} · ${statusLabel(l, match.status)}'),
                      chevron: true,
                    ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 10),
        TextButton(onPressed: () => _to(_Stage.scanning), child: Text(context.l.opsScanAgain)),
      ],
    );
  }
}

class _Busy extends StatelessWidget {
  const _Busy({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 18),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const CupertinoActivityIndicator(),
        const SizedBox(width: 10),
        Flexible(
          child: Text(label, style: context.type.bodyLarge, overflow: TextOverflow.ellipsis),
        ),
      ],
    ),
  );
}

/// A frosted round button over the camera, as the Camera app draws them.
class _Round extends StatelessWidget {
  const _Round({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Pressable(
    child: Material(
      color: Colors.black.withValues(alpha: 0.45),
      shape: const CircleBorder(),
      child: IconButton(
        tooltip: label,
        onPressed: onPressed,
        icon: Icon(icon, color: Colors.white, size: 20),
      ),
    ),
  );
}

/// Four white corners where the code should go.
class _Viewfinder extends StatelessWidget {
  const _Viewfinder();

  @override
  Widget build(BuildContext context) => Align(
    alignment: const Alignment(0, -0.25),
    child: SizedBox(width: 250, height: 170, child: CustomPaint(painter: _Corners())),
  );
}

class _Corners extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const arm = 26.0;
    const r = 14.0;
    for (final (x, y, dx, dy) in [
      (0.0, 0.0, 1.0, 1.0),
      (size.width, 0.0, -1.0, 1.0),
      (0.0, size.height, 1.0, -1.0),
      (size.width, size.height, -1.0, -1.0),
    ]) {
      final path = Path()
        ..moveTo(x, y + dy * arm)
        ..lineTo(x, y + dy * r)
        ..quadraticBezierTo(x, y, x + dx * r, y)
        ..lineTo(x + dx * arm, y);
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(_Corners oldDelegate) => false;
}

class _LiveCamera extends StatefulWidget {
  const _LiveCamera({required this.onCode, required this.paused});
  final void Function(String code) onCode;
  final bool paused;

  @override
  State<_LiveCamera> createState() => _LiveCameraState();
}

class _LiveCameraState extends State<_LiveCamera> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);

  @override
  void didUpdateWidget(_LiveCamera oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.paused != oldWidget.paused) {
      widget.paused ? _controller.stop() : _controller.start();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MobileScanner(
    controller: _controller,
    onDetect: (capture) {
      if (widget.paused) return;
      final code = capture.barcodes.map((b) => b.rawValue).whereType<String>().where((v) => v.trim().isNotEmpty).firstOrNull;
      if (code != null) widget.onCode(code);
    },
    errorBuilder: (context, error) => Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          error.errorCode == MobileScannerErrorCode.permissionDenied
              ? context.l.opsCameraDenied
              : context.l.opsCameraUnavailable,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white),
        ),
      ),
    ),
  );
}
