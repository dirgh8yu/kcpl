import 'dart:async';

import '../push/push_service.dart';

/// Push for demo builds: "Turn on" works, and a sample notification arrives
/// a few seconds later, so the banner and its tap can be seen without a
/// Firebase project. Nothing leaves the phone.
class DemoPushService extends PushService {
  DemoPushService(this.sample);
  final PushNotice sample;

  PushState _state = PushState.off;
  bool _dismissed = false;
  final _taps = StreamController<PushTarget>.broadcast();
  final _notices = StreamController<PushNotice>.broadcast();
  Timer? _timer;

  @override
  PushState get state => _state;
  @override
  Stream<PushTarget> get taps => _taps.stream;
  @override
  Stream<PushNotice> get notices => _notices.stream;
  @override
  bool get primerDismissed => _dismissed;

  @override
  Future<void> dismissPrimer() async {
    _dismissed = true;
    notifyListeners();
  }

  @override
  Future<void> resume(RegisterDevice register) async {}

  @override
  Future<PushState> enable(RegisterDevice register) async {
    _state = PushState.on;
    notifyListeners();
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 4), () => _notices.add(sample));
    return _state;
  }

  @override
  Future<void> disable(UnregisterDevice unregister, {bool optOut = true}) async {
    _timer?.cancel();
    if (optOut) _state = PushState.off;
    notifyListeners();
  }
}
