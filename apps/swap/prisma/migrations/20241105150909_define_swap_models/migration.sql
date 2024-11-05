-- CreateEnum
CREATE TYPE "SwapTransactionState" AS ENUM ('PENDING', 'PROCESSING', 'FAILED', 'COMPLETE', 'RETRY');

-- CreateTable
CREATE TABLE "MpesaOnrampSwap" (
    "id" TEXT NOT NULL,
    "state" "SwapTransactionState" NOT NULL,
    "reference" TEXT NOT NULL,
    "lightning" TEXT NOT NULL,
    "collectionTracker" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "amountSats" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaOnrampSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpesaOfframpSwap" (
    "id" TEXT NOT NULL,
    "state" "SwapTransactionState" NOT NULL,
    "reference" TEXT NOT NULL,
    "lightning" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "paymentTracker" TEXT,
    "rate" TEXT NOT NULL,
    "amountSats" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaOfframpSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MpesaOnrampSwap_collectionTracker_key" ON "MpesaOnrampSwap"("collectionTracker");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaOfframpSwap_paymentTracker_key" ON "MpesaOfframpSwap"("paymentTracker");
