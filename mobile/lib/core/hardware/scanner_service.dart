import 'dart:async';
import 'package:flutter/services.dart';

// Handles both camera-based scanning (mobile_scanner) and
// USB/BT HID barcode scanners (which present as keyboard input).
class ScannerService {
  static final ScannerService _instance = ScannerService._internal();
  factory ScannerService() => _instance;
  ScannerService._internal();

  // USB/BT HID scanners send keystrokes ending with Enter.
  // We buffer them here and emit complete barcodes.
  final _barcodeController = StreamController<String>.broadcast();
  final StringBuffer _inputBuffer = StringBuffer();
  DateTime? _lastKeyTime;
  static const _timeout = Duration(milliseconds: 100);

  Stream<String> get barcodeStream => _barcodeController.stream;

  // Call this from a KeyboardListener wrapping your POS screen
  void handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;

    final now = DateTime.now();
    if (_lastKeyTime != null &&
        now.difference(_lastKeyTime!) > _timeout) {
      // Timeout — this is manual keyboard input, not a scanner burst
      _inputBuffer.clear();
    }
    _lastKeyTime = now;

    final logicalKey = event.logicalKey;

    if (logicalKey == LogicalKeyboardKey.enter ||
        logicalKey == LogicalKeyboardKey.numpadEnter) {
      final barcode = _inputBuffer.toString().trim();
      if (barcode.isNotEmpty) {
        _barcodeController.add(barcode);
      }
      _inputBuffer.clear();
    } else {
      final char = event.character;
      if (char != null && char.isNotEmpty) {
        _inputBuffer.write(char);
      }
    }
  }

  void dispose() {
    _barcodeController.close();
  }
}

final scannerService = ScannerService();
