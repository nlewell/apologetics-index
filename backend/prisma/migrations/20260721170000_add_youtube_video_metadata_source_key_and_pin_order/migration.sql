ALTER TABLE "YoutubeVideoMetadata"
ADD COLUMN "sourceKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "pinOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "YoutubeVideoMetadata_sourceKey_idx" ON "YoutubeVideoMetadata"("sourceKey");