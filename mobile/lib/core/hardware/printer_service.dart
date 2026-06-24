import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:usb_serial/usb_serial.dart';
import '../../models/order_model.dart';
import '../utils/currency_formatter.dart';

// Supports:
//   - USB thermal printers (usb_serial — Android USB Host)
//   - Serial printers via USB-to-Serial adapters (usb_serial — CH340/PL2303/FTDI/CP21xx)
//   - Bluetooth ESC/POS printers (flutter_blue_plus)
//   - WiFi/LAN ESC/POS printers (raw TCP socket)
// Cash drawer: pulse sent as ESC/POS command after receipt.

class PrinterService {
  static final PrinterService _instance = PrinterService._internal();
  factory PrinterService() => _instance;
  PrinterService._internal();

  // USB / Serial (both use usb_serial on Android)
  UsbPort? _usbPort;
  _UsbMode? _usbMode;

  // Bluetooth
  BluetoothDevice? _connectedBtDevice;
  BluetoothCharacteristic? _printCharacteristic;

  // Connection status

  bool get isUsbConnected => _usbPort != null;
  bool get isSerialConnected => _usbPort != null && _usbMode == _UsbMode.serial;
  bool get isBtConnected => _printCharacteristic != null;
  bool get isAnyConnected => isUsbConnected || isBtConnected;

  // USB (direct USB thermal printer)

  Future<List<UsbDevice>> listUsbDevices() => UsbSerial.listDevices();

  Future<bool> connectUsb(UsbDevice device) async {
    await disconnectUsb();
    try {
      _usbPort = await device.create();
      if (_usbPort == null) return false;
      if (!await _usbPort!.open()) {
        _usbPort = null;
        return false;
      }
      await _usbPort!.setDTR(true);
      await _usbPort!.setRTS(true);
      await _usbPort!.setPortParameters(
        38400, UsbPort.DATABITS_8, UsbPort.STOPBITS_1, UsbPort.PARITY_NONE,
      );
      _usbMode = _UsbMode.usb;
      return true;
    } catch (_) {
      _usbPort = null;
      return false;
    }
  }

  // Serial (USB-to-Serial adapter: CH340/PL2303/FTDI/CP21xx)

  Future<bool> connectSerial(UsbDevice device) async {
    await disconnectUsb();
    try {
      _usbPort = await device.create();
      if (_usbPort == null) return false;
      if (!await _usbPort!.open()) {
        _usbPort = null;
        return false;
      }
      await _usbPort!.setDTR(true);
      await _usbPort!.setRTS(true);
      await _usbPort!.setPortParameters(
        9600, UsbPort.DATABITS_8, UsbPort.STOPBITS_1, UsbPort.PARITY_NONE,
      );
      _usbMode = _UsbMode.serial;
      return true;
    } catch (_) {
      _usbPort = null;
      return false;
    }
  }

  Future<void> disconnectUsb() async {
    try { await _usbPort?.close(); } catch (_) {}
    _usbPort = null;
    _usbMode = null;
  }

  // Bluetooth

  Future<List<BluetoothDevice>> scanBluetooth(
      {Duration timeout = const Duration(seconds: 5)}) async {
    final results = <BluetoothDevice>[];
    final sub = FlutterBluePlus.scanResults.listen((scanResults) {
      for (final r in scanResults) {
        if (!results.any((d) => d.remoteId == r.device.remoteId)) {
          results.add(r.device);
        }
      }
    });
    await FlutterBluePlus.startScan(timeout: timeout);
    await Future.delayed(timeout);
    await sub.cancel();
    return results;
  }

