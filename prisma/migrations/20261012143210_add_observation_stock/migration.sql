-- CreateTable
CREATE TABLE "public"."ObservationStock" (
    "id" SERIAL NOT NULL,
    "lotStockId" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObservationStock_lotStockId_idx" ON "public"."ObservationStock"("lotStockId");

-- AddForeignKey
ALTER TABLE "public"."ObservationStock" ADD CONSTRAINT "ObservationStock_lotStockId_fkey" FOREIGN KEY ("lotStockId") REFERENCES "public"."LotStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
