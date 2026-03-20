// ============================================================
//  SDUCS – MK  |  Flutter Dashboard Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import '../services/ad_service.dart';
import '../utils/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  int _navIndex = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _animCtrl.forward();
    _loadData();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  Future<void> _loadData() async {
    final storage = context.read<StorageService>();
    await storage.fetchStats();
  }

  @override
  Widget build(BuildContext context) {
    final auth    = context.watch<AuthService>();
    final storage = context.watch<StorageService>();
    final adSvc   = context.watch<AdService>();

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(children: [
          // Top bar
          _TopBar(user: auth.currentUser, onMenuTap: () {}),
          // Body
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadData,
              color: AppTheme.primary,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Greeting
                    FadeTransition(
                      opacity: _animCtrl,
                      child: _Greeting(name: auth.currentUser?.displayName?.split(' ').first ?? 'there'),
                    ),
                    const SizedBox(height: 20),

                    // Storage cards
                    SlideTransition(
                      position: Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
                        CurvedAnimation(parent: _animCtrl, curve: const Interval(0.2, 1, curve: Curves.easeOut)),
                      ),
                      child: _StorageCards(storage: storage),
                    ),
                    const SizedBox(height: 16),

                    // Ad Reward card
                    _AdRewardCard(adSvc: adSvc, storage: storage),
                    const SizedBox(height: 16),

                    // Quick Actions
                    _QuickActions(onTap: (route) => Navigator.pushNamed(context, route)),
                    const SizedBox(height: 16),

                    // Plan badge
                    if (auth.currentUser?.subscription?.plan != null &&
                        auth.currentUser!.subscription!.plan != 'none')
                      _PlanBadge(subscription: auth.currentUser!.subscription!),
                  ],
                ),
              ),
            ),
          ),
        ]),
      ),
      bottomNavigationBar: _BottomNav(
        currentIndex: _navIndex,
        onTap: (i) {
          setState(() => _navIndex = i);
          final routes = ['/dashboard', '/files', '/downloads', '/plans', '/settings'];
          if (i != 0) Navigator.pushNamed(context, routes[i]);
        },
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final dynamic user;
  final VoidCallback onMenuTap;
  const _TopBar({required this.user, required this.onMenuTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: AppTheme.surface.withOpacity(0.8),
        border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.06))),
      ),
      child: Row(children: [
        // Logo
        Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFFC946EF)]),
          ),
          child: const Center(child: Text('S', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('SDUCS', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
          Text('MK Multitasking', style: TextStyle(fontSize: 9, color: Colors.white.withOpacity(0.4))),
        ]),
        const Spacer(),
        CircleAvatar(
          radius: 16,
          backgroundColor: AppTheme.primary.withOpacity(0.3),
          backgroundImage: user?.photoURL != null ? NetworkImage(user!.photoURL!) : null,
          child: user?.photoURL == null
              ? Text(user?.displayName?[0].toUpperCase() ?? 'U',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13))
              : null,
        ),
      ]),
    );
  }
}

class _Greeting extends StatelessWidget {
  final String name;
  const _Greeting({required this.name});

  String get _timeGreeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      RichText(text: TextSpan(
        text: '$_timeGreeting, ',
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white),
        children: [
          TextSpan(text: '$name 👋',
              style: const TextStyle(
                  foreground: Paint()..shader = const LinearGradient(colors: [Color(0xFF818CF8), Color(0xFFC084FC)])
                      .createShader(Rect.fromLTWH(0, 0, 200, 20)))),
        ],
      )),
      const SizedBox(height: 4),
      Text("Here's your SDUCS-MK overview", style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.38))),
    ]);
  }
}

class _StorageCards extends StatelessWidget {
  final StorageService storage;
  const _StorageCards({required this.storage});

  String _fmt(int bytes) {
    if (bytes >= 1e9) return '${(bytes / 1e9).toStringAsFixed(1)} GB';
    if (bytes >= 1e6) return '${(bytes / 1e6).toStringAsFixed(1)} MB';
    return '${(bytes / 1e3).toStringAsFixed(0)} KB';
  }

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: _StatCard(
        icon: '☁️', label: 'Cloud Storage',
        used: storage.storageUsed, total: storage.storageTotal,
        percent: storage.storagePercent, color: const Color(0xFF818CF8), tag: 'STORAGE',
      )),
      const SizedBox(width: 12),
      Expanded(child: _StatCard(
        icon: '⬇️', label: 'Download Data',
        used: storage.downloadUsed, total: storage.downloadTotal,
        percent: storage.downloadPercent, color: const Color(0xFF34D399), tag: 'DATA',
      )),
    ]);
  }
}

class _StatCard extends StatelessWidget {
  final String icon, label, tag;
  final int used, total;
  final double percent;
  final Color color;
  const _StatCard({required this.icon, required this.label, required this.used, required this.total, required this.percent, required this.color, required this.tag});

