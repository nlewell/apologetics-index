CREATE TABLE "YoutubeChannelWhitelistEntry" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeChannelWhitelistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubeChannelWhitelistEntry_identifier_key"
    ON "YoutubeChannelWhitelistEntry"("identifier");
