/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `NotificacaoPreferencia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `PasswordReset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Property` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `PropertyContact` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `PropertyView` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Simulation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "NotificacaoPreferencia" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "PropertyContact" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "PropertyView" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN     "uuid" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "uuid" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_uuid_key" ON "Favorite"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacaoPreferencia_uuid_key" ON "NotificacaoPreferencia"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_uuid_key" ON "PasswordReset"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Property_uuid_key" ON "Property"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyContact_uuid_key" ON "PropertyContact"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyView_uuid_key" ON "PropertyView"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Simulation_uuid_key" ON "Simulation"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");
