# Bitsacco OS Database Seeders

This directory contains scripts to seed the Bitsacco OS database with test data.

## Structure

The seeders are organized by entity type:

- bitsacco
  - `users.seeder.ts` - Seeds user accounts
  - `shares-offers.seeder.ts` - Seeds share offers
  - `user-shares.seeder.ts` - Seeds user share subscriptions
  - `chamas.seeder.ts` - Seeds chamas and memberships
  - `chama-transactions.seeder.ts` - Seeds chama wallet transactions
  - `solowallet-transactions.seeder.ts` - Seeds solowallet transactions
  - `types.ts` - Common type definitions
  - `db.ts` - Database connection and schema management

Common utilities and types are in:

- `utils.ts` - Helper functions

## Usage

The seeders can be run directly from the command line using the following npm scripts:

```bash
# Seed the database with test data
bun bitsacco:seed
bun featbit:seed

# Clean seeded data from the database
bun bitsacco:clean
bun featbit:clean
```

## Seeded Data

The seeders create the following data:

- **Users**: 7 users with different roles and identifiers (with login credentials)
- **Share Offers**: 3 offers (past, current, and future)
- **User Share Transactions**: Multiple users subscribe to shares
- **Chamas**: 3 chamas with different membership configurations
- **Chama Transactions**: Various deposit and withdrawal transactions for each chama
- **Solowallet Transactions**: Multiple deposits and withdrawals for users with share subscriptions

### Preconfigured Users for Testing

The seeder creates users with predefined PINs that can be used to log in and test the application:

| User Type         | Phone Number | PIN    | Roles                     |
| ----------------- | ------------ | ------ | ------------------------- |
| Super Admin       | 254708083339 | 000000 | Member, Admin, SuperAdmin |
| Phone Admin       | 254703291347 | 111111 | Member, Admin             |
| Nostr Admin       | (npub only)  | 222222 | Member, Admin             |
| Phone Member      | 254702345678 | 333333 | Member                    |
| Nostr Member      | (npub only)  | 444444 | Member                    |
| Complete Member   | 254703456789 | 555555 | Member                    |
| Unverified Member | 254704567890 | 666666 | Member                    |

When the seeder is run, you can view the terminal output for the full user details including npub values that are randomly generated.

## Relationships

The seeders maintain the following relationships:

- Most users have subscribed to at least one share offer
- All users with share subscriptions have solowallet transactions
- All users belong to at least one chama
- Each chama has a unique set of members
- All chamas have at least one admin
- Various chama deposit and withdrawal transactions exist, including completed, pending, and rejected ones

## Database Connection and Schema Reuse

The seeder scripts reuse the actual MongoDB schemas from the respective apps rather than defining duplicate schemas:

1. The `db.ts` file dynamically imports schema definitions from:

   - `libs/common/src/database/users.schema.ts`
   - `apps/shares/src/db/shares.schema.ts`
   - `apps/chama/src/chamas/db/chamas.schema.ts`
   - `apps/chama/src/wallet/db/wallet.schema.ts`
   - `apps/solowallet/src/db/solowallet.schema.ts`

2. The process follows these steps:

   - Reads environment files to extract `DATABASE_URL`
   - Connects to MongoDB database
   - Imports and registers schemas from the app modules
   - Creates and inserts seed data using the actual app schema models
   - Closes database connection after completion

3. The seeder respects the collection naming convention used in the codebase, where collections have a "documents" suffix:
   - `usersdocuments` instead of `users`
   - `sharesofferdocuments` instead of `sharesoffers`
   - `sharesdocuments` instead of `sharestxes`
   - And so on...

When cleaning data, it:

1. Connects to MongoDB database
2. Registers the same app schemas
3. Clears all collections used by the seeders
4. Also cleans up any non-standard collections that might have been created by earlier runs
5. Closes database connection after completion

## Field Name Mapping

Since the proto files and MongoDB schemas might use different field naming conventions, the seeder handles the mapping between them:

- Proto style: `user_id`, `offer_id`, `amount_msats`
- MongoDB schema style: `userId`, `offerId`, `amountMsats`

The seeder transforms field names as needed when persisting data to MongoDB, ensuring compatibility with the app's actual database models.
