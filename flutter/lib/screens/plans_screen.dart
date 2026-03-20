// ============================================================
//  SDUCS – MK  |  Flutter Plans Screen
// ============================================================
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/app_theme.dart';
import '../services/auth_service.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

const String kApiBase = 'https://your-api.com/api';

const List<Map<String, dynamic>> kPlans = [
  {'id': 'lite',    'label': 'Lite',    'data': '5 GB',  'price': 25,  'days': 2, 'color': 0xFF60A5FA,
   'features': ['5 GB download data', '2-day validity', 'Priority support']},
  {'id': 'premium', 'label': 'Premium', 'data': '10 GB', 'price': 49,  'days': 4, 'color': 0xFF34D399, 'popular': true,
   'features': ['10 GB download data', '4-day validity', 'Fast downloads', 'Priority support']},
  {'id': 'pro',     'label': 'Pro',     'data': '20 GB', 'price': 99,  'days': 6, 'color': 0xFFF59E0B,
   'features': ['20 GB download data', '6-day validity', 'Unlimited speed', 'AI features']},
  {'id': 'promax',  'label': 'Pro Max', 'data': '50 GB', 'price': 200, 'days': 8, 'color': 0xFFF472B6,
   'features': ['50 GB download data', '8-day validity', 'Everything in Pro', 'Dedicated support']},
];

class PlansScreen extends StatelessWidget {
  const PlansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Upgrade Plan'), backgroundColor: AppTheme.surface),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text('Choose a Plan', style: const TextStyle(color: Colors.white, fontFamily: 'Syne', fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('Get more download data for high-speed access', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13)),
          const SizedBox(height: 20),

