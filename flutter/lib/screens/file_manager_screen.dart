// ============================================================
//  SDUCS – MK  |  Flutter File Manager Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../utils/app_theme.dart';
import '../services/auth_service.dart';

const String kApiBase = 'https://your-api.com/api';

const Map<String, String> kCategoryIcons = {
  'image':    '🖼️',
  'video':    '🎬',
  'audio':    '🎵',
  'document': '📄',
  'archive':  '📦',
  'other':    '📁',
};

String fmtBytes(int bytes) {
  if (bytes >= 1e9) return '${(bytes / 1e9).toStringAsFixed(1)} GB';
  if (bytes >= 1e6) return '${(bytes / 1e6).toStringAsFixed(1)} MB';
  if (bytes >= 1e3) return '${(bytes / 1e3).toStringAsFixed(0)} KB';
  return '$bytes B';
}

class FileManagerScreen extends StatefulWidget {
  const FileManagerScreen({super.key});
  @override
  State<FileManagerScreen> createState() => _FileManagerScreenState();
}

class _FileManagerScreenState extends State<FileManagerScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  List<Map<String, dynamic>> _files = [];
  List<Map<String, dynamic>> _duplicates = [];
  bool _loading = false;
  bool _uploading = false;
  double _uploadProgress = 0;
  String _selectedCategory = 'all';
  String _search = '';
  int _page = 1;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _tabs.addListener(() {
      if (_tabs.index == 1) _loadDuplicates();
      else _loadFiles();
    });
    _loadFiles();
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('sducs_token');
  }

  Future<void> _loadFiles({bool inBin = false}) async {
    setState(() => _loading = true);
    try {
      final token = await _getToken();
      if (token == null) return;

      final params = {
        'page': '$_page',
        'limit': '20',
        if (_selectedCategory != 'all') 'category': _selectedCategory,
        if (_search.isNotEmpty) 'search': _search,
        if (inBin) 'deleted': 'true',
      };

      final uri = Uri.parse('$kApiBase/files').replace(queryParameters: params);
      final res = await http.get(uri, headers: {'Authorization': 'Bearer $token'});

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _files = List<Map<String, dynamic>>.from(data['files'] ?? []);
          _total = data['total'] ?? 0;
        });
      }
    } catch (e) {
      _showSnack('Failed to load files: $e', error: true);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadDuplicates() async {
    setState(() => _loading = true);
    try {
      final token = await _getToken();
      if (token == null) return;
      final res = await http.get(
        Uri.parse('$kApiBase/files/duplicates'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() => _duplicates = List<Map<String, dynamic>>.from(data['groups'] ?? []));
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _uploadFile() async {
    // Request storage permission
    final status = await Permission.storage.request();
    if (!status.isGranted) {
      _showSnack('Storage permission required.', error: true);
      return;
    }

    final result = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (result == null || result.files.isEmpty) return;

    setState(() { _uploading = true; _uploadProgress = 0; });

    final token = await _getToken();
    if (token == null) return;

    for (int i = 0; i < result.files.length; i++) {
      final pf = result.files[i];
      if (pf.path == null) continue;

      try {
        final request = http.MultipartRequest('POST', Uri.parse('$kApiBase/files/upload'))
          ..headers['Authorization'] = 'Bearer $token'
          ..files.add(await http.MultipartFile.fromPath('file', pf.path!,
              filename: pf.name));

        final streamed = await request.send();
        final res = await http.Response.fromStream(streamed);

        if (res.statusCode == 201) {
          setState(() => _uploadProgress = (i + 1) / result.files.length);
        } else {
          final err = jsonDecode(res.body)['error'] ?? 'Upload failed';
          _showSnack(err, error: true);
        }
      } catch (e) {
        _showSnack('Upload error: $e', error: true);
      }
    }

    setState(() { _uploading = false; _uploadProgress = 0; });
    _loadFiles();
    _showSnack('Files uploaded successfully!');
  }

  Future<void> _deleteFile(String id, {bool permanent = false}) async {
    final confirm = await _showConfirm(
      permanent ? 'Delete permanently?' : 'Move to recycle bin?',
      permanent ? 'This cannot be undone.' : 'You can restore it within 30 days.',
    );
    if (!confirm) return;

    final token = await _getToken();
    if (token == null) return;

    final uri = Uri.parse('$kApiBase/files/$id${permanent ? "?permanent=true" : ""}');
    final res = await http.delete(uri, headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      _showSnack(permanent ? 'File deleted permanently.' : 'Moved to recycle bin.');
      _loadFiles();
    } else {
      _showSnack('Delete failed.', error: true);
    }
  }

  Future<void> _restoreFile(String id) async {
    final token = await _getToken();
    if (token == null) return;
    final res = await http.post(
      Uri.parse('$kApiBase/files/$id/restore'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode == 200) {
      _showSnack('File restored!');
      _loadFiles(inBin: true);
    }
  }

  Future<void> _shareFile(Map<String, dynamic> file) async {
    final token = await _getToken();
    if (token == null) return;
    final res = await http.post(
      Uri.parse('$kApiBase/files/${file['_id']}/share'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'expiresIn': 24, 'generateCode': true}),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (!mounted) return;
      _showShareDialog(data['shareLink'], data['accessCode']);
    }
  }

  void _showShareDialog(String link, String? code) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Share File', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Share Link:', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
          const SizedBox(height: 6),
          SelectableText(link, style: const TextStyle(color: Color(0xFF818CF8), fontSize: 13)),
          if (code != null) ...[
            const SizedBox(height: 14),
            Text('Access Code (shown once):', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
            const SizedBox(height: 6),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              ...code.split('').map((d) => Container(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: 36, height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: AppTheme.primary.withOpacity(0.15),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.4)),
                ),
                child: Center(child: Text(d, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700))),
              )),
            ]),
            const SizedBox(height: 8),
            Text('⚠️ Save this code — it won\'t be shown again.',
                style: TextStyle(color: Colors.orange.withOpacity(0.7), fontSize: 11)),
          ],
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }

  Future<bool> _showConfirm(String title, String body) async {
    return await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        content: Text(body, style: TextStyle(color: Colors.white.withOpacity(0.6))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    ) ?? false;
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.redAccent : AppTheme.primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('File Manager'),
        backgroundColor: AppTheme.surface,
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppTheme.primary,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white38,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: '📁 My Files'),
            Tab(text: '🔁 Dupes'),
            Tab(text: '🤖 AI'),
            Tab(text: '🗑️ Bin'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _FilesTab(
            files: _files, loading: _loading, uploading: _uploading,
            uploadProgress: _uploadProgress, total: _total,
            selectedCategory: _selectedCategory, search: _search, page: _page,
            onUpload: _uploadFile,
            onDelete: (id) => _deleteFile(id),
            onShare: _shareFile,
            onCategoryChange: (c) { setState(() { _selectedCategory = c; _page = 1; }); _loadFiles(); },
            onSearchChange: (s) { setState(() { _search = s; _page = 1; }); _loadFiles(); },
            onPageChange: (p) { setState(() => _page = p); _loadFiles(); },
          ),
          _DuplicatesTab(duplicates: _duplicates, loading: _loading, onDelete: (id) => _deleteFile(id)),
          _AITab(token: _getToken),
          _FilesTab(
            files: _files, loading: _loading, uploading: _uploading,
            uploadProgress: _uploadProgress, total: _total,
            selectedCategory: _selectedCategory, search: _search, page: _page,
            inBin: true,
            onUpload: () {},
            onDelete: (id) => _deleteFile(id, permanent: true),
            onShare: (_) {},
            onRestore: _restoreFile,
            onCategoryChange: (c) { setState(() => _selectedCategory = c); _loadFiles(inBin: true); },
            onSearchChange: (s) { setState(() => _search = s); _loadFiles(inBin: true); },
            onPageChange: (p) { setState(() => _page = p); _loadFiles(inBin: true); },
          ),
        ],
      ),
    );
  }
}