  Future<bool> connectBluetooth(BluetoothDevice device) async {
    try {
      await device.connect(autoConnect: false);
      _connectedBtDevice = device;
      final services = await device.discoverServices();
      for (final service in services) {
        for (final char in service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            _printCharacteristic = char;
            return true;
          }
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> disconnectBluetooth() async {
    await _connectedBtDevice?.disconnect();
    _connectedBtDevice = null;
    _printCharacteristic = null;
  }

  // WiFi / LAN

  Future<bool> printViaWifi({
    required String ipAddress,
    required int port,
    required List<int> data,
  }) async {
    try {
      final socket = await Socket.connect(
          ipAddress, port, timeout: const Duration(seconds: 5));
      socket.add(data);
      await socket.flush();
      await socket.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ESC/POS receipt builder

  List<int> buildReceipt(OrderModel order,
      {String? businessName, String? footer}) {
    final bytes = <int>[];

    bytes.addAll([0x1B, 0x40]); // ESC @ — init
    bytes.addAll([0x1B, 0x61, 0x01]); // center

    // Business name
    bytes.addAll([0x1B, 0x45, 0x01]);
    bytes.addAll([0x1D, 0x21, 0x11]);
    bytes.addAll(_encode('${businessName ?? 'SawYun POS'}\n'));
    bytes.addAll([0x1D, 0x21, 0x00]);
    bytes.addAll([0x1B, 0x45, 0x00]);

    bytes.addAll(_encode('--------------------------------\n'));
    bytes.addAll(_encode('Order: ${order.orderNumber}\n'));
    bytes.addAll(_encode('--------------------------------\n'));

    bytes.addAll([0x1B, 0x61, 0x00]); // left
    for (final item in order.items) {
      final name = item.displayName.length > 20
          ? item.displayName.substring(0, 20)
          : item.displayName;
      bytes.addAll(_encode(
        '$name\n  x${item.quantityOrdered} @ '
        '${CurrencyFormatter.formatCompact(item.unitPrice)}  '
        '${CurrencyFormatter.formatCompact(item.lineTotal)}\n',
      ));
    }

    bytes.addAll(_encode('--------------------------------\n'));
    bytes.addAll(_encode(_pad('Subtotal:', CurrencyFormatter.formatCompact(order.grossTotal))));
    if (order.taxTotal > 0) {
      bytes.addAll(_encode(_pad('Tax:', CurrencyFormatter.formatCompact(order.taxTotal))));
    }
    if (order.discountTotal > 0) {
      bytes.addAll(_encode(_pad('Discount:', '-${CurrencyFormatter.formatCompact(order.discountTotal)}')));
    }
    bytes.addAll([0x1B, 0x45, 0x01]);
    bytes.addAll(_encode(_pad('TOTAL:', CurrencyFormatter.format(order.netTotal))));
    bytes.addAll([0x1B, 0x45, 0x00]);

    if (order.payments.isNotEmpty) {
      bytes.addAll(_encode('--------------------------------\n'));
      for (final p in order.payments) {
        bytes.addAll(_encode(
          _pad('${PaymentMethod.displayName(p.paymentMethod)}:',
              CurrencyFormatter.formatCompact(p.amount)),
        ));
      }
    }

    bytes.addAll([0x1B, 0x61, 0x01]); // center
    bytes.addAll(_encode('\n${footer ?? 'Thank you for your purchase!'}\n'));
    bytes.addAll(_encode('\n\n\n'));
    bytes.addAll([0x1D, 0x56, 0x00]); // full cut

    return bytes;
  }

  List<int> openCashDrawerCommand() => [0x1B, 0x70, 0x00, 0x19, 0x19];

  // Print receipt (routes to connected transport)
  // Priority: USB/Serial > Bluetooth > WiFi (explicit params required)

  Future<bool> printReceipt(
    OrderModel order, {
    String? businessName,
    String? footer,
    bool openDrawer = false,
    String? wifiIp,
    int wifiPort = 9100,
  }) async {
    final data = buildReceipt(order, businessName: businessName, footer: footer);
    if (openDrawer) data.addAll(openCashDrawerCommand());

    // USB / Serial
    if (_usbPort != null) {
      try {
        await _usbPort!.write(Uint8List.fromList(data));
        return true;
      } catch (_) {
        return false;
      }
    }

    // Bluetooth
    if (_printCharacteristic != null) {
      try {
        const chunk = 512;
        for (var i = 0; i < data.length; i += chunk) {
          final end = (i + chunk) < data.length ? i + chunk : data.length;
          await _printCharacteristic!.write(
            data.sublist(i, end),
            withoutResponse: true,
          );
          await Future.delayed(const Duration(milliseconds: 20));
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    // WiFi (explicit IP required)
    if (wifiIp != null) {
      return printViaWifi(ipAddress: wifiIp, port: wifiPort, data: data);
    }

    return false;
  }

  // Helpers

  List<int> _encode(String text) => text.codeUnits;

  String _pad(String left, String right, {int width = 32}) {
    final spaces = width - left.length - right.length;
    return '$left${' ' * (spaces > 0 ? spaces : 1)}$right\n';
  }
}

enum _UsbMode { usb, serial }

final printerService = PrinterService();
