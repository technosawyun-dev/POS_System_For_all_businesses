import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../providers/pos_provider.dart';
import '../widgets/product_grid.dart';
import '../widgets/cart_panel.dart';
import '../widgets/payment_dialog.dart';
import '../../cashier_session/providers/session_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/connectivity_provider.dart';
import '../../../core/hardware/scanner_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../models/order_model.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  bool _showCartSheet = false;
  StreamSubscription<String>? _scannerSub;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleHwKey);
    _scannerSub = scannerService.barcodeStream.listen(_onBarcode);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleHwKey);
    _scannerSub?.cancel();
    super.dispose();
  }

  bool _handleHwKey(KeyEvent event) {
    scannerService.handleKeyEvent(event);
    return false;
  }

  void _onBarcode(String barcode) {
    if (!mounted) return;
    final user = ref.read(authProvider).user;
    final session = ref.read(sessionProvider).session;
    if (user == null || session == null) return;
    final branchId = user.primaryBranchId ?? session.branchId;
    final products = ref.read(productListProvider(branchId)).products;
    final matches = products.where(
      (p) => p.barcode == barcode || p.sku == barcode,
    );
    if (matches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Product not found: $barcode'),
        backgroundColor: AppColors.error,
        duration: const Duration(seconds: 2),
      ));
      return;
    }
    final product = matches.first;
    final cartParams = (branchId: branchId, sessionId: session.id);
    ref.read(posCartProvider(cartParams).notifier).addItem(product);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('${product.name} added'),
      backgroundColor: AppColors.success,
      duration: const Duration(seconds: 1),
    ));
  }

  Future<void> _openCameraScanner(BuildContext ctx) async {
    final barcode = await showModalBottomSheet<String>(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _PosScannerSheet(),
    );
    if (barcode != null) _onBarcode(barcode);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final session = ref.watch(sessionProvider).session;
    final isOnline = ref.watch(isOnlineProvider);

    if (user == null || session == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Gate: POS checkout requires tablet (≥700dp). Small phones are not supported.
    if (MediaQuery.of(context).size.width < 700) {
      return Scaffold(
        appBar: AppBar(title: const Text('Point of Sale')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.tablet_mac_outlined,
                    size: 80, color: AppColors.textSecondary),
                const SizedBox(height: 24),
                const Text('Tablet Required',
                    style: TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                const Text(
                  'The POS checkout is not available on small screens.\nPlease use a tablet or larger device.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 14, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 32),
                OutlinedButton.icon(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final branchId = user.primaryBranchId ?? session.branchId;
    final cartParams = (branchId: branchId, sessionId: session.id);
    final cartState = ref.watch(posCartProvider(cartParams));

    // Listen for completed order
    ref.listen<PosCartState>(posCartProvider(cartParams),
        (prev, next) {
      if (next.lastCompletedOrder != null &&
          (prev?.lastCompletedOrder == null)) {
        _showOrderComplete(context, next.lastCompletedOrder!, cartParams);
      }
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: AppColors.error,
          ),
        );
        ref.read(posCartProvider(cartParams).notifier).clearError();
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Point of Sale'),
        actions: [
          // Camera scanner button
          Builder(builder: (ctx) => IconButton(
            icon: const Icon(Icons.qr_code_scanner_outlined),
            tooltip: 'Scan barcode',
            onPressed: () => _openCameraScanner(ctx),
          )),
          // Offline indicator
          if (!isOnline)
            Container(
              margin: const EdgeInsets.only(right: 4),
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.wifi_off, size: 14,
                      color: AppColors.warning),
                  SizedBox(width: 4),
                  Text('Offline',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.warning)),
                ],
              ),
            ),
          PopupMenuButton(
            icon: const Icon(Icons.more_vert),
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'session',
                child: ListTile(
                  leading: Icon(Icons.lock_outline),
                  title: Text('Close Session'),
                  dense: true,
                ),
              ),
              const PopupMenuItem(
                value: 'orders',
                child: ListTile(
                  leading: Icon(Icons.receipt_long_outlined),
                  title: Text('Order History'),
                  dense: true,
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: ListTile(
                  leading: Icon(Icons.logout),
                  title: Text('Sign Out'),
                  dense: true,
                ),
              ),
            ],
            onSelected: (v) {
              if (v == 'logout') {
                ref.read(authProvider.notifier).logout();
              } else if (v == 'session') {
                context.push('/session/close');
              } else if (v == 'orders') {
                context.push('/orders');
              }
            },
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (ctx, constraints) {
          // Tablet layout: side by side
          if (constraints.maxWidth >= 720) {
            return Row(
              children: [
                // Product grid (left, 60%)
                Expanded(
                  flex: 60,
                  child: ProductGrid(
                    branchId: branchId,
                    sessionId: session.id,
                    branchIdForCart: branchId,
                  ),
                ),
                const VerticalDivider(width: 1),
                // Cart (right, 40%)
                SizedBox(
                  width: constraints.maxWidth * 0.38,
                  child: CartPanel(
                    branchId: branchId,
                    sessionId: session.id,
                    onCheckout: () => _showPaymentDialog(
                        context, cartState.total, cartParams),
                    onClear: () => ref
                        .read(posCartProvider(cartParams).notifier)
                        .clearCart(),
                  ),
                ),
              ],
            );
          }

          // Phone layout: full product grid + bottom cart button
          return Stack(
            children: [
              ProductGrid(
                branchId: branchId,
                sessionId: session.id,
                branchIdForCart: branchId,
                onItemAdded: () {
                  if (!_showCartSheet) {
                    setState(() => _showCartSheet = true);
                  }
                },
              ),
              if (!cartState.isEmpty)
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: ElevatedButton.icon(
                    onPressed: () => _showCartBottomSheet(
                        context, branchId, session.id, cartParams),
                    icon: Stack(
                      alignment: Alignment.topRight,
                      children: [
                        const Icon(Icons.shopping_cart_outlined),
                        Positioned(
                          top: -2,
                          right: -4,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${cartState.itemCount}',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ),
                    label: Text(
                        'View Cart · ${CurrencyFormatter.format(cartState.total)}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  void _showCartBottomSheet(
    BuildContext context,
    String branchId,
    String sessionId,
    ({String branchId, String sessionId}) cartParams,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.85,
        child: Consumer(builder: (context, ref, _) {
          final cartState = ref.watch(posCartProvider(cartParams));
          return CartPanel(
            branchId: branchId,
            sessionId: sessionId,
            onCheckout: () {
              Navigator.pop(ctx);
              _showPaymentDialog(
                  context, cartState.total, cartParams);
            },
            onClear: () {
              Navigator.pop(ctx);
              ref
                  .read(posCartProvider(cartParams).notifier)
                  .clearCart();
            },
          );
        }),
      ),
    );
  }

  void _showPaymentDialog(
    BuildContext context,
    double total,
    ({String branchId, String sessionId}) cartParams,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => PaymentDialog(
        totalAmount: total,
        onConfirm: (payments) {
          Navigator.pop(context);
          ref
              .read(posCartProvider(cartParams).notifier)
              .checkout(payments);
        },
      ),
    );
  }

  void _showOrderComplete(
    BuildContext context,
    OrderModel order,
    ({String branchId, String sessionId}) cartParams,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.successLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  color: AppColors.success, size: 48),
            ),
            const SizedBox(height: 16),
            const Text('Sale Complete!',
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              'Order #${order.orderNumber}',
              style: const TextStyle(
                  fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              CurrencyFormatter.format(order.netTotal),
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      ref
                          .read(posCartProvider(cartParams).notifier)
                          .clearLastOrder();
                      context.push('/receipt/${order.id}');
                    },
                    icon: const Icon(Icons.receipt_outlined,
                        size: 18),
                    label: const Text('Receipt'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      ref
                          .read(posCartProvider(cartParams).notifier)
                          .clearLastOrder();
                    },
                    icon: const Icon(Icons.add_shopping_cart,
                        size: 18),
                    label: const Text('New Sale'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PosScannerSheet extends StatefulWidget {
  const _PosScannerSheet();

  @override
  State<_PosScannerSheet> createState() => _PosScannerSheetState();
}

class _PosScannerSheetState extends State<_PosScannerSheet> {
  final _controller = MobileScannerController();
  bool _scanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.55,
      decoration: const BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
            child: Row(
              children: [
                const Icon(Icons.qr_code_scanner_outlined,
                    color: Colors.white, size: 20),
                const SizedBox(width: 10),
                const Text('Scan Product Barcode',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(20)),
              child: MobileScanner(
                controller: _controller,
                onDetect: (capture) {
                  if (_scanned) return;
                  final raw = capture.barcodes.isNotEmpty
                      ? capture.barcodes.first.rawValue
                      : null;
                  if (raw != null && raw.isNotEmpty) {
                    _scanned = true;
                    Navigator.of(context).pop(raw);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
