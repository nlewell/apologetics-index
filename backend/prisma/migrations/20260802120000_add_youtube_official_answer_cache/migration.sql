CREATE TABLE "YoutubeOfficialAnswerCache" (
  "id" SERIAL NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "topicQuery" TEXT NOT NULL,
  "answer" JSONB NOT NULL,
  "matchedUrl" TEXT,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "YoutubeOfficialAnswerCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubeOfficialAnswerCache_cacheKey_key" ON "YoutubeOfficialAnswerCache"("cacheKey");
CREATE INDEX "YoutubeOfficialAnswerCache_videoId_idx" ON "YoutubeOfficialAnswerCache"("videoId");
CREATE INDEX "YoutubeOfficialAnswerCache_topicQuery_idx" ON "YoutubeOfficialAnswerCache"("topicQuery");
CREATE INDEX "YoutubeOfficialAnswerCache_refreshedAt_idx" ON "YoutubeOfficialAnswerCache"("refreshedAt");