// ── Files Tab ─────────────────────────────────────────────────
class _FilesTab extends StatelessWidget {
  final List<Map<String, dynamic>> files;
  final bool loading, uploading, inBin;
  final double uploadProgress;
  final int total, page;
  final String selectedCategory, search;
  final VoidCallback onUpload;
  final Function(String) onDelete;
  final Function(Map<String, dynamic>) onShare;
  final Function(String)? onRestore;
  final Function(String) onCategoryChange;
  final Function(String) onSearchChange;
  final Function(int) onPageChange;

  const _FilesTab({
    required this.files, required this.loading, required this.uploading,
    required this.uploadProgress, required this.total, required this.page,
    required this.selectedCategory, required this.search,
    required this.onUpload, required this.onDelete, required this.onShare,
    required this.onCategoryChange, required this.onSearchChange,
    required this.onPageChange,
    this.inBin = false, this.onRestore,
  });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Upload zone (only in files tab)
      if (!inBin)
        GestureDetector(
          onTap: onUpload,
          child: Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.primary.withOpacity(0.3), style: BorderStyle.solid),
              color: AppTheme.primary.withOpacity(0.06),
            ),
            child: uploading
                ? Column(children: [
                    SizedBox(
                      width: 200,
                      child: LinearProgressIndicator(value: uploadProgress, backgroundColor: Colors.white12,
                          valueColor: const AlwaysStoppedAnimation(AppTheme.primary)),
                    ),
                    const SizedBox(height: 8),
                    Text('Uploading… ${(uploadProgress * 100).toInt()}%',
                        style: const TextStyle(color: Colors.white54, fontSize: 13)),
                  ])
                : const Column(children: [
                    Text('☁️', style: TextStyle(fontSize: 28)),
                    SizedBox(height: 6),
                    Text('Tap to upload files', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w500)),
                    SizedBox(height: 2),
                    Text('AES-256 encrypted automatically', style: TextStyle(color: Colors.white30, fontSize: 11)),
                  ]),
          ),
        ),

      // Category pills
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Row(children: ['all', 'image', 'video', 'audio', 'document', 'archive', 'other'].map((c) =>
          GestureDetector(
            onTap: () => onCategoryChange(c),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(50),
                color: selectedCategory == c ? AppTheme.primary.withOpacity(0.25) : Colors.white.withOpacity(0.05),
                border: Border.all(
                  color: selectedCategory == c ? AppTheme.primary.withOpacity(0.6) : Colors.white.withOpacity(0.07),
                ),
              ),
              child: Text(
                c == 'all' ? 'All' : '${kCategoryIcons[c]} $c',
                style: TextStyle(
                    fontSize: 12,
                    color: selectedCategory == c ? Colors.white : Colors.white38,
                    fontWeight: selectedCategory == c ? FontWeight.w600 : FontWeight.normal),
              ),
            ),
          )).toList(),
        ),
      ),

      // Search
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: TextField(
          onChanged: onSearchChange,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: InputDecoration(
            hintText: '🔍  Search files…',
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
            filled: true,
            fillColor: Colors.white.withOpacity(0.05),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
      ),

      // Files list
      Expanded(
        child: loading
            ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
            : files.isEmpty
                ? Center(child: Text(inBin ? '🗑️ Recycle bin is empty' : '📭 No files yet',
                    style: TextStyle(color: Colors.white.withOpacity(0.4))))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: files.length,
                    itemBuilder: (_, i) {
                      final f = files[i];
                      return _FileListItem(
                        file: f, inBin: inBin,
                        onDelete: () => onDelete(f['_id']),
                        onShare: () => onShare(f),
                        onRestore: onRestore != null ? () => onRestore!(f['_id']) : null,
                      );
                    },
                  ),
      ),

      // Pagination
      if (total > 20)
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(icon: const Icon(Icons.chevron_left, color: Colors.white54), onPressed: page > 1 ? () => onPageChange(page - 1) : null),
            Text('Page $page', style: const TextStyle(color: Colors.white54, fontSize: 13)),
            IconButton(icon: const Icon(Icons.chevron_right, color: Colors.white54), onPressed: files.length >= 20 ? () => onPageChange(page + 1) : null),
          ]),
        ),
    ]);
  }
}

