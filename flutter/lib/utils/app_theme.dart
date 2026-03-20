// ============================================================
//  SDUCS – MK  |  App Theme
// ============================================================
import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary    = Color(0xFF5C6EE6);
  static const Color secondary  = Color(0xFFC946EF);
  static const Color accent     = Color(0xFF06B6D4);
  static const Color background = Color(0xFF050810);
  static const Color surface    = Color(0xFF0A0E1C);
  static const Color card       = Color(0xFF0F1428);

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: primary,
      secondary: secondary,
      surface: surface,
      background: background,
    ),
    scaffoldBackgroundColor: background,
    cardColor: card,
    fontFamily: 'DM Sans',
    appBarTheme: const AppBarTheme(
      backgroundColor: surface,
      elevation: 0,
      titleTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white.withOpacity(0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(11),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
    ),
  );
}
