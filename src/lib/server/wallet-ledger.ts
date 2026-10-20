/**
 * Server-only wallet write boundary. This module is intentionally NOT wired
 * to public routes; authentication and request-scoped identity are P1 gates.
 *
 * Amounts are integer centi-mandays (100 units = 1.00 MD). D1 AFTER INSERT
 * trigger updates balances atomically and rejects overdrafts/duplicates.
 */
type Statement<Row = Record<string, unknown>> = {
  bind(...values: (string | number)[]): Statement<Row>;
  first(): Promise<Row | null>;
  run(): Promise<{ success: boolean }>;
};

export interface WalletDB {
  prepare<Row = Record<string, unknown>>(query: string): Statement<Row>;
}

export type WalletMovementType = 'ISSUANCE' | 'TOPUP' | 'RESERVE' | 'RELEASE' | 'DEBIT';

export interface VerifiedWalletActor {
  /** Server-verified user/tenant identity, never client-submitted identifiers. */
  tenantId: string;
  userId: string;
}

export interface WalletMovement {
  walletId: string;
  type: WalletMovementType;
  amountUnits: number;
  idempotencyKey: string;
  referenceCode: string;
  scope?: string;
}

type RoleRow = { role: string; active: number };
const permissions: Record<WalletMovementType, string[]> = {
  ISSUANCE: ['finance'],
  TOPUP: ['finance'],
  RESERVE: ['pre_sales', 'project_manager'],
  RELEASE: ['project_manager'],
  // Requires approved BAST, DoA and SoD workflow before public API activation.
  DEBIT: [],
};

export class WalletLedgerError extends Error {
  constructor(public code: 'FORBIDDEN' | 'INVALID' | 'CONFLICT' | 'UNAVAILABLE') {
    super(code);
  }
}

export async function recordWalletMovement(
  db: WalletDB,
  actor: VerifiedWalletActor,
  movement: WalletMovement
): Promise<{ transactionId: string }> {
  if (!actor.tenantId || !actor.userId) throw new WalletLedgerError('FORBIDDEN');

  if (
    !Object.prototype.hasOwnProperty.call(permissions, movement.type) ||
    !movement.walletId || !movement.referenceCode?.trim() ||
    !movement.idempotencyKey ||
    movement.idempotencyKey.length < 8 ||
    movement.idempotencyKey.length > 128 ||
    !Number.isSafeInteger(movement.amountUnits) ||
    movement.amountUnits <= 0 ||
    movement.amountUnits > 1_000_000_000
  ) {
    throw new WalletLedgerError('INVALID');
  }

  const user = await db.prepare<RoleRow>(
    'SELECT role, active FROM users WHERE id = ? AND tenant_id = ?'
  ).bind(actor.userId, actor.tenantId).first();

  if (!user || user.active !== 1 || !permissions[movement.type].includes(user.role)) {
    throw new WalletLedgerError('FORBIDDEN');
  }

  const transactionId = crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO wallet_transactions
        (id, tenant_id, wallet_id, idempotency_key, tx_type, amount_units,
         reference_code, performed_by, service_scope)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      transactionId, actor.tenantId, movement.walletId,
      movement.idempotencyKey, movement.type, movement.amountUnits,
      movement.referenceCode.trim(), actor.userId, movement.scope || ''
    ).run();
  } catch (err) {
    const error = String(err);
    if (/UNIQUE constraint|insufficient_|wallet_expired|FOREIGN KEY/i.test(error)) {
      throw new WalletLedgerError('CONFLICT');
    }
    throw new WalletLedgerError('UNAVAILABLE');
  }

  return { transactionId };
}
