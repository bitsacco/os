import { User, SharesOffer, SharesTx, SharesTxStatus } from './types';
import { generateId, randomDateString, randomSelect } from './utils';

/**
 * Seed user share transactions
 * @param users Array of users to assign shares to
 * @param sharesOffers Array of share offers to subscribe from
 * @returns Array of seeded share transactions
 */
export async function seedUserShares(
  users: User[],
  sharesOffers: SharesOffer[],
): Promise<SharesTx[]> {
  const currentDate = new Date();
  const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

  const userShares: SharesTx[] = [];

  // Past offer - fully subscribed
  const pastOffer = sharesOffers[0];

  // Current offer - partially subscribed
  const currentOffer = sharesOffers[1];

  // Select users to subscribe to the past offer (most users)
  const pastOfferSubscribers = randomSelect(users, 5);
  const sharesPerPastSubscriber = Math.floor(
    pastOffer.subscribed_quantity / pastOfferSubscribers.length,
  );

  pastOfferSubscribers.forEach((user) => {
    // Create completed share subscription for past offer
    userShares.push({
      id: generateId(),
      user_id: user.id,
      offer_id: pastOffer.id,
      quantity: sharesPerPastSubscriber,
      status: SharesTxStatus.COMPLETE,
      created_at: randomDateString(
        pastDate,
        new Date(pastDate.getTime() + 15 * 24 * 60 * 60 * 1000),
      ),
      updated_at: randomDateString(
        new Date(pastDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        currentDate,
      ),
    });
  });

  // Select users to subscribe to the current offer (fewer users)
  const currentOfferSubscribers = randomSelect(users, 3);

  // Distribute current shares among subscribers
  let remainingCurrentShares = currentOffer.subscribed_quantity;

  currentOfferSubscribers.forEach((user) => {
    const sharesToSubscribe = Math.min(
      Math.floor(remainingCurrentShares / currentOfferSubscribers.length) +
        Math.floor(Math.random() * 20), // Add some randomness
      remainingCurrentShares,
    );

    remainingCurrentShares -= sharesToSubscribe;

    // Create subscription for current offer
    if (sharesToSubscribe > 0) {
      userShares.push({
        id: generateId(),
        user_id: user.id,
        offer_id: currentOffer.id,
        quantity: sharesToSubscribe,
        status: SharesTxStatus.COMPLETE,
        created_at: randomDateString(
          new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
          currentDate,
        ),
        updated_at: randomDateString(
          new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          currentDate,
        ),
      });
    }
  });

  // Add a few pending/processing transactions
  const pendingUser = randomSelect(
    users.filter((u) => !currentOfferSubscribers.includes(u)),
    1,
  )[0];

  userShares.push({
    id: generateId(),
    user_id: pendingUser.id,
    offer_id: currentOffer.id,
    quantity: 10,
    status: SharesTxStatus.PROCESSING,
    created_at: randomDateString(
      new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      currentDate,
    ),
    updated_at: undefined,
  });

  // Add a transfer transaction between users
  const fromUser = pastOfferSubscribers[0];
  const toUser =
    users.find((u) => !pastOfferSubscribers.includes(u)) ||
    users[users.length - 1];

  const transferTx: SharesTx = {
    id: generateId(),
    user_id: toUser.id,
    offer_id: pastOffer.id,
    quantity: 10,
    status: SharesTxStatus.COMPLETE,
    transfer: {
      from_user_id: fromUser.id,
      to_user_id: toUser.id,
      quantity: 10,
    },
    created_at: randomDateString(
      new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
    ),
    updated_at: randomDateString(
      new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
      new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
    ),
  };

  userShares.push(transferTx);

  // Create seed database records
  // This is where you would normally insert these records into your database
  // For now, we just return the generated user shares

  return userShares;
}
