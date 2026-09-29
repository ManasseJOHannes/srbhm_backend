/*
  Warnings:

  - Changed the type of `role` on the `UserRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."UserRequest" DROP COLUMN "role",
ADD COLUMN     "role" "public"."Role" NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;
