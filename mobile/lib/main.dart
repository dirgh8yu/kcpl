import 'platform/app_shortcuts.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'platform/device_unlock.dart';
import 'platform/display.dart';
import 'platform/home_widget_bridge.dart';

import 'api/http_kcpl_api.dart';
import 'api/offline_cache.dart';
import 'app_controller.dart';
import 'auth/firebase_rest_auth.dart';
import 'auth/token_store.dart';
import 'auth/social_sign_in.dart';
import 'config.dart';
import 'push/push_service.dart';
import 'session_host.dart';
import 'demo/demo_backend.dart';
import 'demo/demo_push.dart';
import 'l10n/app_localizations.dart';
import 'ui/format.dart';
import 'ui/motion.dart';
import 'ui/screens/home_shell.dart';
import 'ui/screens/sign_in_screen.dart';
import 'ui/theme.dart';
import 'ui/widgets/kcpl_loader.dart';
import 'ui/widgets/lock_gate.dart';

const appVersion = '1.0.0';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initFormatting();
  await preferHighRefreshRate();
  final config = AppConfig.fromEnvironment();
  final store = SecureTokenStore();
  final AppController controller;
  if (config.demo) {
    controller = AppController(
      auth: DemoAuth(),
      api: DemoApi(),
      prefs: MemoryTokenStore(),
      configured: true,
      social: const DemoSocial(),
      push: DemoPushService(
        const PushNotice(
          title: 'KCPL-S-24091 cleared customs',
          body: 'Released at Birgunj ICD. Onward delivery is being arranged.',
          target: PushTarget('shipment', 'KCPL-S-24091'),
        ),
      ),
      unlock: LocalDeviceUnlock(apple: defaultTargetPlatform == TargetPlatform.iOS),
      homeWidget: const DeviceHomeWidget(),
      shortcuts: DeviceAppShortcuts(),
    );
  } else {
    final auth = FirebaseRestAuth(apiKey: config.firebaseApiKey, store: store);
    controller = AppController(
      auth: auth,
      api: HttpKcplApi(base: config.apiBase, auth: auth, cache: FileOfflineCache()),
      prefs: store,
      configured: config.configured,
      push: await FcmPushService.create(store),
      social: PlatformSocial(
        googleIosClientId: config.googleIosClientId,
        googleServerClientId: config.googleServerClientId,
        appleEnabled: config.appleSignIn,
      ),
      unlock: LocalDeviceUnlock(apple: defaultTargetPlatform == TargetPlatform.iOS),
      homeWidget: const DeviceHomeWidget(),
      shortcuts: DeviceAppShortcuts(),
    );
  }
  controller.start();
  runApp(KcplApp(controller: controller, demo: config.demo));
}

class KcplApp extends StatelessWidget {
  const KcplApp({super.key, required this.controller, this.demo = false});
  final AppController controller;
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      host: controller,
      child: AppScope(
        controller: controller,
        child: ListenableBuilder(
          listenable: controller,
          builder: (context, _) => MaterialApp(
            title: 'KCPL',
            debugShowCheckedModeBanner: false,
            theme: kcplTheme(Brightness.light),
            darkTheme: kcplTheme(Brightness.dark),
            locale: controller.locale,
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            // Signing in and out is the biggest change the app makes; the new
            // world fades up with a slight settle rather than cutting.
            home: AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              switchInCurve: Motion.drawer,
              switchOutCurve: Motion.easeOut,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: ScaleTransition(scale: Tween(begin: 0.97, end: 1.0).animate(animation), child: child),
              ),
              child: KeyedSubtree(
                key: ValueKey(controller.status),
                child: switch (controller.status) {
                  AppStatus.starting => const Scaffold(body: Center(child: KcplLoader(size: 64))),
                  AppStatus.unconfigured => const _Unconfigured(),
                  AppStatus.signedOut => const SignInScreen(),
                  AppStatus.signedIn => LockGate(
                    lock: controller.lock,
                    onSignOut: controller.signOut,
                    child: HomeShell(demo: demo, version: appVersion),
                  ),
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A build made without `--dart-define=KCPL_FIREBASE_API_KEY`. Only a
/// developer should ever see this.
class _Unconfigured extends StatelessWidget {
  const _Unconfigured();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Text(
          'This build has no KCPL sign-in configuration. Rebuild with '
          '--dart-define=KCPL_FIREBASE_API_KEY=… or KCPL_DEMO=true.',
          textAlign: TextAlign.center,
        ),
      ),
    ),
  );
}
