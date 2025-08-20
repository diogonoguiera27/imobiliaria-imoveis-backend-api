-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE INDEX "Property_cidade_idx" ON "Property"("cidade");

-- CreateIndex
CREATE INDEX "Property_userId_idx" ON "Property"("userId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
