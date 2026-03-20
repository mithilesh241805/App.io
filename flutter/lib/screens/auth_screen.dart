// ============================================================
//  SDUCS – MK  |  Flutter Auth Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../utils/app_theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with TickerProviderStateMixin {
  bool _isSignIn = true;
  bool _loading = false;
  bool _showPwd = false;
  String _error = '';

  final _emailCtrl = TextEditingController();
  final _pwdCtrl   = TextEditingController();
  final _nameCtrl  = TextEditingController();

  late AnimationController _bgCtrl;
  late AnimationController _cardCtrl;
  late Animation<double> _cardAnim;

  @override
  void initState() {
    super.initState();
    _bgCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 8))..repeat(reverse: true);
    _cardCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _cardAnim = CurvedAnimation(parent: _cardCtrl, curve: Curves.easeOutCubic);
    _cardCtrl.forward();
  }

  @override
  void dispose() {
    _bgCtrl.dispose(); _cardCtrl.dispose();
    _emailCtrl.dispose(); _pwdCtrl.dispose(); _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleGoogle() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final auth = context.read<AuthService>();
      await auth.signInWithGoogle();
      if (mounted) Navigator.pushReplacementNamed(context, '/dashboard');
    } catch (e) {
      setState(() { _error = 'Google sign-in failed. Try again.'; });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleEmail() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final auth = context.read<AuthService>();
      if (_isSignIn) {
        await auth.signInWithEmail(_emailCtrl.text.trim(), _pwdCtrl.text);
      } else {
        await auth.registerWithEmail(
          _emailCtrl.text.trim(), _pwdCtrl.text, _nameCtrl.text.trim());
      }
      if (mounted) Navigator.pushReplacementNamed(context, '/dashboard');
    } catch (e) {
      setState(() { _error = e.toString().replaceAll('Exception: ', ''); });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Animated gradient background ──────────────────
          AnimatedBuilder(
            animation: _bgCtrl,
            builder: (_, __) => Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: const [Color(0xFF050810), Color(0xFF0D0E2A), Color(0xFF10062A)],
                ),
              ),
            ),
          ),
          // Orbs
          Positioned(top: -80, left: -80, child: _Orb(size: 280, color: AppTheme.primary.withOpacity(0.3), anim: _bgCtrl)),
          Positioned(bottom: -60, right: -60, child: _Orb(size: 240, color: AppTheme.secondary.withOpacity(0.25), anim: _bgCtrl)),
          Positioned(top: 200, right: -40, child: _Orb(size: 180, color: AppTheme.accent.withOpacity(0.2), anim: _bgCtrl)),

          // ── Card ──────────────────────────────────────────
          FadeTransition(
            opacity: _cardAnim,
            child: SlideTransition(
              position: Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero).animate(_cardAnim),
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 420),
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      color: const Color(0xFF0F1428).withOpacity(0.85),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                      boxShadow: [
                        BoxShadow(color: AppTheme.primary.withOpacity(0.15), blurRadius: 60, spreadRadius: -10),
                        BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 40),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Logo
                        Row(children: [
                          Container(
                            width: 48, height: 48,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              gradient: const LinearGradient(
                                colors: [Color(0xFF5C6EE6), Color(0xFFC946EF)],
                              ),
                              boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.4), blurRadius: 20)],
                            ),
                            child: const Center(
                              child: Text('S', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, fontFamily: 'Syne')),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('SDUCS', style: TextStyle(fontFamily: 'Syne', fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 1)),
                              Text('MK Multitasking', style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
                            ],
                          ),
                        ]),
                        const SizedBox(height: 6),
                        Text('Your intelligent cloud workspace', style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.35))),
                        const SizedBox(height: 24),

                        // Toggle
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            color: Colors.white.withOpacity(0.05),
                          ),
                          child: Row(children: [
                            _ToggleBtn(label: 'Sign In', active: _isSignIn, onTap: () => setState(() { _isSignIn = true; _error = ''; })),
                            _ToggleBtn(label: 'Sign Up', active: !_isSignIn, onTap: () => setState(() { _isSignIn = false; _error = ''; })),
                          ]),
                        ),
                        const SizedBox(height: 20),

                        // Google button
                        _GlassButton(
                          onTap: _loading ? null : _handleGoogle,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _GoogleIcon(),
                              const SizedBox(width: 10),
                              const Text('Continue with Google', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Divider
                        Row(children: [
                          Expanded(child: Divider(color: Colors.white.withOpacity(0.08))),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text('or', style: TextStyle(color: Colors.white.withOpacity(0.28), fontSize: 12)),
                          ),
                          Expanded(child: Divider(color: Colors.white.withOpacity(0.08))),
                        ]),
                        const SizedBox(height: 16),

                        // Email form
                        if (!_isSignIn) ...[
                          _InputField(ctrl: _nameCtrl, label: 'Full Name', hint: 'Your name'),
                          const SizedBox(height: 12),
                        ],
                        _InputField(ctrl: _emailCtrl, label: 'Email', hint: 'you@example.com', keyboardType: TextInputType.emailAddress),
                        const SizedBox(height: 12),
                        _InputField(
                          ctrl: _pwdCtrl, label: 'Password', hint: 'At least 8 characters',
                          obscure: !_showPwd,
                          suffix: IconButton(
                            icon: Icon(_showPwd ? Icons.visibility_off : Icons.visibility, color: Colors.white38, size: 18),
                            onPressed: () => setState(() => _showPwd = !_showPwd),
                          ),
                        ),

                        if (_error.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              color: Colors.red.withOpacity(0.1),
                              border: Border.all(color: Colors.red.withOpacity(0.3)),
                            ),
                            child: Text(_error, style: const TextStyle(color: Color(0xFFfca5a5), fontSize: 13)),
                          ),
                        ],
                        const SizedBox(height: 16),

                        // Submit
                        GestureDetector(
                          onTap: _loading ? null : _handleEmail,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(13),
                              gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)]),
                              boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.35), blurRadius: 20, offset: const Offset(0,6))],
                            ),
                            child: Center(
                              child: _loading
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : Text(_isSignIn ? 'Sign In' : 'Create Account',
                                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ),

                        if (!_isSignIn) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              gradient: LinearGradient(colors: [
                                const Color(0xFF06B6D4).withOpacity(0.1),
                                const Color(0xFF7C3AED).withOpacity(0.1),
                              ]),
                              border: Border.all(color: const Color(0xFF06B6D4).withOpacity(0.2)),
                            ),
                            child: const Text(
                              '🎁 Sign up & get 30 GB cloud storage + 10 GB download data free!',
                              style: TextStyle(color: Color(0xFF67E8F9), fontSize: 12.5),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  final double size;
  final Color color;
  final Animation<double> anim;
  const _Orb({required this.size, required this.color, required this.anim});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: anim,
      builder: (_, __) => Transform.scale(
        scale: 0.95 + anim.value * 0.1,
        child: Container(
          width: size, height: size,
          decoration: BoxDecoration(shape: BoxShape.circle,
            gradient: RadialGradient(colors: [color, Colors.transparent]),
          ),
        ),
      ),
    );
  }
}

