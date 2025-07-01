-- CreateTable
CREATE TABLE "Property" (
    "id" SERIAL NOT NULL,
    "image" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "totalArea" INTEGER NOT NULL,
    "builtArea" INTEGER,
    "bedrooms" INTEGER NOT NULL,
    "suites" INTEGER,
    "bathrooms" INTEGER NOT NULL,
    "parkingSpots" INTEGER NOT NULL,
    "price" TEXT NOT NULL,
    "pricePerSqM" TEXT,
    "condoFee" TEXT,
    "propertyTax" TEXT,
    "floor" TEXT,
    "extraInfo" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);
