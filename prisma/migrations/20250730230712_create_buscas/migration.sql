-- CreateTable
CREATE TABLE "Busca" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "cidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Busca_pkey" PRIMARY KEY ("id")
);
