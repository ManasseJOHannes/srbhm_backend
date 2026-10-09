-- CreateTable
CREATE TABLE "public"."Article" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "unite" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompteMatiere" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteMatiere_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_reference_key" ON "public"."Article"("reference");

-- CreateIndex
CREATE INDEX "CompteMatiere_exerciceId_idx" ON "public"."CompteMatiere"("exerciceId");

-- CreateIndex
CREATE INDEX "CompteMatiere_articleId_idx" ON "public"."CompteMatiere"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "CompteMatiere_exerciceId_articleId_key" ON "public"."CompteMatiere"("exerciceId", "articleId");

-- AddForeignKey
ALTER TABLE "public"."CompteMatiere" ADD CONSTRAINT "CompteMatiere_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "public"."Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompteMatiere" ADD CONSTRAINT "CompteMatiere_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
