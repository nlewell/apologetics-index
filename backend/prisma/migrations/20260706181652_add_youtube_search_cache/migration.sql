-- CreateTable
CREATE TABLE "YoutubeSearchCache" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeSearchCache_query_key" ON "YoutubeSearchCache"("query");
