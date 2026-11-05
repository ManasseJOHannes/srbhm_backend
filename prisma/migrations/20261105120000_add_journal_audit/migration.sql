-- CreateTable
CREATE TABLE "public"."JournalAudit" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT,
    "entiteId" INTEGER,
    "auteurId" INTEGER,
    "auteurNom" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalAudit_createdAt_idx" ON "public"."JournalAudit"("createdAt");

-- CreateIndex
CREATE INDEX "JournalAudit_action_idx" ON "public"."JournalAudit"("action");

-- CreateIndex
CREATE INDEX "JournalAudit_auteurId_idx" ON "public"."JournalAudit"("auteurId");

-- AddForeignKey
ALTER TABLE "public"."JournalAudit" ADD CONSTRAINT "JournalAudit_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
