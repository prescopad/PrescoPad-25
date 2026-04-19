import { query, queryOne, transaction } from '../config/database';
import { AppError } from '../middleware/errorHandler';

interface WalletData {
  id: string;
  user_id: string;
  balance: string;
  auto_refill: boolean;
  auto_refill_amount: string;
  auto_refill_threshold: string;
}

interface TransactionData {
  id: string;
  wallet_id: string;
  type: string;
  amount: string;
  description: string;
  reference_id: string;
  created_at: string;
}

export async function getWallet(userId: string): Promise<WalletData> {
  const wallet = await queryOne<WalletData>(
    `SELECT * FROM wallets WHERE user_id = $1`,
    [userId]
  );

  if (!wallet) {
    throw new AppError('Wallet not found', 404);
  }

  return wallet;
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await getWallet(userId);
  return parseFloat(wallet.balance);
}

export async function rechargeWallet(
  userId: string,
  amount: number,
  description = 'Wallet Recharge'
): Promise<{ balance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400);
  }

  return transaction(async (client) => {
    // Lock wallet row for update
    const walletResult = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError('Wallet not found', 404);
    }

    const wallet = walletResult.rows[0];
    const newBalance = parseFloat(wallet.balance) + amount;

    // Update balance
    await client.query(
      `UPDATE wallets SET balance = $1 WHERE id = $2`,
      [newBalance, wallet.id]
    );

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions (wallet_id, type, amount, description, reference_id)
       VALUES ($1, 'credit', $2, $3, $4) RETURNING id`,
      [wallet.id, amount, description, `RCH-${Date.now()}`]
    );

    return {
      balance: newBalance,
      transactionId: txResult.rows[0].id,
    };
  });
}

export async function deductFromWallet(
  userId: string,
  amount: number,
  description: string,
  referenceId: string
): Promise<{ balance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400);
  }

  return transaction(async (client) => {
    const walletResult = await client.query(
      `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError('Wallet not found', 404);
    }

    const wallet = walletResult.rows[0];
    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < amount) {
      throw new AppError('Insufficient balance', 402);
    }

    const newBalance = currentBalance - amount;

    await client.query(
      `UPDATE wallets SET balance = $1 WHERE id = $2`,
      [newBalance, wallet.id]
    );

    const txResult = await client.query(
      `INSERT INTO transactions (wallet_id, type, amount, description, reference_id)
       VALUES ($1, 'debit', $2, $3, $4) RETURNING id`,
      [wallet.id, amount, description, referenceId]
    );

    // Check auto-refill threshold
    if (wallet.auto_refill && newBalance <= parseFloat(wallet.auto_refill_threshold)) {
      // Schedule auto-refill notification
      await client.query(
        `INSERT INTO notification_jobs (user_id, type, payload, scheduled_at, status)
         VALUES ($1, 'auto_refill', $2, NOW(), 'pending')`,
        [userId, JSON.stringify({ amount: parseFloat(wallet.auto_refill_amount), currentBalance: newBalance })]
      );
    }

    return {
      balance: newBalance,
      transactionId: txResult.rows[0].id,
    };
  });
}

export async function getTransactions(
  userId: string,
  limit = 50,
  offset = 0
): Promise<TransactionData[]> {
  const wallet = await getWallet(userId);
  const rows = await query<TransactionData>(
    `SELECT * FROM transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [wallet.id, limit, offset]
  );
  return rows;
}

export async function updateAutoRefill(
  userId: string,
  autoRefill: boolean,
  autoRefillAmount?: number,
  autoRefillThreshold?: number
): Promise<void> {
  const wallet = await getWallet(userId);
  await query(
    `UPDATE wallets SET auto_refill = $1, auto_refill_amount = COALESCE($2, auto_refill_amount),
     auto_refill_threshold = COALESCE($3, auto_refill_threshold) WHERE id = $4`,
    [autoRefill, autoRefillAmount ?? null, autoRefillThreshold ?? null, wallet.id]
  );
}

export async function createWalletForUser(userId: string, initialBalance = 0): Promise<void> {
  await query(
    `INSERT INTO wallets (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [userId, initialBalance]
  );
}
