// ============================================================
//  SDUCS – MK  |  Flutter Download Manager Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/app_theme.dart';

const String kApiBase = 'https://your-api.com/api';

String fmtBytes(int b) {
  if (b >= 1e9) return '${(b/1e9).toStringAsFixed(1)} GB';
  if (b >= 1e6) return '${(b/1e6).toStringAsFixed(1)} MB';
  if (b >= 1e3) return '${(b/1e3).toStringAsFixed(0)} KB';
  return '$b B';
}

class DownloadScreen extends StatefulWidget {
  const DownloadScreen({super.key});
  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _DownloadScreenState extends State<DownloadScreen> {
  final _urlCtrl = TextEditingController();
  List<Map<String, dynamic>> _jobs = [];
  Map<String, dynamic>? _detectedFile;
  bool _detecting = false;
  bool _downloading = false;
  String _quality = 'best';
  Map<String, dynamic>? _dataStats;

  final List<String> _qualities = ['best', '1080p', '720p', '480p', '360p', 'audio_only', 'original'];

  @override
  void initState() {
    super.initState();
    _loadJobs();
    _loadDataStats();
  }

  @override
  void dispose() { _urlCtrl.dispose(); super.dispose(); }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('sducs_token');
  }

  Future<void> _loadDataStats() async {
    final token = await _getToken();
    if (token == null) return;
    try {
      final res = await http.get(Uri.parse('$kApiBase/files/stats'), headers: {'Authorization': 'Bearer $token'});
      if (res.statusCode == 200) {
        setState(() => _dataStats = jsonDecode(res.body)['downloadData']);
      }
    } catch (_) {}
  }

  Future<void> _loadJobs() async {
    final token = await _getToken();
    if (token == null) return;
    try {
      final res = await http.get(Uri.parse('$kApiBase/downloads'), headers: {'Authorization': 'Bearer $token'});
      if (res.statusCode == 200) {
        setState(() => _jobs = List<Map<String, dynamic>>.from(jsonDecode(res.body)['jobs'] ?? []));
      }
    } catch (_) {}
  }

  Future<void> _detectURL() async {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) return;

    setState(() { _detecting = true; _detectedFile = null; });
    final token = await _getToken();
    if (token == null) return;

