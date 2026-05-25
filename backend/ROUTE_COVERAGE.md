# Subscription Enforcement Route Coverage

Generated: 2026-05-23 (F10 Hardening)

## Protected by `require_subscription_active()` at ROUTER level

Applied via `_sub_gate` in `app/api/v1/router.py`:

| Router prefix | Tag |
|---|---|
| `/products` | Products |
| `/categories` | Categories |
| `/brands` | Brands |
| `/inventory` | Inventory |
| `/suppliers` | Suppliers |
| `/customers` | Customers |
| `/cashier-sessions` | Cashier Sessions |
| `/sales` | Sales |
| `/payments` | Payments & Refunds |
| `/receipts` | Receipts |

## Protected by `require_feature()` (implies subscription active check)

Applied via `require_feature("analytics")` / `require_feature("procurement")`:

| Router prefix | Feature code |
|---|---|
| `/analytics` | `analytics` |
| `/procurement` | `procurement` |

## Protected by `require_subscription_active()` at ROUTE level

Individual write routes (beyond router-level gate):

| Route | Method | Note |
|---|---|---|
| `/tenants/{tenant_id}/branches` | POST | Branch create — also enforces `validate_branch_limit` |
| `/users` | POST | User create — also enforces `validate_user_limit` |

## Intentionally NOT gated (exempt)

| Router prefix | Reason |
|---|---|
| `/auth` | Login/register are public entry points |
| `/tenants` | Tenant management is admin-level, exempt |
| `/tenants/{id}/branches` GET/PATCH/DELETE | Read/update allowed for operational support |
| `/resellers` | Super admin only, exempt |
| `/audit` | Super admin read-only, exempt |
| `/devices` | POS hardware sync must work even when expired |
| `/sync` | Offline devices must sync regardless of subscription status |
| `/subscriptions` | Subscription management itself must always be accessible |
| `/notifications` | Notifications must always be delivered |
| `/public` | Public pricing/registration requires no auth |

## HTTP Response for Expired Subscriptions

When a gated route is accessed with an EXPIRED or SUSPENDED subscription:

```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_EXPIRED",
    "message": "Subscription expired on YYYY-MM-DD. Please renew to continue.",
    "status_code": 402
  }
}
```

The frontend axios interceptor catches HTTP 402 with code `SUBSCRIPTION_EXPIRED` or
`SUBSCRIPTION_SUSPENDED` and redirects the browser to `/trial-expired`.
