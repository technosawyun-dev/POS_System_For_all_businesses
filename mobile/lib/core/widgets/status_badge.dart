import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String? label;

  const StatusBadge({super.key, required this.status, this.label});

  Color get _textColor {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'COMPLETED':
      case 'PAID':
      case 'RECEIVED':
      case 'SUCCESS':
        return AppColors.success;
      case 'PENDING':
      case 'ORDERED':
      case 'DRAFT':
      case 'PARTIAL':
      case 'TRIAL':
        return AppColors.warning;
      case 'INACTIVE':
      case 'VOIDED':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'SUSPENDED':
      case 'FAILED':
        return AppColors.error;
      case 'PROCESSING':
      case 'INFO':
        return AppColors.info;
      default:
        return AppColors.textSecondary;
    }
  }

  Color get _bgColor {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'COMPLETED':
      case 'PAID':
      case 'RECEIVED':
      case 'SUCCESS':
        return AppColors.successLight;
      case 'PENDING':
      case 'ORDERED':
      case 'DRAFT':
      case 'PARTIAL':
      case 'TRIAL':
        return AppColors.warningLight;
      case 'INACTIVE':
      case 'VOIDED':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'SUSPENDED':
      case 'FAILED':
        return AppColors.errorLight;
      case 'PROCESSING':
      case 'INFO':
        return AppColors.infoLight;
      default:
        return AppColors.surfaceVariant;
    }
  }

  String get _displayLabel {
    final text = label ?? status;
    return text[0].toUpperCase() +
        text.substring(1).toLowerCase().replaceAll('_', ' ');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _displayLabel,
        style: TextStyle(
          color: _textColor,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
