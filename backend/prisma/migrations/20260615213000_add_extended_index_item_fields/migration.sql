-- AlterTable
ALTER TABLE "public"."ApologeticIndexItem"
ADD COLUMN "shortResponseLength" TEXT,
ADD COLUMN "shortResponseAuthor" TEXT,
ADD COLUMN "longResponseUrl" TEXT,
ADD COLUMN "longResponseLength" TEXT,
ADD COLUMN "debateUrl" TEXT,
ADD COLUMN "articleUrl" TEXT;
