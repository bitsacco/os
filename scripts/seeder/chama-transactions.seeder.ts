import {
  User,
  Chama,
  ChamaWalletTx,
  ChamaTxStatus,
  TransactionType,
  ChamaTxReview,
  Review,
} from './types';
import {
  generateId,
  randomDateString,
  randomAmountKES,
  kesToMsats,
  generateLightningInvoice,
  generateReference,
  randomSelect,
} from './utils';

/**
 * Seed chama wallet transactions
 * @param users Array of users to create transactions for
 * @param chamas Array of chamas to create transactions for
 * @returns Array of seeded chama wallet transactions
 */
export async function seedChamaWalletTransactions(
  users: User[],
  chamas: Chama[],
): Promise<ChamaWalletTx[]> {
  const transactions: ChamaWalletTx[] = [];
  const currentDate = new Date();
  const pastDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  // Helper function to create a deposit transaction
  const createDepositTx = (
    memberId: string,
    chamaId: string,
    amountKES: number,
    status: ChamaTxStatus,
    createDate: string,
    updateDate?: string,
  ): ChamaWalletTx => {
    return {
      id: generateId(),
      member_id: memberId,
      chama_id: chamaId,
      status,
      amount_msats: kesToMsats(amountKES),
      amount_fiat: amountKES,
      lightning: {
        invoice: generateLightningInvoice(),
      },
      type: TransactionType.DEPOSIT,
      reviews: [],
      reference: generateReference(TransactionType.DEPOSIT),
      createdAt: createDate,
      updatedAt: updateDate,
    };
  };

  // Helper function to create a withdrawal transaction
  const createWithdrawalTx = (
    memberId: string,
    chamaId: string,
    amountKES: number,
    status: ChamaTxStatus,
    createDate: string,
    updateDate?: string,
    reviews: ChamaTxReview[] = [],
  ): ChamaWalletTx => {
    return {
      id: generateId(),
      member_id: memberId,
      chama_id: chamaId,
      status,
      amount_msats: kesToMsats(amountKES),
      amount_fiat: amountKES,
      lightning: {
        invoice: generateLightningInvoice(),
      },
      type: TransactionType.WITHDRAW,
      reviews,
      reference: generateReference(TransactionType.WITHDRAW),
      createdAt: createDate,
      updatedAt: updateDate,
    };
  };

  // Create transactions for each chama
  chamas.forEach((chama) => {
    // Get admin members for approvals
    const adminMemberIds = chama.members
      .filter((member) => member.roles.includes(1)) // ChamaMemberRole.Admin
      .map((member) => member.user_id);

    // Regular members
    const regularMemberIds = chama.members
      .filter((member) => !member.roles.includes(1)) // Not an admin
      .map((member) => member.user_id);

    // Create successful deposits for all members (multiple per member)
    chama.members.forEach((member) => {
      // 2-4 completed deposits per member
      const numDeposits = 2 + Math.floor(Math.random() * 3);

      for (let i = 0; i < numDeposits; i++) {
        const createDate = randomDateString(
          pastDate,
          new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000),
        );

        const updateDate = randomDateString(
          new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
          currentDate,
        );

        transactions.push(
          createDepositTx(
            member.user_id,
            chama.id,
            randomAmountKES(500, 5000),
            ChamaTxStatus.COMPLETE,
            createDate,
            updateDate,
          ),
        );
      }
    });

    // Create a few pending deposits
    const pendingDepositMemberIds = randomSelect(
      chama.members.map((m) => m.user_id),
      Math.min(2, chama.members.length),
    );

    pendingDepositMemberIds.forEach((memberId) => {
      const createDate = randomDateString(
        new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        currentDate,
      );

      transactions.push(
        createDepositTx(
          memberId,
          chama.id,
          randomAmountKES(500, 3000),
          ChamaTxStatus.PENDING,
          createDate,
        ),
      );
    });

    // Create successful withdrawals for some members
    const withdrawalMemberIds = randomSelect(
      regularMemberIds,
      Math.min(2, regularMemberIds.length),
    );

    withdrawalMemberIds.forEach((memberId) => {
      // Generate approvals from admins
      const approvals: ChamaTxReview[] = adminMemberIds.map((adminId) => ({
        member_id: adminId,
        review: Review.APPROVE,
      }));

      const createDate = randomDateString(
        new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
      );

      const updateDate = randomDateString(
        new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
        new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000),
      );

      transactions.push(
        createWithdrawalTx(
          memberId,
          chama.id,
          randomAmountKES(1000, 2000),
          ChamaTxStatus.COMPLETE,
          createDate,
          updateDate,
          approvals,
        ),
      );
    });

    // Create pending withdrawal request for a member
    if (regularMemberIds.length > 0) {
      const pendingWithdrawalMemberId = randomSelect(regularMemberIds, 1)[0];

      // Maybe one admin has already approved
      const partialApprovals: ChamaTxReview[] =
        adminMemberIds.length > 0
          ? [
              {
                member_id: adminMemberIds[0],
                review: Review.APPROVE,
              },
            ]
          : [];

      const createDate = randomDateString(
        new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000),
        currentDate,
      );

      transactions.push(
        createWithdrawalTx(
          pendingWithdrawalMemberId,
          chama.id,
          randomAmountKES(1000, 3000),
          ChamaTxStatus.PENDING,
          createDate,
          undefined,
          partialApprovals,
        ),
      );
    }

    // Create a rejected withdrawal
    if (regularMemberIds.length > 1) {
      const rejectedWithdrawalMemberId = randomSelect(
        regularMemberIds.filter((id) => !withdrawalMemberIds.includes(id)),
        1,
      )[0];

      if (rejectedWithdrawalMemberId) {
        // Generate rejections from admins
        const rejections: ChamaTxReview[] = adminMemberIds.map((adminId) => ({
          member_id: adminId,
          review: Review.REJECT,
        }));

        const createDate = randomDateString(
          new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
          new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
        );

        const updateDate = randomDateString(
          new Date(new Date(createDate).getTime() + 1 * 24 * 60 * 60 * 1000),
          new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000),
        );

        transactions.push(
          createWithdrawalTx(
            rejectedWithdrawalMemberId,
            chama.id,
            randomAmountKES(5000, 10000), // Higher amount that got rejected
            ChamaTxStatus.REJECTED,
            createDate,
            updateDate,
            rejections,
          ),
        );
      }
    }
  });

  // Create seed database records
  // This is where you would normally insert these records into your database
  // For now, we just return the generated transactions

  return transactions;
}
