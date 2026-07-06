-- CreateTable
CREATE TABLE "YoutubeChannelCache" (
    "id" SERIAL NOT NULL,
    "handle" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeChannelCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeChannelSearchCache" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeChannelSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeChannelCache_handle_key" ON "YoutubeChannelCache"("handle");

-- CreateIndex
CREATE INDEX "YoutubeChannelSearchCache_query_idx" ON "YoutubeChannelSearchCache"("query");

-- CreateIndex
CREATE INDEX "YoutubeChannelSearchCache_channelId_idx" ON "YoutubeChannelSearchCache"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeChannelSearchCache_query_channelId_key" ON "YoutubeChannelSearchCache"("query", "channelId");
