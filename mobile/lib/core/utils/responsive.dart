import 'package:flutter/material.dart';

class Responsive {
  static const double _phone = 600;
  static const double _tablet = 840;

  static bool isPhone(BuildContext context) =>
      MediaQuery.of(context).size.width < _phone;
  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= _phone;
  static bool isWide(BuildContext context) =>
      MediaQuery.of(context).size.width >= _tablet;

  // Dynamic grid column count based on available width
  static int gridCols(
    double width, {
    int phone = 2,
    int tablet = 3,
    int wide = 4,
  }) {
    if (width >= _tablet) return wide;
    if (width >= _phone) return tablet;
    return phone;
  }

  // Bottom sheet max-width: constrained on tablets for better UX
  static BoxConstraints bottomSheetConstraints(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    return BoxConstraints(maxWidth: w > 640 ? 640 : w);
  }
}

// Wraps content with a centered max-width constraint.
// Use for forms and detail screens so they don't sprawl on large tablets.
class ContentWrapper extends StatelessWidget {
  final Widget child;
  final double maxWidth;

  const ContentWrapper({
    super.key,
    required this.child,
    this.maxWidth = 680,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
