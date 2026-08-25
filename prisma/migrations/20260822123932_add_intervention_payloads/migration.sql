-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN     "executionPayload" JSONB,
ADD COLUMN     "reversalPayload" JSONB;
