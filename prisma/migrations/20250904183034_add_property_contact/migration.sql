-- CreateTable
CREATE TABLE "PropertyContact" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "nome" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "mensagem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyContact_propertyId_idx" ON "PropertyContact"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyContact_userId_idx" ON "PropertyContact"("userId");

-- AddForeignKey
ALTER TABLE "PropertyContact" ADD CONSTRAINT "PropertyContact_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyContact" ADD CONSTRAINT "PropertyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
