CREATE TABLE "YoutubeQueryInsightCache" (
  "id" SERIAL NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "topicQuery" TEXT NOT NULL,
  "insight" JSONB NOT NULL,
  "bestUrl" TEXT,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "YoutubeQueryInsightCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubeQueryInsightCache_cacheKey_key" ON "YoutubeQueryInsightCache"("cacheKey");
CREATE INDEX "YoutubeQueryInsightCache_topicQuery_idx" ON "YoutubeQueryInsightCache"("topicQuery");
CREATE INDEX "YoutubeQueryInsightCache_refreshedAt_idx" ON "YoutubeQueryInsightCache"("refreshedAt");