class _ToggleBtn extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _ToggleBtn({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            gradient: active ? const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)]) : null,
            boxShadow: active ? [BoxShadow(color: AppTheme.primary.withOpacity(0.3), blurRadius: 12)] : null,
          ),
          child: Text(label, textAlign: TextAlign.center,
              style: TextStyle(color: active ? Colors.white : Colors.white38, fontSize: 14, fontWeight: FontWeight.w500)),
        ),
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  const _GlassButton({required this.child, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white.withOpacity(0.05),
          border: Border.all(color: Colors.white.withOpacity(0.12)),
        ),
        child: child,
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final TextEditingController ctrl;
  final String label, hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final Widget? suffix;
  const _InputField({required this.ctrl, required this.label, required this.hint, this.obscure = false, this.keyboardType, this.suffix});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white.withOpacity(0.5))),
        const SizedBox(height: 7),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 14),
            suffixIcon: suffix,
            filled: true,
            fillColor: Colors.white.withOpacity(0.05),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide(color: Colors.white.withOpacity(0.1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: const BorderSide(color: Color(0xFF5C6EE6), width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }
}

class _GoogleIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 20, height: 20,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  const _GooglePainter();
  @override
  void paint(Canvas canvas, Size size) {
    // Simplified Google "G" logo using colored segments
    final paint = Paint()..style = PaintingStyle.fill;
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(Rect.fromCircle(center: center, radius: r), -1.57, 1.57, true, paint);
    paint.color = const Color(0xFF34A853);
    canvas.drawArc(Rect.fromCircle(center: center, radius: r), 0.0, 1.57, true, paint);
    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(Rect.fromCircle(center: center, radius: r), 1.57, 1.57, true, paint);
    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(Rect.fromCircle(center: center, radius: r), 3.14, 1.57, true, paint);
    paint.color = const Color(0xFF0F1428);
    canvas.drawCircle(center, r * 0.55, paint);
    paint.color = const Color(0xFF4285F4);
    canvas.drawRect(Rect.fromLTWH(center.dx, center.dy - r * 0.12, r, r * 0.24), paint);
  }

  @override
  bool shouldRepaint(_) => false;
}
