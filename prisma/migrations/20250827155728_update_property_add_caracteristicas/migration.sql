/*
  Warnings:

  - You are about to drop the column `infoExtra` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "infoExtra",
ADD COLUMN     "caracteristicas" TEXT[] DEFAULT ARRAY[]::TEXT[];
