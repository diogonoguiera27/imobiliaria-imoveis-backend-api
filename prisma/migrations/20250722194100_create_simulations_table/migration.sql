-- CreateTable
CREATE TABLE "Simulation" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentValue" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
