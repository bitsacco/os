import { seedUsers } from './users.seeder';
import { seedSharesOffers } from './shares-offers.seeder';
import { seedUserShares } from './user-shares.seeder';
import { seedChamas } from './chamas.seeder';
import { seedChamaWalletTransactions } from './chama-transactions.seeder';
import { seedSolowalletTransactions } from './solowallet-transactions.seeder';
import {
  connectToDatabase,
  closeDatabaseConnection,
  clearCollections,
  registerSchemas,
  getModels,
} from './db';
import { Logger } from '@nestjs/common';

// Create a logger for the seeders
const logger = new Logger('Seeders');

/**
 * Main seeder function that orchestrates seeding all entities
 */
export async function seed() {
  logger.log('Starting database seeding...');

  try {
    // Connect to database
    await connectToDatabase();

    // Register schemas from the apps
    await registerSchemas();

    // Get the models
    const { User, SharesOffer, SharesTx, Chama, ChamaWalletTx, SolowalletTx } =
      getModels();

    // Step 1: Create users
    const users = await seedUsers();
    logger.log(`Generated ${users.length} users`);

    // Save users to database
    await User.insertMany(
      users.map((user) => ({
        _id: user.id,
        pinHash: user.pinHash,
        otpHash: user.otpHash, // Add the required otpHash field
        otpExpiry: user.otpExpiry, // Add the required otpExpiry field
        phone: user.phone,
        nostr: user.nostr,
        profile: user.profile,
        roles: user.roles,
      })),
    );
    logger.log(`Saved ${users.length} users to database`);

    // Step 2: Create share offers
    const shareOffers = await seedSharesOffers();
    logger.log(`Generated ${shareOffers.length} share offers`);

    // Save share offers to database
    await SharesOffer.insertMany(
      shareOffers.map((offer) => ({
        _id: offer.id,
        quantity: offer.quantity,
        subscribedQuantity: offer.subscribed_quantity, // Field name adjusted to match schema
        availableFrom: new Date(offer.available_from), // Field name adjusted to match schema
        availableTo: offer.available_to
          ? new Date(offer.available_to)
          : undefined, // Field name adjusted to match schema
        createdAt: new Date(offer.created_at),
        updatedAt: offer.updated_at ? new Date(offer.updated_at) : undefined,
      })),
    );
    logger.log(`Saved ${shareOffers.length} share offers to database`);

    // Step 3: Subscribe users to shares
    const userShares = await seedUserShares(users, shareOffers);
    logger.log(`Generated ${userShares.length} user share transactions`);

    // Save user shares to database
    await SharesTx.insertMany(
      userShares.map((tx) => ({
        _id: tx.id,
        userId: tx.user_id, // Field name adjusted to match schema
        offerId: tx.offer_id, // Field name adjusted to match schema
        quantity: tx.quantity,
        status: tx.status,
        transfer: tx.transfer,
        createdAt: new Date(tx.created_at),
        updatedAt: tx.updated_at ? new Date(tx.updated_at) : undefined,
      })),
    );
    logger.log(
      `Saved ${userShares.length} user share transactions to database`,
    );

    // Step 4: Create chamas and assign members
    const chamas = await seedChamas(users);
    logger.log(`Generated ${chamas.length} chamas`);

    // Save chamas to database
    await Chama.insertMany(
      chamas.map((chama) => ({
        _id: chama.id,
        name: chama.name,
        description: chama.description,
        members: chama.members.map((member) => ({
          userId: member.user_id, // Field name adjusted to match schema
          roles: member.roles,
        })),
        createdBy: chama.created_by, // Field name adjusted to match schema
      })),
    );
    logger.log(`Saved ${chamas.length} chamas to database`);

    // Step 5: Create chama wallet transactions
    const chamaTransactions = await seedChamaWalletTransactions(users, chamas);
    logger.log(
      `Generated ${chamaTransactions.length} chama wallet transactions`,
    );

    // Save chama wallet transactions to database
    await ChamaWalletTx.insertMany(
      chamaTransactions.map((tx) => ({
        _id: tx.id,
        memberId: tx.member_id, // Field name adjusted to match schema
        chamaId: tx.chama_id, // Field name adjusted to match schema
        status: tx.status,
        amountMsats: tx.amount_msats, // Field name adjusted to match schema
        amountFiat: tx.amount_fiat, // Field name adjusted to match schema
        lightning: JSON.stringify(tx.lightning), // Convert to string as required by schema
        type: tx.type,
        reviews: tx.reviews.map((review) => ({
          member_id: review.member_id,
          review: review.review,
        })),
        reference: tx.reference,
        paymentTracker: `tracker_${tx.id}`, // Required by schema
        createdAt: new Date(tx.createdAt),
        updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : undefined,
      })),
    );
    logger.log(
      `Saved ${chamaTransactions.length} chama wallet transactions to database`,
    );

    // Step 6: Create solowallet transactions for users with shares
    const solowalletTransactions = await seedSolowalletTransactions(
      users,
      userShares,
    );
    logger.log(
      `Generated ${solowalletTransactions.length} solowallet transactions`,
    );

    // Save solowallet transactions to database
    await SolowalletTx.insertMany(
      solowalletTransactions.map((tx) => ({
        _id: tx.id,
        userId: tx.user_id, // Field name adjusted to match schema
        status: tx.status,
        amountMsats: tx.amount_msats, // Field name adjusted to match schema
        amountFiat: tx.amount_fiat, // Field name adjusted to match schema
        lightning: JSON.stringify(tx.lightning), // Convert to string as required by schema
        type: tx.type,
        reference: tx.reference,
        paymentTracker: `tracker_${tx.id}`, // Required by schema
        createdAt: new Date(tx.createdAt),
        updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : undefined,
      })),
    );
    logger.log(
      `Saved ${solowalletTransactions.length} solowallet transactions to database`,
    );

    logger.log('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error during database seeding:', error);
    throw error;
  } finally {
    // Close database connection
    await closeDatabaseConnection();
  }
}

/**
 * Clean function to remove all seeded data
 */
export async function clean() {
  logger.log('Cleaning seeded data from database...');

  try {
    // Connect to database
    await connectToDatabase();

    // Register schemas
    await registerSchemas();

    // Clear all collections
    await clearCollections();

    logger.log('Database cleaning completed successfully!');
  } catch (error) {
    logger.error('Error during database cleaning:', error);
    throw error;
  } finally {
    // Close database connection
    await closeDatabaseConnection();
  }
}