class _FileListItem extends StatelessWidget {
  final Map<String, dynamic> file;
  final bool inBin;
  final VoidCallback onDelete, onShare;
  final VoidCallback? onRestore;

  const _FileListItem({required this.file, required this.inBin, required this.onDelete, required this.onShare, this.onRestore});

  @override
  Widget build(BuildContext context) {
    final icon = kCategoryIcons[file['category']] ?? '📁';
    final size = fmtBytes(file['sizeBytes'] ?? 0);
    final date = file['createdAt'] != null
        ? DateTime.tryParse(file['createdAt'])?.toLocal().toString().split(' ')[0] ?? ''
        : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: Colors.white.withOpacity(0.04),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Row(children: [
        Text(icon, style: const TextStyle(fontSize: 24)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(file['originalName'] ?? 'Unknown', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 13),
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 3),
          Text('$size · $date', style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11)),
        ])),
        const SizedBox(width: 8),
        if (!inBin) ...[
          _ActionBtn(icon: '🔗', onTap: onShare),
          const SizedBox(width: 4),
          _ActionBtn(icon: '🗑️', onTap: onDelete),
        ] else ...[
          _ActionBtn(icon: '↩️', onTap: onRestore ?? () {}),
          const SizedBox(width: 4),
          _ActionBtn(icon: '💀', onTap: onDelete),
        ],
      ]),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String icon;
  final VoidCallback onTap;
  const _ActionBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: 34, height: 34,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), color: Colors.white.withOpacity(0.06)),
      child: Center(child: Text(icon, style: const TextStyle(fontSize: 16))),
    ),
  );
}

