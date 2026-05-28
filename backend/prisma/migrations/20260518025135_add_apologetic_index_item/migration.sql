-- CreateTable
CREATE TABLE "public"."ApologeticIndexItem" (
    "id" SERIAL NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "generalTopic" TEXT,
    "subtopic" TEXT,
    "charge" TEXT,
    "shortResponseUrl" TEXT,
    "video1Length" TEXT,
    "video1Author" TEXT,
    "video1Timestamp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApologeticIndexItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApologeticIndexItem_sourceKey_key" ON "public"."ApologeticIndexItem"("sourceKey");
