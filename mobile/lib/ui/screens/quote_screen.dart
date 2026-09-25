import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator, CupertinoSlidingSegmentedControl;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/kcpl_api.dart';
import '../../api/models.dart';
import '../../app_controller.dart';
import '../../auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';
import '../map/places.dart';
import '../map/route_map.dart';
import '../motion.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';
import '../widgets/large_title.dart';
import '../widgets/sheet_route.dart';

/// Opens the quote request, as a ride-hailing app opens "Where to?".
/// [recent] are places from the customer's own shipments, offered before
/// anything is typed.
void openQuote(BuildContext context, {List<String> recent = const []}) =>
    Navigator.of(context).push(SheetRoute<void>(builder: (_) => QuoteScreen(recent: recent)));

/// The places a customer's shipments already run between, most used first.
List<String> recentPlaces(List<Shipment> shipments) {
  final counts = <String, int>{};
  for (final s in shipments) {
    for (final name in [s.origin, s.destination]) {
      final trimmed = name.trim();
      if (trimmed.isNotEmpty) counts[trimmed] = (counts[trimmed] ?? 0) + 1;
    }
  }
  return (counts.keys.toList()..sort((a, b) => counts[b]!.compareTo(counts[a]!))).take(5).toList();
}

/// A quote request in the manner of requesting a ride: where from and where
/// to first, with places suggested as you type and the route drawn once both
/// are known; then how it should travel, chosen from a short list; then the
/// cargo; and one button. KCPL replies with a price.
class QuoteScreen extends StatefulWidget {
  const QuoteScreen({super.key, this.recent = const []});
  final List<String> recent;

  @override
  State<QuoteScreen> createState() => _QuoteScreenState();
}

/// Timing choices: shown in the reader's language, sent in English, which
/// is what the KCPL desk reads.
const _timings = ['As soon as possible', 'Within 2 weeks', 'This month', 'Flexible'];

class _QuoteScreenState extends State<QuoteScreen> {
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _cargo = TextEditingController();
  final _weight = TextEditingController();
  final _notes = TextEditingController();
  final _fromFocus = FocusNode();
  final _toFocus = FocusNode();

  String _mode = 'unsure';
  String _unit = 'kg';
  String? _timing;
  bool _busy = false;
  String? _error;
  String? _reference;

