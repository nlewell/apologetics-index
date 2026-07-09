-- CreateTable
CREATE TABLE "YoutubeVideoIndex" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeVideoIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideoIndex_query_key" ON "YoutubeVideoIndex"("query");
