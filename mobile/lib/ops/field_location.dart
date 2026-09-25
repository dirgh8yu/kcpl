import 'package:geolocator/geolocator.dart';

/// Where the phone is, to the metre it can manage.
class FieldFix {
  const FieldFix(this.latitude, this.longitude, this.accuracy);
  final double latitude;
  final double longitude;

  /// Metres, as the phone reports it.
  final double accuracy;
}

/// Reads the phone's position for a delivery. Swapped in tests and the demo,
/// where there is no GPS. Returns null when location is off, refused, or
/// takes too long: a delivery is recorded without it rather than held up.
class FieldLocation {
  static Future<FieldFix?> Function() current = _device;

  static Future<FieldFix?> _device() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return null;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 12)),
      );
      return FieldFix(position.latitude, position.longitude, position.accuracy);
    } catch (_) {
      return null;
    }
  }
}
