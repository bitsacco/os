-- CreateTable
CREATE TABLE "MpesaOfframpSwap" (
    "id" TEXT NOT NULL,
    "state" "SwapTransactionState" NOT NULL,
    "userId" TEXT NOT NULL,
    "mpesaId" TEXT,
    "lightning" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaOfframpSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MpesaOfframpSwap_mpesaId_key" ON "MpesaOfframpSwap"("mpesaId");