// ── Duplicates Tab ────────────────────────────────────────────
class _DuplicatesTab extends StatelessWidget {
  final List<Map<String, dynamic>> duplicates;
  final bool loading;
  final Function(String) onDelete;
  const _DuplicatesTab({required this.duplicates, required this.loading, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    if (duplicates.isEmpty) {
      return const Center(child: Text('✅ No duplicate files found!', style: TextStyle(color: Colors.white54)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: duplicates.length,
      itemBuilder: (_, i) {
        final g = duplicates[i];
        final files = List<Map<String, dynamic>>.from(g['files'] ?? []);
        final size = fmtBytes(files.isNotEmpty ? (files[0]['sizeBytes'] ?? 0) : 0);
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: Colors.orange.withOpacity(0.06),
            border: Border.all(color: Colors.orange.withOpacity(0.2)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Text('🔁', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Expanded(child: Text('${files.length} copies · Save ${fmtBytes((files[0]['sizeBytes'] ?? 0) * (files.length - 1))}',
                  style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.w600, fontSize: 13))),
            ]),
            const SizedBox(height: 10),
            ...files.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Expanded(child: Text(f['originalName'] ?? '', style: const TextStyle(color: Colors.white70, fontSize: 12), overflow: TextOverflow.ellipsis)),
                Text(fmtBytes(f['sizeBytes'] ?? 0), style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11)),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => onDelete(f['_id']),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), color: Colors.redAccent.withOpacity(0.15)),
                    child: const Text('Delete', style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            )),
          ]),
        );
      },
    );
  }
}

// ── AI Optimize Tab ───────────────────────────────────────────
class _AITab extends StatefulWidget {
  final Future<String?> Function() token;
  const _AITab({required this.token});
  @override
  State<_AITab> createState() => _AITabState();
}

class _AITabState extends State<_AITab> {
  Map<String, dynamic>? _results;
  bool _loading = false;

  Future<void> _runAnalysis() async {
    setState(() => _loading = true);
    try {
      final token = await widget.token();
      if (token == null) return;
      final res = await http.post(
        Uri.parse('$kApiBase/ai/storage-optimization'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        setState(() => _results = jsonDecode(res.body));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('AI analysis failed: $e'), backgroundColor: Colors.redAccent));
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _priorityColor(String p) => p == 'high' ? Colors.redAccent : p == 'medium' ? Colors.orange : Colors.green;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        GestureDetector(
          onTap: _loading ? null : _runAnalysis,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 15),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: _loading ? null : const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)]),
              color: _loading ? Colors.white12 : null,
            ),
            child: Center(
              child: _loading
                  ? const Row(mainAxisSize: MainAxisSize.min, children: [
                      SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2,color:Colors.white)),
                      SizedBox(width:8),
                      Text('🤖 Analyzing storage…', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    ])
                  : const Text('🤖 Run AI Storage Analysis', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
            ),
          ),
        ),

        if (_results != null) ...[
          const SizedBox(height: 20),
          // Score
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), color: Colors.white.withOpacity(0.04)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Storage Health', style: TextStyle(color: Colors.white70, fontSize: 12)),
                const SizedBox(height: 4),
                Text(_results!['summary'] ?? '', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
              ])),
              const SizedBox(width: 12),
              Container(
                width: 60, height: 60,
                decoration: BoxDecoration(shape: BoxShape.circle,
                  border: Border.all(color: _results!['storageScore'] >= 70 ? Colors.green : Colors.orange, width: 3)),
                child: Center(child: Text('${_results!['storageScore']}',
                    style: TextStyle(color: _results!['storageScore'] >= 70 ? Colors.green : Colors.orange, fontWeight: FontWeight.w800, fontSize: 18))),
              ),
            ]),
          ),
          const SizedBox(height: 12),

          // Recommendations
          ...(_results!['recommendations'] as List? ?? []).map((r) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: _priorityColor(r['priority']).withOpacity(0.07),
              border: Border.all(color: _priorityColor(r['priority']).withOpacity(0.25)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(6), color: _priorityColor(r['priority']).withOpacity(0.2)),
                  child: Text(r['priority'].toString().toUpperCase(),
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _priorityColor(r['priority']), letterSpacing: 1)),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(r['title'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13))),
                if ((r['estimatedSavingsMB'] ?? 0) > 0)
                  Text('~${r['estimatedSavingsMB']} MB', style: const TextStyle(color: Colors.green, fontSize: 11)),
              ]),
              const SizedBox(height: 6),
              Text(r['description'] ?? '', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
            ]),
          )),
        ],
      ]),
    );
  }
}
