-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'ORDONNATEUR', 'COMPTABLE', 'DEPOSITEUR-COMPTABLE', 'USER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "imatricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "adresse" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_imatricule_key" ON "public"."User"("imatricule");

-- CreateIndex
CREATE UNIQUE INDEX "User_cin_key" ON "public"."User"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "User_telephone_key" ON "public"."User"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
