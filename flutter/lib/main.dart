// ============================================================
//  SDUCS – MK  |  Flutter Android App — main.dart
// ============================================================
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/storage_service.dart';
import 'services/ad_service.dart';
import 'screens/splash_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/file_manager_screen.dart';
import 'screens/download_screen.dart';
import 'screens/plans_screen.dart';
import 'screens/recycle_bin_screen.dart';
import 'screens/settings_screen.dart';
import 'utils/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait mode
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Firebase
  await Firebase.initializeApp();

  runApp(const SDUCSApp());
}

class SDUCSApp extends StatelessWidget {
  const SDUCSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => StorageService()),
        ChangeNotifierProvider(create: (_) => AdService()),
      ],
      child: Consumer<AuthService>(
        builder: (ctx, auth, _) {
          return MaterialApp(
            title: 'SDUCS – MK',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.dark,
            initialRoute: '/',
            routes: {
              '/':          (_) => const SplashScreen(),
              '/auth':      (_) => const AuthScreen(),
              '/dashboard': (_) => const DashboardScreen(),
              '/files':     (_) => const FileManagerScreen(),
              '/downloads': (_) => const DownloadScreen(),
              '/plans':     (_) => const PlansScreen(),
              '/recycle':   (_) => const RecycleBinScreen(),
              '/settings':  (_) => const SettingsScreen(),
            },
          );
        },
      ),
    );
  }
}
