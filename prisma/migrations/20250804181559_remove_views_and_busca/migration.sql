/*
  Warnings:

  - You are about to drop the `Busca` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PropertyView` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PropertyView" DROP CONSTRAINT "PropertyView_propertyId_fkey";

-- DropTable
DROP TABLE "Busca";

-- DropTable
DROP TABLE "PropertyView";
