// ============================================================
//  SDUCS – MK  |  User Model
// ============================================================

class SubscriptionModel {
  final String plan;
  final String? planLabel;
  final int? dataGB;
  final DateTime? expiresAt;

  SubscriptionModel({required this.plan, this.planLabel, this.dataGB, this.expiresAt});

  factory SubscriptionModel.fromJson(Map<String, dynamic> json) => SubscriptionModel(
    plan:      json['plan'] ?? 'none',
    planLabel: json['planLabel'],
    dataGB:    json['dataGB'],
    expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
  );

  Map<String, dynamic> toJson() => {
    'plan':      plan,
    'planLabel': planLabel,
    'dataGB':    dataGB,
    'expiresAt': expiresAt?.toIso8601String(),
  };
}

class CloudStorageModel {
  final int usedBytes, totalBytes, maxCapBytes;
  CloudStorageModel({required this.usedBytes, required this.totalBytes, required this.maxCapBytes});
  factory CloudStorageModel.fromJson(Map<String, dynamic> j) => CloudStorageModel(
    usedBytes:   j['usedBytes']   ?? 0,
    totalBytes:  j['totalBytes']  ?? 30 * 1024 * 1024 * 1024,
    maxCapBytes: j['maxCapBytes'] ?? 100 * 1024 * 1024 * 1024,
  );
  Map<String, dynamic> toJson() => {'usedBytes': usedBytes, 'totalBytes': totalBytes, 'maxCapBytes': maxCapBytes};
}

class UserModel {
  final String uid, email;
  final String? displayName, photoURL;
  final bool isAdmin;
  final CloudStorageModel cloudStorage;
  final SubscriptionModel? subscription;

  UserModel({
    required this.uid, required this.email,
    this.displayName, this.photoURL,
    this.isAdmin = false,
    required this.cloudStorage,
    this.subscription,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    uid:          json['uid'] ?? '',
    email:        json['email'] ?? '',
    displayName:  json['displayName'],
    photoURL:     json['photoURL'],
    isAdmin:      json['isAdmin'] ?? false,
    cloudStorage: json['cloudStorage'] != null
        ? CloudStorageModel.fromJson(json['cloudStorage'])
        : CloudStorageModel(usedBytes: 0, totalBytes: 30*1024*1024*1024, maxCapBytes: 100*1024*1024*1024),
    subscription: json['subscription'] != null
        ? SubscriptionModel.fromJson(json['subscription'])
        : null,
  );

  Map<String, dynamic> toJson() => {
    'uid': uid, 'email': email,
    'displayName': displayName, 'photoURL': photoURL,
    'isAdmin': isAdmin,
    'cloudStorage': cloudStorage.toJson(),
    'subscription': subscription?.toJson(),
  };
}
