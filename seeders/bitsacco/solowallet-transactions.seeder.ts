import {
  User,
  SharesTx,
  SolowalletTx,
  TransactionStatus,
  TransactionType,
} from './types';
import {
  generateId,
  randomDateString,
  randomAmountKES,
  kesToMsats,
  generateLightningInvoice,
  generateReference,
} from '../utils';

/**
 * Seed solowallet transactions
 * @param users Array of users to create transactions for
 * @param userShares Array of user share transactions (to determine which users should have solowallet transactions)
 * @returns Array of seeded solowallet transactions
 */
export async function seedSolowalletTransactions(
  users: User[],
  userShares: SharesTx[],
): Promise<SolowalletTx[]> {
  const transactions: SolowalletTx[] = [];
  const currentDate = new Date();
  const pastDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  // Get unique user IDs from share transactions
  const shareUserIds = [...new Set(userShares.map((share) => share.user_id))];

  // Create solowallet transactions for users with shares
  shareUserIds.forEach((userId) => {
    // Create 2-5 deposit transactions per user
    const numDeposits = 2 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numDeposits; i++) {
      const amountKES = randomAmountKES(500, 5000);
      const createDate = randomDateString(
        pastDate,
        new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000),
      );

      const updateDate = randomDateString(
        new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
        new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000),
      );

      // Most transactions are complete
      const status =
        Math.random() < 0.9
          ? TransactionStatus.COMPLETE
          : Math.random() < 0.5
            ? TransactionStatus.PENDING
            : TransactionStatus.PROCESSING;

      transactions.push({
        id: generateId(),
        user_id: userId,
        status,
        amount_msats: kesToMsats(amountKES),
        amount_fiat: amountKES,
        lightning: {
          invoice: generateLightningInvoice(),
        },
        type: TransactionType.DEPOSIT,
        reference: generateReference(TransactionType.DEPOSIT),
        createdAt: createDate,
        updatedAt:
          status === TransactionStatus.COMPLETE ? updateDate : undefined,
      });
    }

    // Create 1-3 withdrawal transactions per user
    const numWithdrawals = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numWithdrawals; i++) {
      const amountKES = randomAmountKES(300, 3000);
      const createDate = randomDateString(
        new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        currentDate,
      );

      const updateDate = randomDateString(
        new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
        currentDate,
      );

      // Most transactions are complete
      const status =
        Math.random() < 0.8
          ? TransactionStatus.COMPLETE
          : Math.random() < 0.5
            ? TransactionStatus.PENDING
            : TransactionStatus.PROCESSING;

      transactions.push({
        id: generateId(),
        user_id: userId,
        status,
        amount_msats: kesToMsats(amountKES),
        amount_fiat: amountKES,
        lightning: {
          invoice: generateLightningInvoice(),
        },
        type: TransactionType.WITHDRAW,
        reference: generateReference(TransactionType.WITHDRAW),
        createdAt: createDate,
        updatedAt:
          status === TransactionStatus.COMPLETE ? updateDate : undefined,
      });
    }

    // Add a failed transaction for some users
    if (Math.random() < 0.3) {
      const amountKES = randomAmountKES(1000, 10000);
      const createDate = randomDateString(
        new Date(pastDate.getTime() + 45 * 24 * 60 * 60 * 1000),
        new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
      );

      const updateDate = randomDateString(
        new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
        new Date(currentDate.getTime() - 19 * 24 * 60 * 60 * 1000),
      );

      transactions.push({
        id: generateId(),
        user_id: userId,
        status: TransactionStatus.FAILED,
        amount_msats: kesToMsats(amountKES),
        amount_fiat: amountKES,
        lightning: {
          invoice: generateLightningInvoice(),
        },
        type:
          Math.random() < 0.5
            ? TransactionType.DEPOSIT
            : TransactionType.WITHDRAW,
        reference: generateReference(
          Math.random() < 0.5
            ? TransactionType.DEPOSIT
            : TransactionType.WITHDRAW,
        ),
        createdAt: createDate,
        updatedAt: updateDate,
      });
    }
  });

  // Create seed database records
  // This is where you would normally insert these records into your database
  // For now, we just return the generated transactions

  return transactions;
}