          ...kPlans.map((plan) => _PlanCard(plan: plan, onSelect: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentScreen(plan: plan)));
          })),

          // Free rewards note
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(colors: [
                const Color(0xFF06B6D4).withOpacity(0.1),
                const Color(0xFF7C3AED).withOpacity(0.1),
              ]),
              border: Border.all(color: const Color(0xFF06B6D4).withOpacity(0.2)),
            ),
            child: const Column(children: [
              Text('💡 Free Storage via Ads', style: TextStyle(color: Color(0xFF67E8F9), fontWeight: FontWeight.w700)),
              SizedBox(height: 6),
              Text('Earn 100–500 MB per ad view (up to 2 GB/day) completely free from your dashboard!',
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  final VoidCallback onSelect;
  const _PlanCard({required this.plan, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final color = Color(plan['color']);
    final isPopular = plan['popular'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Colors.white.withOpacity(0.04),
        border: Border.all(color: isPopular ? color.withOpacity(0.5) : Colors.white.withOpacity(0.08), width: isPopular ? 1.5 : 1),
        boxShadow: isPopular ? [BoxShadow(color: color.withOpacity(0.15), blurRadius: 20)] : null,
      ),
      child: Stack(children: [
        if (isPopular) Positioned(top: 0, right: 12, child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color,
            borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(8), bottomRight: Radius.circular(8)),
          ),
          child: const Text('Most Popular', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
        )),
        Padding(
          padding: const EdgeInsets.all(18),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(plan['label'], style: TextStyle(color: color, fontFamily: 'Syne', fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              RichText(text: TextSpan(children: [
                const TextSpan(text: '₹', style: TextStyle(color: Colors.white70, fontSize: 14)),
                TextSpan(text: '${plan['price']}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                TextSpan(text: ' / ${plan['days']} days', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13)),
              ])),
              const SizedBox(height: 2),
              Text('${plan['data']} Download Data', style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              ...(plan['features'] as List).map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  Text('✓', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(width: 6),
                  Text(f, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
                ]),
              )),
            ])),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: onSelect,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(colors: [color.withOpacity(0.8), color]),
                ),
                child: const Text('Buy', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ============================================================
//  Payment Screen
// ============================================================
class PaymentScreen extends StatefulWidget {
  final Map<String, dynamic> plan;
  const PaymentScreen({super.key, required this.plan});
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  String _method = 'razorpay';
  Map<String, dynamic>? _orderData;
  Map<String, dynamic>? _fallbackData;
  bool _loading = false;
  String _step = 'choose'; // choose | qr | screenshot | success
  int _timer = 30 * 60;

  late Razorpay _razorpay;
  XFile? _screenshot;
  final _utrCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaySuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPayError);
  }

  @override
  void dispose() {
    _razorpay.clear();
    _utrCtrl.dispose();
    super.dispose();
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('sducs_token');
  }

  void _onPaySuccess(PaymentSuccessResponse resp) async {
    final token = await _getToken();
    if (token == null) return;
    try {
      final res = await http.post(
        Uri.parse('$kApiBase/payments/verify'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({
          'razorpay_order_id': resp.orderId,
          'razorpay_payment_id': resp.paymentId,
          'razorpay_signature': resp.signature,
        }),
      );
      if (res.statusCode == 200) setState(() => _step = 'success');
      else _showSnack('Verification failed. Contact support.', error: true);
    } catch (e) {
      _showSnack('Verification error: $e', error: true);
    }
  }

  void _onPayError(PaymentFailureResponse resp) {
    _showSnack('Payment failed: ${resp.message}', error: true);
  }

  Future<void> _initiateRazorpay() async {
    setState(() => _loading = true);
    try {
      final token = await _getToken();
      if (token == null) return;
      final res = await http.post(
        Uri.parse('$kApiBase/payments/create-order'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'plan': widget.plan['id']}),
      );
      if (res.statusCode != 200) throw Exception(jsonDecode(res.body)['error']);

      final data = jsonDecode(res.body);
      setState(() { _orderData = data; _step = 'qr'; });

      // Open Razorpay checkout
      _razorpay.open({
        'key': data['razorpayKeyId'],
        'amount': widget.plan['price'] * 100,
        'name': 'SDUCS-MK',
        'description': '${widget.plan['label']} Plan – ${widget.plan['data']}',
        'order_id': data['orderId'],
        'theme': {'color': '#5C6EE6'},
        'prefill': {},
      });
    } catch (e) {
      _showSnack('$e', error: true);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _initiateUPI() async {
    setState(() => _loading = true);
    try {
      final token = await _getToken();
      if (token == null) return;
      final res = await http.post(
        Uri.parse('$kApiBase/payments/upi-fallback/initiate'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'plan': widget.plan['id']}),
      );
      if (res.statusCode != 200) throw Exception(jsonDecode(res.body)['error']);
      setState(() { _fallbackData = jsonDecode(res.body); _step = 'qr'; });
    } catch (e) {
      _showSnack('$e', error: true);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitScreenshot() async {
    if (_screenshot == null) return _showSnack('Please select a screenshot.', error: true);
    setState(() => _loading = true);
    try {
      final token = await _getToken();
      if (token == null) return;
      final request = http.MultipartRequest('POST', Uri.parse('$kApiBase/payments/upi-fallback/submit'))
        ..headers['Authorization'] = 'Bearer $token'
        ..fields['transactionId'] = _fallbackData!['transactionId']
        ..fields['utrNumber'] = _utrCtrl.text
        ..files.add(await http.MultipartFile.fromPath('screenshot', _screenshot!.path));

      final streamed = await request.send();
      final res = await http.Response.fromStream(streamed);
      if (res.statusCode == 200) {
        setState(() => _step = 'success');
      } else {
        _showSnack(jsonDecode(res.body)['error'] ?? 'Submission failed.', error: true);
      }
    } catch (e) {
      _showSnack('$e', error: true);
    } finally {
      setState(() => _loading = false);
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg), backgroundColor: error ? Colors.redAccent : AppTheme.primary,
      behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  Color get _planColor => Color(widget.plan['color']);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Payment'), backgroundColor: AppTheme.surface),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          // Plan bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _planColor.withOpacity(0.4)),
              color: _planColor.withOpacity(0.06),
            ),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.plan['label'], style: TextStyle(color: _planColor, fontWeight: FontWeight.w800, fontSize: 16)),
                Text('${widget.plan['data']} · ${widget.plan['days']} days',
                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
              ])),
              Text('₹${widget.plan['price']}', style: TextStyle(color: _planColor, fontSize: 22, fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(height: 20),

          if (_step == 'choose') ...[
            Text('Choose Payment Method', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _MethodOption(
              selected: _method == 'razorpay', title: 'Razorpay (Recommended)',
              subtitle: 'UPI, Cards, Net Banking – Instant', badge: 'Instant', badgeColor: Colors.green,
              onTap: () => setState(() => _method = 'razorpay'),
            ),
            const SizedBox(height: 8),
            _MethodOption(
              selected: _method == 'upi', title: 'Manual UPI Transfer',
              subtitle: 'Scan QR → Pay → Upload screenshot', badge: '2–4 hrs', badgeColor: Colors.orange,
              onTap: () => setState(() => _method = 'upi'),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: _loading ? null : (_method == 'razorpay' ? _initiateRazorpay : _initiateUPI),
              child: Container(
                width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 15),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: LinearGradient(colors: [_planColor.withOpacity(0.8), _planColor]),
                ),
                child: Center(child: _loading
                    ? const SizedBox(width:20,height:20,child:CircularProgressIndicator(strokeWidth:2,color:Colors.white))
                    : Text('Pay ₹${widget.plan['price']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16))),
              ),
            ),
          ],

          if (_step == 'qr') ...[
            Text(_method == 'razorpay' ? 'Scan QR to Pay' : 'Scan & Pay via UPI',
                style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            // Show QR from backend (base64 data URL)
            if ((_orderData ?? _fallbackData)?['qrCode'] != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: Colors.white),
                child: Image.network((_orderData ?? _fallbackData)!['qrCode'], width: 200, height: 200,
                  errorBuilder: (_, __, ___) => const SizedBox(width: 200, height: 200,
                    child: Center(child: Text('QR Code', style: TextStyle(color: Colors.black)))),
                ),
              ),
            const SizedBox(height: 12),
            Text('₹${widget.plan['price']}', style: TextStyle(color: _planColor, fontSize: 24, fontWeight: FontWeight.w800)),
            if (_method == 'upi') ...[
              const SizedBox(height: 16),
              ...List<String>.from(_fallbackData?['instructions'] ?? []).asMap().entries.map((e) =>
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 22, height: 22, margin: const EdgeInsets.only(right: 10, top: 1),
                      decoration: BoxDecoration(shape: BoxShape.circle, color: AppTheme.primary.withOpacity(0.2)),
                      child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w700))),
                    ),
                    Expanded(child: Text(e.value, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13))),
                  ]),
                )
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () => setState(() => _step = 'screenshot'),
                child: Container(
                  width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(13),
                    gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)])),
                  child: const Center(child: Text("I've Paid → Upload Screenshot",
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                ),
              ),
            ],
          ],

          if (_step == 'screenshot') ...[
            const Text('Upload Payment Proof', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () async {
                final img = await ImagePicker().pickImage(source: ImageSource.gallery);
                if (img != null) setState(() => _screenshot = img);
              },
              child: Container(
                height: 160, width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                  color: AppTheme.primary.withOpacity(0.06),
                ),
                child: _screenshot != null
                    ? ClipRRect(borderRadius: BorderRadius.circular(14),
                        child: Image.network(_screenshot!.path, fit: BoxFit.cover))
                    : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Text('📸', style: TextStyle(fontSize: 36)),
                        const SizedBox(height: 8),
                        Text('Tap to select screenshot', style: TextStyle(color: Colors.white.withOpacity(0.5))),
                      ]),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _utrCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'UTR / Transaction ID (optional)',
                labelStyle: const TextStyle(color: Colors.white38),
                filled: true, fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _loading ? null : _submitScreenshot,
              child: Container(
                width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(13),
                  gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)])),
                child: Center(child: _loading
                    ? const SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2,color:Colors.white))
                    : const Text('Submit for Verification', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
              ),
            ),
          ],

          if (_step == 'success') ...[
            const SizedBox(height: 30),
            const Text('✅', style: TextStyle(fontSize: 60)),
            const SizedBox(height: 16),
            Text(_method == 'razorpay' ? 'Payment Successful!' : 'Submission Received!',
                style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Text(
              _method == 'razorpay'
                  ? 'Your ${widget.plan['label']} plan is now active with ${widget.plan['data']} data!'
                  : 'Your plan will be activated within 2–4 hours after admin verification.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => Navigator.popUntil(context, ModalRoute.withName('/dashboard')),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(13),
                  gradient: const LinearGradient(colors: [Color(0xFF5C6EE6), Color(0xFF7C3AED)])),
                child: const Text('Go to Dashboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

class _MethodOption extends StatelessWidget {
  final bool selected;
  final String title, subtitle, badge;
  final Color badgeColor;
  final VoidCallback onTap;
  const _MethodOption({required this.selected, required this.title, required this.subtitle, required this.badge, required this.badgeColor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? AppTheme.primary.withOpacity(0.6) : Colors.white.withOpacity(0.08)),
          color: selected ? AppTheme.primary.withOpacity(0.08) : Colors.white.withOpacity(0.04),
        ),
        child: Row(children: [
          Container(
            width: 20, height: 20,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? AppTheme.primary : Colors.white38, width: 2)),
            child: selected ? Container(margin: const EdgeInsets.all(3), decoration: const BoxDecoration(shape: BoxShape.circle, color: AppTheme.primary)) : null,
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(color: selected ? Colors.white : Colors.white70, fontWeight: FontWeight.w600, fontSize: 14)),
            Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), color: badgeColor.withOpacity(0.15)),
            child: Text(badge, style: TextStyle(color: badgeColor, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
      ),
    );
  }
}
