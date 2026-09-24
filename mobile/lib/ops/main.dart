import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../auth/firebase_rest_auth.dart';
import '../auth/token_store.dart';
import '../config.dart';
import '../demo/demo_backend.dart' show DemoAuth;
import '../l10n/app_localizations.dart';
import '../session_host.dart';
import '../ui/format.dart';
import '../ui/motion.dart';
import '../ui/screens/sign_in_screen.dart';
import '../ui/theme.dart';
import 'ops_api.dart';
import 'ops_controller.dart';
import 'ops_demo.dart';
import 'screens/ops_shell.dart';

/// KCPL Ops: the staff app. Built from the same project as the customer app
/// with `-t lib/ops/main.dart` (see README).
const opsVersion = '1.0.0';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initFormatting();
  final config = AppConfig.fromEnvironment();
  final OpsController controller;
  if (config.demo) {
    controller = OpsController(auth: DemoAuth(), api: DemoOpsApi(), configured: true);
  } else {
    final auth = FirebaseRestAuth(apiKey: config.firebaseApiKey, store: SecureTokenStore());
    controller = OpsController(auth: auth, api: HttpOpsApi(base: config.apiBase, auth: auth), configured: config.configured);
  }
  controller.start();
  runApp(OpsApp(controller: controller, demo: config.demo));
}

class OpsApp extends StatelessWidget {
  const OpsApp({super.key, required this.controller, this.demo = false});
  final OpsController controller;
  final bool demo;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      host: controller,
      child: OpsScope(
        controller: controller,
        child: ListenableBuilder(
          listenable: controller,
          builder: (context, _) => MaterialApp(
            title: 'KCPL Ops',
            debugShowCheckedModeBanner: false,
            theme: kcplTheme(Brightness.light),
            darkTheme: kcplTheme(Brightness.dark),
            // The admin portal is English; so is its app. The shared widgets
            // still read their strings through AppLocalizations.
            locale: const Locale('en'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: AnimatedSwitcher(
              duration: const Duration(milliseconds: 480),
              switchInCurve: Motion.drawer,
              switchOutCurve: Motion.easeOut,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: ScaleTransition(scale: Tween(begin: 0.97, end: 1.0).animate(animation), child: child),
              ),
              child: KeyedSubtree(
                key: ValueKey(controller.status),
                child: switch (controller.status) {
                  OpsStatus.starting => const Scaffold(body: Center(child: CircularProgressIndicator(strokeWidth: 2.5))),
                  OpsStatus.unconfigured => const Scaffold(
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
                    ),
                  OpsStatus.signedOut => const SignInScreen(
                      title: 'KCPL Operations',
                      subtitle: 'Jobs, tasks and alerts across your branches.',
                    ),
                  OpsStatus.signedIn => OpsShell(demo: demo, version: opsVersion),
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