  @override
  void initState() {
    super.initState();
    for (final listenable in [_from, _to, _fromFocus, _toFocus]) {
      listenable.addListener(_changed);
    }
    // Straight to the question that matters, as "Where to?" does.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !Motion.reduced(context)) _fromFocus.requestFocus();
    });
  }

  void _changed() {
    if (mounted) setState(() => _error = null);
  }

  @override
  void dispose() {
    for (final controller in [_from, _to, _cargo, _weight, _notes]) {
      controller.dispose();
    }
    _fromFocus.dispose();
    _toFocus.dispose();
    super.dispose();
  }

  /// The field being typed into, and what to offer for it.
  (TextEditingController, FocusNode, List<String>)? get _suggesting {
    for (final (controller, focus) in [(_from, _fromFocus), (_to, _toFocus)]) {
      if (!focus.hasFocus) continue;
      final text = controller.text.trim();
      final options = text.isEmpty ? widget.recent : suggestPlaces(text);
      // Once a suggestion has been taken, it is not offered again.
      if (options.length == 1 && options.first.toLowerCase() == text.toLowerCase()) return null;
      return options.isEmpty ? null : (controller, focus, options);
    }
    return null;
  }

  void _choose(TextEditingController controller, String place) {
    HapticFeedback.selectionClick();
    controller.text = place;
    controller.selection = TextSelection.collapsed(offset: place.length);
    if (identical(controller, _from) && _to.text.trim().isEmpty) {
      _toFocus.requestFocus();
    } else {
      FocusScope.of(context).unfocus();
    }
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    FocusScope.of(context).unfocus();
    if (_from.text.trim().isEmpty || _to.text.trim().isEmpty) {
      setState(() => _error = l.quoteNeedsRoute);
      HapticFeedback.heavyImpact();
      return;
    }
    final controller = AppScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final reference = await controller.api.requestQuote(
        QuoteRequest(
          origin: _from.text,
          destination: _to.text,
          mode: _mode,
          cargoType: _cargo.text,
          weight: _weight.text,
          weightUnit: _unit,
          timing: _timing ?? '',
          requirements: _notes.text,
        ),
      );
      HapticFeedback.mediumImpact();
      if (mounted) setState(() => _reference = reference);
    } on SignedOutException {
      await controller.expire();
    } on ApiException catch (error) {
      setState(
        () => _error = error.code == 'network'
            ? l.networkError
            : error.message.isNotEmpty
            ? error.message
            : l.commonUnavailableDetail,
      );
    } catch (_) {
      setState(() => _error = l.commonUnavailableDetail);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final reference = _reference;
    if (reference != null) {
      return _Sent(route: '${_from.text.trim()} → ${_to.text.trim()}', reference: reference);
    }

    final suggesting = _suggesting;
    final showRoute = suggesting == null && RouteMap.canDraw(_from.text, _to.text);
    final modes = [
      ('road', KIcons.road, l.quoteModeRoad, l.quoteModeRoadDetail),
      ('sea', KIcons.sea, l.quoteModeSea, l.quoteModeSeaDetail),
      ('air', KIcons.air, l.quoteModeAir, l.quoteModeAirDetail),
      ('unsure', KIcons.route, l.quoteModeUnsure, l.quoteModeUnsureDetail),
    ];
    final timingLabels = [l.quoteWhenSoon, l.quoteWhenWeeks, l.quoteWhenMonth, l.quoteWhenFlexible];

    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                LargeTitleBar(title: l.quoteTitle),
                SliverList(
                  delegate: SliverChildListDelegate([
                    _RouteFields(from: _from, to: _to, fromFocus: _fromFocus, toFocus: _toFocus, enabled: !_busy),
                    if (suggesting != null) ...[
                      if (suggesting.$1.text.trim().isEmpty) SectionHeader(l.quoteYourRoutes, top: 20) else const SizedBox(height: 12),
                      RowGroup(
                        indent: RowGroup.iconIndent,
                        children: [
                          for (final place in suggesting.$3)
                            RowTile(
                              onTap: () => _choose(suggesting.$1, place),
                              leading: const IconTile(icon: KIcons.pin),
                              title: Text(place),
                            ),
                        ],
                      ),
                    ],
                    // The route, once both ends are places the map knows.
                    AnimatedSwitcher(
                      duration: Motion.reduced(context) ? Duration.zero : Motion.reveal,
                      switchInCurve: Motion.easeOut,
                      switchOutCurve: Motion.easeOut,
                      child: showRoute
                          ? Padding(
                              key: ValueKey('${_from.text}|${_to.text}'),
                              padding: const EdgeInsets.only(top: 12),
                              child: GroupCard(
                                child: SizedBox(
                                  height: 150,
                                  child: RouteMap(
                                    origin: _from.text,
                                    destination: _to.text,
                                    progress: 0,
                                    vehicle: modeSolidIcon(_mode == 'unsure' ? 'road' : _mode),
                                    style: RouteMapStyle.page(p),
                                  ),
                                ),
                              ),
                            )
                          : const SizedBox(key: ValueKey('none'), width: double.infinity),
                    ),
                    SectionHeader(l.quoteModeTitle),
                    RowGroup(
                      indent: RowGroup.iconIndent,
                      children: [
                        for (final (mode, icon, title, detail) in modes)
                          Semantics(
                            selected: mode == _mode,
                            inMutuallyExclusiveGroup: true,
                            child: RowTile(
                              onTap: _busy
                                  ? null
                                  : () {
                                      HapticFeedback.selectionClick();
                                      setState(() => _mode = mode);
                                    },
                              leading: Icon(icon, size: 22, color: mode == _mode ? p.ink : p.secondary),
                              title: Text(title, style: TextStyle(fontWeight: mode == _mode ? FontWeight.w600 : FontWeight.w400)),
                              subtitle: Text(detail),
                              trailing: mode == _mode ? Icon(KIcons.check, size: 20, color: p.ink) : const SizedBox(width: 20),
                            ),
                          ),
                      ],
                    ),
                    SectionHeader(l.quoteCargoTitle),
                    GroupCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextField(
                            controller: _cargo,
                            enabled: !_busy,
                            textCapitalization: TextCapitalization.sentences,
                            style: context.type.bodyLarge,
                            decoration: _field(l.quoteCargoHint),
                          ),
                          const Divider(indent: kGutter),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _weight,
                                  enabled: !_busy,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  style: context.type.bodyLarge,
                                  decoration: _field(l.quoteWeightHint),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: CupertinoSlidingSegmentedControl<String>(
                                  groupValue: _unit,
                                  onValueChanged: (unit) => setState(() => _unit = unit ?? 'kg'),
                                  children: const {
                                    'kg': Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('kg')),
                                    'tonnes': Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('t')),
                                    'lb': Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('lb')),
                                  },
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    SectionHeader(l.quoteWhenTitle),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: kGutter),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (var i = 0; i < _timings.length; i++)
                            ChoiceChip(
                              label: Text(timingLabels[i], style: TextStyle(color: _timing == _timings[i] ? p.surface : p.ink)),
                              selected: _timing == _timings[i],
                              onSelected: _busy ? null : (on) => setState(() => _timing = on ? _timings[i] : null),
                            ),
                        ],
                      ),
                    ),
                    SectionHeader(l.quoteNotesTitle),
                    GroupCard(
                      child: TextField(
                        controller: _notes,
                        enabled: !_busy,
                        minLines: 2,
                        maxLines: 5,
                        textCapitalization: TextCapitalization.sentences,
                        style: context.type.bodyLarge,
                        decoration: _field(l.quoteNotesHint),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ]),
                ),
              ],
            ),
          ),
          // The one action, always in reach, as a ride app keeps its request
          // button at the foot of the screen.
          DecoratedBox(
            decoration: BoxDecoration(
              color: p.paper,
              border: Border(top: BorderSide(color: p.hairline, width: 0.33)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Under Reduce Motion the line simply appears.
                    _errorLine(context),
                    Pressable(
                      child: FilledButton(
                        onPressed: _busy ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: p.accent,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: p.accent.withValues(alpha: 0.8),
                          disabledForegroundColor: Colors.white,
                        ),
                        child: _busy
                            ? Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const CupertinoActivityIndicator(color: Colors.white, radius: 9),
                                  const SizedBox(width: 10),
                                  Text(l.quoteSending),
                                ],
                              )
                            : Text(l.quoteSubmit),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorLine(BuildContext context) {
    final line = _error == null
        ? const SizedBox(width: double.infinity)
        : Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Notice(card: false, title: _error!),
          );
    if (Motion.reduced(context)) return line;
    return AnimatedSize(duration: const Duration(milliseconds: 200), curve: Motion.easeOut, alignment: Alignment.bottomCenter, child: line);
  }

  /// A field on a card: no fill or border of its own.
  InputDecoration _field(String hint) => InputDecoration(
    hintText: hint,
    filled: false,
    border: InputBorder.none,
    enabledBorder: InputBorder.none,
    focusedBorder: InputBorder.none,
    disabledBorder: InputBorder.none,
    contentPadding: const EdgeInsets.symmetric(horizontal: kGutter, vertical: 14),
  );
}

