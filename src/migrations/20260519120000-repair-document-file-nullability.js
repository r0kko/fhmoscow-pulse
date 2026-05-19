'use strict';

const REPAIR_DOCUMENT_FILE_ID_SQL = `
DO $$
DECLARE
  file_id_attnum smallint;
  existing_fk_name text;
  fk_count integer;
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'documents table is missing';
  END IF;

  SELECT attnum
    INTO file_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.documents'::regclass
    AND attname = 'file_id'
    AND NOT attisdropped;

  IF file_id_attnum IS NULL THEN
    RAISE EXCEPTION 'documents.file_id column is missing';
  END IF;

  ALTER TABLE public.documents ALTER COLUMN file_id DROP NOT NULL;

  FOR existing_fk_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[file_id_attnum]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS %I',
      existing_fk_name
    );
  END LOOP;

  ALTER TABLE public.documents
    ADD CONSTRAINT documents_file_id_fkey
    FOREIGN KEY (file_id)
    REFERENCES public.files(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.documents'::regclass
      AND attname = 'file_id'
      AND attnotnull
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'documents.file_id is still NOT NULL after repair migration';
  END IF;

  SELECT COUNT(*)
    INTO fk_count
  FROM pg_constraint
  WHERE conrelid = 'public.documents'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[file_id_attnum];

  IF fk_count <> 1 THEN
    RAISE EXCEPTION 'documents.file_id must have exactly one foreign key, found %', fk_count;
  END IF;
END $$;
`;

const REFEREE_CLOSING_DRAFT_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS uq_referee_closing_documents_active_draft_referee
ON public.referee_closing_documents (tournament_id, referee_id)
WHERE status = 'DRAFT' AND deleted_at IS NULL;
`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(REPAIR_DOCUMENT_FILE_ID_SQL, {
        transaction,
      });
      await queryInterface.sequelize.query(REFEREE_CLOSING_DRAFT_INDEX_SQL, {
        transaction,
      });
    });
  },

  async down() {
    // Forward-only repair: document drafts are expected to exist without files
    // while PDF generation is running.
  },
};