    try {
      final res = await http.post(
        Uri.parse('$kApiBase/downloads/detect'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'url': url}),
      );
      if (res.statusCode == 200) {
        setState(() => _detectedFile = jsonDecode(res.body));
      } else {
        _showSnack(jsonDecode(res.body)['error'] ?? 'Invalid URL.', error: true);
      }
    } catch (e) {
      _showSnack('Detection failed: $e', error: true);
    } finally {
      setState(() => _detecting = false);
    }
  }

  Future<void> _startDownload() async {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) return;

    setState(() => _downloading = true);
    final token = await _getToken();
    if (token == null) return;

    try {
      final res = await http.post(
        Uri.parse('$kApiBase/downloads/start'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'url': url, 'quality': _quality}),
      );
      if (res.statusCode == 201) {
        _urlCtrl.clear();
        setState(() => _detectedFile = null);
        _showSnack('Download started!');
        _loadJobs();
        _loadDataStats();
      } else {
        final err = jsonDecode(res.body)['error'] ?? 'Download failed.';
        if (err.contains('download data')) {
          _showUpgradeDialog();
        } else {
          _showSnack(err, error: true);
        }
      }
    } catch (e) {
      _showSnack('$e', error: true);
    } finally {
      setState(() => _downloading = false);
    }
  }

  void _showUpgradeDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Download Data Exhausted', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        content: Text('You\'ve used all your download data. Upgrade your plan or watch ads to earn more.',
            style: TextStyle(color: Colors.white.withOpacity(0.6))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () { Navigator.pop(context); Navigator.pushNamed(context, '/plans'); },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Upgrade Plan'),
          ),
        ],
      ),
    );
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg), backgroundColor: error ? Colors.redAccent : AppTheme.primary,
      behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'completed': return Colors.green;
      case 'downloading': return AppTheme.primary;
      case 'failed': return Colors.redAccent;
      case 'queued': return Colors.orange;
      default: return Colors.white38;
    }
  }

  String _statusIcon(String s) {
    switch (s) {
      case 'completed': return '✅';
      case 'downloading': return '⬇️';
      case 'failed': return '❌';
      case 'queued': return '⏳';
      case 'paused': return '⏸️';
      default: return '📋';
    }
  }

  @override
  Widget build(BuildContext context) {
    final dataUsed = _dataStats?['used'] ?? 0;
    final dataTotal = _dataStats?['total'] ?? 10 * 1024 * 1024 * 1024;
    final dataPercent = dataTotal > 0 ? (dataUsed / dataTotal * 100) : 0.0;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Download Manager'), backgroundColor: AppTheme.surface),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Data usage bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: Colors.white.withOpacity(0.04),
              border: Border.all(color: Colors.white.withOpacity(0.07)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Text('⬇️  Download Data', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600, fontSize: 14)),
                const Spacer(),
                Text('${fmtBytes(dataUsed)} / ${fmtBytes(dataTotal)}',
                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
              ]),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (dataPercent / 100).clamp(0.0, 1.0),
                  minHeight: 7,
                  backgroundColor: Colors.white12,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    dataPercent > 80 ? Colors.orange : const Color(0xFF34D399),
                  ),
                ),
              ),
              if (dataPercent > 80) ...[
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/plans'),
                  child: Text('⚠️ Running low! Tap to upgrade →',
                      style: TextStyle(color: Colors.orange.withOpacity(0.8), fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 16),

          // URL Input
          const Text('New Download', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: Colors.white.withOpacity(0.04),
              border: Border.all(color: Colors.white.withOpacity(0.07)),
            ),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _urlCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Paste direct download URL here…',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 12),
                      filled: true, fillColor: Colors.white.withOpacity(0.05),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _detecting ? null : _detectURL,
                  child: Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), color: AppTheme.primary.withOpacity(0.2)),
                    child: Center(child: _detecting
                        ? const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2,color:AppTheme.primary))
                        : const Text('🔍', style: TextStyle(fontSize: 18))),
                  ),
                ),
              ]),

              // Detected file info
              if (_detectedFile != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), color: AppTheme.primary.withOpacity(0.1)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text(_detectedFile!['icon'] ?? '📁', style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 8),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_detectedFile!['fileName'] ?? 'Unknown', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                            overflow: TextOverflow.ellipsis),
                        Text('${_detectedFile!['mimeType'] ?? '?'} · ${fmtBytes(_detectedFile!['estimatedSize'] ?? 0)}',
                            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
                      ])),
                    ]),

                    // Quality selector (for video/audio)
                    if (_detectedFile!['hasQualityOptions'] == true) ...[
                      const SizedBox(height: 10),
                      Text('Quality:', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                      const SizedBox(height: 6),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(children: _qualities.map((q) => GestureDetector(
                          onTap: () => setState(() => _quality = q),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.only(right: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              color: _quality == q ? AppTheme.primary.withOpacity(0.3) : Colors.white.withOpacity(0.06),
                              border: Border.all(color: _quality == q ? AppTheme.primary.withOpacity(0.6) : Colors.white.withOpacity(0.07)),
                            ),
                            child: Text(q, style: TextStyle(color: _quality == q ? Colors.white : Colors.white38, fontSize: 11)),
                          ),
                        )).toList()),
                      ),
                    ],
                  ]),
                ),
              ],

              const SizedBox(height: 12),
              GestureDetector(
                onTap: _downloading ? null : _startDownload,
                child: Container(
                  width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(11),
                    gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)]),
                  ),
                  child: Center(child: _downloading
                      ? const SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2,color:Colors.white))
                      : const Text('⬇️  Start Download', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                ),
              ),
            ]),
          ),

          // Jobs list
          if (_jobs.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(children: [
              const Text('Download History', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              const Spacer(),
              GestureDetector(onTap: _loadJobs, child: const Text('Refresh', style: TextStyle(color: AppTheme.primary, fontSize: 13))),
            ]),
            const SizedBox(height: 10),
            ..._jobs.map((job) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                color: Colors.white.withOpacity(0.04),
                border: Border.all(color: Colors.white.withOpacity(0.06)),
              ),
              child: Column(children: [
                Row(children: [
                  Text(_statusIcon(job['status'] ?? ''), style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(job['fileName'] ?? job['url'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 13),
                        overflow: TextOverflow.ellipsis),
                    Text(
                      job['sizeBytes'] != null ? fmtBytes(job['sizeBytes']) : 'Size unknown',
                      style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11),
                    ),
                  ])),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: _statusColor(job['status'] ?? '').withOpacity(0.15),
                    ),
                    child: Text(job['status'] ?? '', style: TextStyle(color: _statusColor(job['status'] ?? ''), fontSize: 10, fontWeight: FontWeight.w700)),
                  ),
                ]),
                if (job['status'] == 'downloading' && job['progressPercent'] != null) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (job['progressPercent'] / 100.0).clamp(0.0, 1.0),
                      minHeight: 5,
                      backgroundColor: Colors.white12,
                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('${job['progressPercent']}% · ${fmtBytes((job['speedBps'] ?? 0)).replaceAll(' ', '')}/s',
                      style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11)),
                ],
              ]),
            )),
          ],
        ]),
      ),
    );
  }
}
