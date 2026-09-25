import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

/// How this phone proves it is its owner.
enum UnlockMethod { faceId, touchId, fingerprint, passcode }

/// The phone's own unlock: Face ID, Touch ID, a fingerprint, or the device
/// passcode. Swapped in tests.
abstract class DeviceUnlock {
  const DeviceUnlock();

  /// Null when the phone has no way to prove its owner (no passcode set).
  Future<UnlockMethod?> method();

  /// True when the owner proved it. Falls back to the passcode by itself.
  Future<bool> unlock(String reason);
}

class NoDeviceUnlock extends DeviceUnlock {
  const NoDeviceUnlock();
  @override
  Future<UnlockMethod?> method() async => null;
  @override
  Future<bool> unlock(String reason) async => false;
}

class LocalDeviceUnlock extends DeviceUnlock {
  LocalDeviceUnlock({required this.apple});
  final bool apple;
  final _auth = LocalAuthentication();

  @override
  Future<UnlockMethod?> method() async {
    try {
      if (!await _auth.isDeviceSupported()) return null;
      final enrolled = await _auth.getAvailableBiometrics();
      if (enrolled.contains(BiometricType.face)) return apple ? UnlockMethod.faceId : UnlockMethod.fingerprint;
      if (enrolled.contains(BiometricType.fingerprint)) return apple ? UnlockMethod.touchId : UnlockMethod.fingerprint;
      if (enrolled.isNotEmpty) return UnlockMethod.fingerprint;
      return UnlockMethod.passcode;
    } on PlatformException {
      return null;
    }
  }

  @override
  Future<bool> unlock(String reason) async {
    try {
      // Not biometric-only: a face that won't read falls back to the
      // passcode, as every Apple app does.
      return await _auth.authenticate(localizedReason: reason, persistAcrossBackgrounding: true);
    } on LocalAuthException {
      return false;
    } on PlatformException {
      return false;
    }
  }
}
