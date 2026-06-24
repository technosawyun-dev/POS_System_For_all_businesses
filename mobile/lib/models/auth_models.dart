class LoginRequest {
  final String email;
  final String password;
  final String? businessCode;

  const LoginRequest({
    required this.email,
    required this.password,
    this.businessCode,
  });

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
        if (businessCode != null && businessCode!.isNotEmpty)
          'business_code': businessCode,
      };
}

class TokenResponse {
  final String accessToken;
  final String tokenType;

  const TokenResponse({
    required this.accessToken,
    required this.tokenType,
  });

  factory TokenResponse.fromJson(Map<String, dynamic> json) {
    return TokenResponse(
      accessToken: json['access_token'] as String,
      tokenType: json['token_type'] as String? ?? 'bearer',
    );
  }
}

class ChangePasswordRequest {
  final String currentPassword;
  final String newPassword;

  const ChangePasswordRequest({
    required this.currentPassword,
    required this.newPassword,
  });

  Map<String, dynamic> toJson() => {
        'current_password': currentPassword,
        'new_password': newPassword,
      };
}
