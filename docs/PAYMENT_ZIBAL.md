# Zibal Payment Gateway

Bordin uses **Zibal only** — no other payment gateway is supported.

## Environment variables

| Variable | Production | Staging (mock) | Staging (live test) |
|----------|------------|----------------|---------------------|
| `ZIBAL_MERCHANT_ID` | `6a37a39d85fd495b7d3a9049` | same or `zibal` | `6a37a39d85fd495b7d3a9049` |
| `PAYMENT_GATEWAY_MOCK` | `false` | `true` | `false` |
| `ZIBAL_USE_LIVE_ON_STAGING` | — | — | `true` |
| `PAYMENT_RECONCILE_INTERVAL_MS` | `300000` (5 min) | `180000` (3 min) | optional |

## Flow

1. `POST /api/store/buy` → creates `PaymentTransaction` (PENDING) → Zibal `/v1/request`
2. User redirected to `https://gateway.zibal.ir/start/{trackId}`
3. Callback `GET /api/store/gateway/callback` — **does not trust success flag**
4. Server verifies via Zibal `/v1/verify` → status `PAID` → coins granted
5. Reconciliation scheduler polls open transactions every 5 minutes

## Health check

```bash
curl -H "Authorization: Bearer $KANDAKATOR_SYNC_PUSH_TOKEN" \
  https://bordin.ir/api/internal/payment/health
```

## Database migration

After deploy, run `npm run db:push` on both environments.

New fields on `payment_transactions`:
- `amountRials`, `merchantId`, `zibalTrackId`, `zibalRefNumber`
- `callbackPayload`, `verificationResponse`, `paymentMethod`

Status enum: `PENDING | PROCESSING | UNKNOWN | PAID | FAILED`
