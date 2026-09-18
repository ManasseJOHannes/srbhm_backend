-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."UserRequest" (
    "id" SERIAL NOT NULL,
    "imatricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRequest_pkey" PRIMARY KEY ("id")
);
