import 'package:intl/intl.dart';

class CurrencyFormatter {
  static final _formatter = NumberFormat('#,##0', 'en_US');
  static final _decimalFormatter = NumberFormat('#,##0.##', 'en_US');

  static String format(double amount, {String currency = 'MMK'}) {
    return '$currency ${_formatter.format(amount)}';
  }

  static String formatCompact(double amount) {
    return _formatter.format(amount);
  }

  static String formatWithDecimal(double amount,
      {String currency = 'MMK'}) {
    return '$currency ${_decimalFormatter.format(amount)}';
  }
}
