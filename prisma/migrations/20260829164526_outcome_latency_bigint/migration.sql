/*
  Warnings:

  - You are about to alter the column `amountRecovered` on the `Outcome` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Outcome" ALTER COLUMN "amountRecovered" SET DATA TYPE INTEGER,
ALTER COLUMN "recoveryLatencyMs" SET DATA TYPE BIGINT;
