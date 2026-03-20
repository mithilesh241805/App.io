// ============================================================
//  SDUCS – MK  |  Flutter Auth Service
// ============================================================
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';

const String kApiBase = 'https://your-api.com/api'; // Change in production

class AuthService extends ChangeNotifier {
  final _firebaseAuth = FirebaseAuth.instance;
  final _googleSignIn = GoogleSignIn();
  UserModel? _currentUser;
  String? _token;

  UserModel? get currentUser => _currentUser;
  String?    get token => _token;
  bool       get isLoggedIn => _currentUser != null && _token != null;

  AuthService() { _loadFromPrefs(); }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('sducs_token');
    final userJson = prefs.getString('sducs_user');
    if (_token != null && userJson != null) {
      _currentUser = UserModel.fromJson(jsonDecode(userJson));
      notifyListeners();
    }
  }

  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token != null) await prefs.setString('sducs_token', _token!);
    if (_currentUser != null) await prefs.setString('sducs_user', jsonEncode(_currentUser!.toJson()));
  }

  Future<void> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) throw Exception('Google sign-in cancelled.');

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    final userCred = await _firebaseAuth.signInWithCredential(credential);
    final idToken = await userCred.user!.getIdToken();

    final res = await http.post(
      Uri.parse('$kApiBase/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    );
    if (res.statusCode != 200) throw Exception(jsonDecode(res.body)['error'] ?? 'Auth failed.');

    final data = jsonDecode(res.body);
    _token = data['token'];
    _currentUser = UserModel.fromJson(data['user']);
    await _saveToPrefs();
    notifyListeners();
  }

  Future<void> signInWithEmail(String email, String password) async {
    await _firebaseAuth.signInWithEmailAndPassword(email: email, password: password);
    final res = await http.post(
      Uri.parse('$kApiBase/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (res.statusCode != 200) throw Exception(jsonDecode(res.body)['error'] ?? 'Login failed.');

    final data = jsonDecode(res.body);
    _token = data['token'];
    _currentUser = UserModel.fromJson(data['user']);
    await _saveToPrefs();
    notifyListeners();
  }

  Future<void> registerWithEmail(String email, String password, String name) async {
    final res = await http.post(
      Uri.parse('$kApiBase/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password, 'displayName': name}),
    );
    if (res.statusCode != 201) throw Exception(jsonDecode(res.body)['error'] ?? 'Registration failed.');

    final data = jsonDecode(res.body);
    _token = data['token'];
    _currentUser = UserModel.fromJson(data['user']);
    await _saveToPrefs();
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      if (_token != null) {
        await http.post(Uri.parse('$kApiBase/auth/logout'),
            headers: {'Authorization': 'Bearer $_token'});
      }
    } catch (_) {}
    await _firebaseAuth.signOut();
    await _googleSignIn.signOut();
    _token = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('sducs_token');
    await prefs.remove('sducs_user');
    notifyListeners();
  }

  Future<void> refreshUser() async {
    if (_token == null) return;
    final res = await http.get(
      Uri.parse('$kApiBase/auth/me'),
      headers: {'Authorization': 'Bearer $_token'},
    );
    if (res.statusCode == 200) {
      _currentUser = UserModel.fromJson(jsonDecode(res.body));
      await _saveToPrefs();
      notifyListeners();
    }
  }
}


// ============================================================
//  SDUCS – MK  |  Flutter Storage Service
// ============================================================

class StorageService extends ChangeNotifier {
  int _storageUsed  = 0;
  int _storageTotal = 30 * 1024 * 1024 * 1024;
  int _downloadUsed  = 0;
  int _downloadTotal = 10 * 1024 * 1024 * 1024;

  int    get storageUsed     => _storageUsed;
  int    get storageTotal    => _storageTotal;
  double get storagePercent  => _storageTotal > 0 ? (_storageUsed / _storageTotal * 100) : 0;
  int    get downloadUsed    => _downloadUsed;
  int    get downloadTotal   => _downloadTotal;
  double get downloadPercent => _downloadTotal > 0 ? (_downloadUsed / _downloadTotal * 100) : 0;

  Future<void> fetchStats() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('sducs_token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('$kApiBase/files/stats'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _storageUsed  = data['storage']['used']    ?? 0;
        _storageTotal = data['storage']['total']   ?? _storageTotal;
        _downloadUsed  = data['downloadData']['used']  ?? 0;
        _downloadTotal = data['downloadData']['total'] ?? _downloadTotal;
        notifyListeners();
      }
    } catch (_) {}
  }
}


// ============================================================
//  SDUCS – MK  |  Flutter Ad Service (AdMob)
// ============================================================
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdService extends ChangeNotifier {
  RewardedAd? _rewardedAd;
  int _dailyAdsWatched = 0;
  bool _loading = false;

  int  get dailyAdsWatched => _dailyAdsWatched;
  bool get loading         => _loading;
  bool get canWatch        => _dailyAdsWatched < 10;

  static const _adUnitId = 'ca-app-pub-3940256099942544/5224354917'; // Test ID

  AdService() {
    MobileAds.instance.initialize();
    _loadAd();
  }

  void _loadAd() {
    RewardedAd.load(
      adUnitId: _adUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) { _rewardedAd = ad; notifyListeners(); },
        onAdFailedToLoad: (err) { _rewardedAd = null; },
      ),
    );
  }

  Future<void> watchAd(BuildContext context) async {
    if (!canWatch || _rewardedAd == null) return;
    _loading = true;
    notifyListeners();

    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _rewardedAd = null;
        _loadAd();
        _loading = false;
        notifyListeners();
      },
    );

    _rewardedAd!.show(
      onUserEarnedReward: (ad, reward) async {
        _dailyAdsWatched++;
        // Notify backend to credit reward
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('sducs_token');
        if (token != null) {
          try {
            final initRes = await http.post(
              Uri.parse('$kApiBase/ads/initiate'),
              headers: {'Authorization': 'Bearer $token'},
            );
            if (initRes.statusCode == 200) {
              final initData = jsonDecode(initRes.body);
              await Future.delayed(const Duration(seconds: 1));
              await http.post(
                Uri.parse('$kApiBase/ads/complete'),
                headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
                body: jsonEncode({'token': initData['token'], 'rewardType': 'storage'}),
              );
            }
          } catch (_) {}
        }
        notifyListeners();
      },
    );
  }
}
