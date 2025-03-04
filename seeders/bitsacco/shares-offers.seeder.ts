import { SharesOffer } from './types';
import { generateId, randomDateString } from '../utils';

/**
 * Seed shares offers
 * @returns Array of seeded shares offers
 */
export async function seedSharesOffers(): Promise<SharesOffer[]> {
  // Define date ranges for offers
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  const currentDate = new Date();
  const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days in future

  const sharesOffers: SharesOffer[] = [
    // Past offer (closed)
    {
      id: generateId(),
      quantity: 1000,
      subscribed_quantity: 1000, // Fully subscribed
      available_from: randomDateString(
        startDate,
        new Date(startDate.getTime() + 15 * 24 * 60 * 60 * 1000),
      ),
      available_to: randomDateString(
        new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        new Date(startDate.getTime() + 45 * 24 * 60 * 60 * 1000),
      ),
      created_at: randomDateString(
        startDate,
        new Date(startDate.getTime() + 15 * 24 * 60 * 60 * 1000),
      ),
      updated_at: randomDateString(
        new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        new Date(startDate.getTime() + 45 * 24 * 60 * 60 * 1000),
      ),
    },

    // Current active offer
    {
      id: generateId(),
      quantity: 500,
      subscribed_quantity: 200, // Partially subscribed
      available_from: randomDateString(
        new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
        currentDate,
      ),
      available_to: randomDateString(
        futureDate,
        new Date(futureDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      ),
      created_at: randomDateString(
        new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
        currentDate,
      ),
      updated_at: randomDateString(
        currentDate,
        new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000),
      ),
    },

    // Future offer
    {
      id: generateId(),
      quantity: 2000,
      subscribed_quantity: 0, // Not yet subscribed
      available_from: randomDateString(
        new Date(futureDate.getTime() - 15 * 24 * 60 * 60 * 1000),
        futureDate,
      ),
      available_to: randomDateString(
        futureDate,
        new Date(futureDate.getTime() + 60 * 24 * 60 * 60 * 1000),
      ),
      created_at: randomDateString(
        currentDate,
        new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      ),
      updated_at: undefined,
    },
  ];

  // Create seed database records
  // This is where you would normally insert these records into your database
  // For now, we just return the generated offers

  return sharesOffers;
}
