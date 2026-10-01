/*
  Warnings:

  - You are about to drop the column `service` on the `User` table. All the data in the column will be lost.
  - Added the required column `soaId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `soaId` to the `UserRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "service",
ADD COLUMN     "soaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."UserRequest" ADD COLUMN     "soaId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "public"."soas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRequest" ADD CONSTRAINT "UserRequest_soaId_fkey" FOREIGN KEY ("soaId") REFERENCES "public"."soas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
