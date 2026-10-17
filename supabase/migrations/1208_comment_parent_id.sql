-- 1208: Add parentId column to Comment table for threaded replies
-- Idempotent: only adds column if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Comment'
      AND column_name = 'parentId'
  ) THEN
    ALTER TABLE public."Comment"
      ADD COLUMN "parentId" TEXT;

    ALTER TABLE public."Comment"
      ADD CONSTRAINT "Comment_parentId_fkey"
      FOREIGN KEY ("parentId")
      REFERENCES public."Comment"("id")
      ON DELETE SET NULL;

    CREATE INDEX "Comment_parentId_idx"
      ON public."Comment"("parentId")
      WHERE "parentId" IS NOT NULL;
  END IF;
END $$;
