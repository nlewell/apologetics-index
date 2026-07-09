-- CreateTable
CREATE TABLE "YoutubeVideoMetadata" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "item" JSONB NOT NULL,
    "startTimestamp" TEXT,
    "keepOnRefresh" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeVideoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideoMetadata_query_videoId_key" ON "YoutubeVideoMetadata"("query", "videoId");

-- CreateIndex
CREATE INDEX "YoutubeVideoMetadata_query_idx" ON "YoutubeVideoMetadata"("query");
