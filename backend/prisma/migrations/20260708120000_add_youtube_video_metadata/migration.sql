-- CreateTable
CREATE TABLE "YoutubeVideoMetadata" (
    "id" SERIAL NOT NULL,
    "videoId" TEXT NOT NULL,
    "startTimestamp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeVideoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideoMetadata_videoId_key" ON "YoutubeVideoMetadata"("videoId");