/// From and to on one card, as a ride app pairs pickup and drop-off: a dot
/// for where it starts and a square for where it ends, as on the map, joined
/// by a line.
class _RouteFields extends StatelessWidget {
  const _RouteFields({required this.from, required this.to, required this.fromFocus, required this.toFocus, required this.enabled});
  final TextEditingController from;
  final TextEditingController to;
  final FocusNode fromFocus;
  final FocusNode toFocus;
  final bool enabled;

  static const _row = 50.0;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    Widget field(TextEditingController controller, FocusNode focus, String label, String hint, Widget marker, TextInputAction action) =>
        SizedBox(
          height: _row,
          child: Row(
            children: [
              SizedBox(
                width: kGutter + 26,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.only(left: kGutter),
                    child: marker,
                  ),
                ),
              ),
              Expanded(
                child: Semantics(
                  label: label,
                  child: TextField(
                    controller: controller,
                    focusNode: focus,
                    enabled: enabled,
                    textInputAction: action,
                    textCapitalization: TextCapitalization.words,
                    autocorrect: false,
                    style: context.type.bodyLarge,
                    onSubmitted: (_) => identical(focus, fromFocus) ? toFocus.requestFocus() : null,
                    decoration: InputDecoration(
                      hintText: hint,
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.fromLTRB(14, 14, kGutter, 14),
                      suffixIcon: controller.text.isEmpty || !focus.hasFocus
                          ? null
                          : IconButton(
                              tooltip: MaterialLocalizations.of(context).deleteButtonTooltip,
                              icon: Icon(KIcons.clear, size: 18, color: p.tertiary),
                              onPressed: controller.clear,
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
    return GroupCard(
      child: Stack(
        children: [
          // The line between the two markers.
          Positioned(
            left: kGutter + 13 - 0.75,
            top: _row / 2 + 6,
            height: _row - 12,
            child: Container(width: 1.5, color: p.tertiary),
          ),
          Column(
            children: [
              field(
                from,
                fromFocus,
                l.quoteFrom,
                l.quoteFromHint,
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: p.ink, width: 3),
                  ),
                ),
                TextInputAction.next,
              ),
              const Divider(indent: kGutter + 26 + 14),
              field(to, toFocus, l.quoteTo, l.quoteToHint, Container(width: 10, height: 10, color: p.ink), TextInputAction.done),
            ],
          ),
        ],
      ),
    );
  }
}

/// Sent: a tick, the route and the reference. Rare, so the tick may arrive
/// with a little life.
class _Sent extends StatelessWidget {
  const _Sent({required this.route, required this.reference});
  final String route;
  final String reference;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = context.palette;
    final reduced = Motion.reduced(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: Column(
            children: [
              const Spacer(),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: reduced ? const Duration(milliseconds: 200) : const Duration(milliseconds: 360),
                curve: Motion.easeOut,
                builder: (context, t, child) => Opacity(
                  opacity: t,
                  child: Transform.scale(scale: reduced ? 1 : 0.9 + 0.1 * t, child: child),
                ),
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: p.ink, shape: BoxShape.circle),
                  child: Icon(KIcons.check, size: 30, color: p.surface),
                ),
              ),
              const SizedBox(height: 20),
              Text(l.quoteSentTitle, style: context.type.headlineMedium, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(
                l.quoteSentBody(route),
                style: context.type.bodyLarge?.copyWith(color: p.secondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              // The reference, whole and copyable, for any call to KCPL.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: p.fill, borderRadius: BorderRadius.circular(10)),
                child: SelectableText(
                  reference,
                  style: context.type.titleSmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ),
              const Spacer(),
              FilledButton(onPressed: () => Navigator.of(context).maybePop(), child: Text(l.quoteDone)),
            ],
          ),
        ),
      ),
    );
  }
}
