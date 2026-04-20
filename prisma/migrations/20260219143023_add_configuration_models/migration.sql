-- AlterTable
ALTER TABLE "Professionnel" ADD COLUMN     "adresseCabinet" TEXT;

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "personnalise" BOOLEAN NOT NULL DEFAULT false,
    "professionnelId" TEXT NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disponibilite" (
    "id" TEXT NOT NULL,
    "jourDebut" TEXT NOT NULL,
    "jourFin" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "professionnelId" TEXT NOT NULL,

    CONSTRAINT "Disponibilite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendrierSync" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "professionnelId" TEXT NOT NULL,

    CONSTRAINT "CalendrierSync_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disponibilite" ADD CONSTRAINT "Disponibilite_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendrierSync" ADD CONSTRAINT "CalendrierSync_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
