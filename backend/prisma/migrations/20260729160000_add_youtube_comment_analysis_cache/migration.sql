CREATE TABLE "YoutubeCommentAnalysisCache" (
  "id" SERIAL NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "authorChannelId" TEXT,
  "maxComments" INTEGER NOT NULL,
  "analysis" JSONB NOT NULL,
  "analyzedComments" INTEGER NOT NULL DEFAULT 0,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "YoutubeCommentAnalysisCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubeCommentAnalysisCache_cacheKey_key" ON "YoutubeCommentAnalysisCache"("cacheKey");
CREATE INDEX "YoutubeCommentAnalysisCache_videoId_idx" ON "YoutubeCommentAnalysisCache"("videoId");
CREATE INDEX "YoutubeCommentAnalysisCache_refreshedAt_idx" ON "YoutubeCommentAnalysisCache"("refreshedAt");