  String _fmt(int b) {
    if (b >= 1e9) return '${(b/1e9).toStringAsFixed(1)}GB';
    if (b >= 1e6) return '${(b/1e6).toStringAsFixed(1)}MB';
    return '${b}B';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Colors.white.withOpacity(0.04),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tag, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white.withOpacity(0.3), letterSpacing: 1.5)),
        const SizedBox(height: 12),
        SizedBox(
          height: 80,
          child: Stack(alignment: Alignment.center, children: [
            CircularProgressIndicator(
              value: (percent / 100).clamp(0.0, 1.0),
              backgroundColor: Colors.white.withOpacity(0.07),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              strokeWidth: 6,
            ),
            Text('${percent.toStringAsFixed(0)}%', style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w700)),
          ]),
        ),
        const SizedBox(height: 12),
        Text(icon, style: const TextStyle(fontSize: 18)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.45))),
        const SizedBox(height: 4),
        RichText(text: TextSpan(children: [
          TextSpan(text: _fmt(used), style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
          TextSpan(text: ' / ${_fmt(total)}', style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11)),
        ])),
      ]),
    );
  }
}

class _AdRewardCard extends StatelessWidget {
  final AdService adSvc;
  final StorageService storage;
  const _AdRewardCard({required this.adSvc, required this.storage});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [const Color(0xFF0F172A).withOpacity(0.9), const Color(0xFF1E1B4B).withOpacity(0.8)],
        ),
        border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('📺', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Daily Ad Rewards', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
            Text('Earn storage by watching ads', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
          ]),
        ]),
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: (adSvc.dailyAdsWatched / 10).clamp(0.0, 1.0),
            backgroundColor: Colors.white.withOpacity(0.08),
            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF818CF8)),
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 6),
        Text('${adSvc.dailyAdsWatched}/10 ads today', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.35))),
        const SizedBox(height: 12),
        Text('Earn 100–500 MB per ad · Max 2 GB/day', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5))),
        const SizedBox(height: 14),
        GestureDetector(
          onTap: adSvc.canWatch && !adSvc.loading
              ? () async {
                  await adSvc.watchAd(context);
                  await storage.fetchStats();
                }
              : null,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              gradient: (adSvc.canWatch && !adSvc.loading)
                  ? const LinearGradient(colors: [Color(0xFF818CF8), Color(0xFF7C3AED)])
                  : null,
              color: (adSvc.canWatch && !adSvc.loading) ? null : Colors.white.withOpacity(0.08),
            ),
            child: Center(
              child: adSvc.loading
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(adSvc.canWatch ? '▶ Watch Ad & Earn' : '✓ Daily Limit Reached',
                      style: TextStyle(
                          color: adSvc.canWatch ? Colors.white : Colors.white38,
                          fontWeight: FontWeight.w600, fontSize: 14)),
            ),
          ),
        ),
      ]),
    );
  }
}

class _QuickActions extends StatelessWidget {
  final void Function(String route) onTap;
  const _QuickActions({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final actions = [
      {'icon': '⬆️', 'label': 'Upload File',   'route': '/files'},
      {'icon': '⬇️', 'label': 'Downloads',      'route': '/downloads'},
      {'icon': '🔍', 'label': 'Duplicates',     'route': '/files'},
      {'icon': '💎', 'label': 'Upgrade',         'route': '/plans'},
      {'icon': '🗑️', 'label': 'Recycle Bin',    'route': '/recycle'},
      {'icon': '🤖', 'label': 'AI Optimize',     'route': '/files'},
    ];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white.withOpacity(0.7))),
      const SizedBox(height: 10),
      GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 1.1,
        children: actions.map((a) => GestureDetector(
          onTap: () => onTap(a['route']!),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              color: Colors.white.withOpacity(0.04),
              border: Border.all(color: Colors.white.withOpacity(0.07)),
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(a['icon']!, style: const TextStyle(fontSize: 22)),
              const SizedBox(height: 6),
              Text(a['label']!, textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.55))),
            ]),
          ),
        )).toList(),
      ),
    ]);
  }
}

class _PlanBadge extends StatelessWidget {
  final dynamic subscription;
  const _PlanBadge({required this.subscription});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(50),
        color: Colors.white.withOpacity(0.04),
        border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text('✦ ${subscription.planLabel ?? subscription.plan.toUpperCase()} Plan',
            style: const TextStyle(color: Color(0xFF818CF8), fontSize: 13, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int currentIndex;
  final void Function(int) onTap;
  const _BottomNav({required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.07))),
      ),
      child: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: onTap,
        backgroundColor: Colors.transparent,
        selectedItemColor: AppTheme.primary,
        unselectedItemColor: Colors.white38,
        selectedFontSize: 10,
        unselectedFontSize: 10,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        items: const [
          BottomNavigationBarItem(icon: Text('⚡', style: TextStyle(fontSize: 20)), label: 'Home'),
          BottomNavigationBarItem(icon: Text('📁', style: TextStyle(fontSize: 20)), label: 'Files'),
          BottomNavigationBarItem(icon: Text('⬇️', style: TextStyle(fontSize: 20)), label: 'Downloads'),
          BottomNavigationBarItem(icon: Text('💎', style: TextStyle(fontSize: 20)), label: 'Plans'),
          BottomNavigationBarItem(icon: Text('⚙️', style: TextStyle(fontSize: 20)), label: 'Settings'),
        ],
      ),
    );
  }
}
