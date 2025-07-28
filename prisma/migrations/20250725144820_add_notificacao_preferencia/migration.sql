-- CreateTable
CREATE TABLE "NotificacaoPreferencia" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "porEmail" BOOLEAN NOT NULL DEFAULT true,
    "porPush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacaoPreferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacaoPreferencia_userId_tipo_key" ON "NotificacaoPreferencia"("userId", "tipo");

-- AddForeignKey
ALTER TABLE "NotificacaoPreferencia" ADD CONSTRAINT "NotificacaoPreferencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
