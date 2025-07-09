/*
  Warnings:

  - You are about to drop the column `address` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `bathrooms` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `bedrooms` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `builtArea` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `condoFee` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `extraInfo` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `nearby` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `parkingSpots` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerSqM` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `propertyTax` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `totalArea` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Property` table. All the data in the column will be lost.
  - Added the required column `bairro` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `banheiros` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoria` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cidade` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endereco` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imagem` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metragem` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preco` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quartos` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoNegocio` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vagas` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "address",
DROP COLUMN "bathrooms",
DROP COLUMN "bedrooms",
DROP COLUMN "builtArea",
DROP COLUMN "city",
DROP COLUMN "condoFee",
DROP COLUMN "description",
DROP COLUMN "extraInfo",
DROP COLUMN "floor",
DROP COLUMN "image",
DROP COLUMN "nearby",
DROP COLUMN "parkingSpots",
DROP COLUMN "price",
DROP COLUMN "pricePerSqM",
DROP COLUMN "propertyTax",
DROP COLUMN "title",
DROP COLUMN "totalArea",
DROP COLUMN "type",
ADD COLUMN     "areaConstruida" INTEGER,
ADD COLUMN     "bairro" TEXT NOT NULL,
ADD COLUMN     "banheiros" INTEGER NOT NULL,
ADD COLUMN     "categoria" TEXT NOT NULL,
ADD COLUMN     "cidade" TEXT NOT NULL,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "endereco" TEXT NOT NULL,
ADD COLUMN     "imagem" TEXT NOT NULL,
ADD COLUMN     "infoExtra" TEXT,
ADD COLUMN     "metragem" INTEGER NOT NULL,
ADD COLUMN     "preco" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quartos" INTEGER NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "tipoNegocio" TEXT NOT NULL,
ADD COLUMN     "vagas" INTEGER NOT NULL;
