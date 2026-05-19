'use strict';

const NORMALIZE_CLOSING_SCHEMA_JOB_ERRORS_SQL = `
WITH affected_items AS (
  SELECT id
  FROM public.async_job_items
  WHERE item_type = 'REFEREE_CLOSING_DRAFT'
    AND (
      error_code ILIKE '%null value in column "file_id" of relation "documents" violates not-null constraint%'
      OR error_message ILIKE '%null value in column "file_id" of relation "documents" violates not-null constraint%'
    )
),
updated_items AS (
  UPDATE public.async_job_items
  SET error_code = 'closing_document_schema_outdated',
      error_message = 'closing_document_schema_outdated',
      updated_at = NOW()
  WHERE id IN (SELECT id FROM affected_items)
  RETURNING id
)
UPDATE public.async_job_events
SET message = CASE
      WHEN message ILIKE '%null value in column "file_id" of relation "documents" violates not-null constraint%'
        THEN 'closing_document_schema_outdated'
      ELSE message
    END,
    meta_json = jsonb_set(
      COALESCE(meta_json, '{}'::jsonb),
      '{error_code}',
      '"closing_document_schema_outdated"'::jsonb,
      true
    )
WHERE item_id IN (SELECT id FROM affected_items)
   OR message ILIKE '%null value in column "file_id" of relation "documents" violates not-null constraint%'
   OR meta_json->>'error_code' ILIKE '%null value in column "file_id" of relation "documents" violates not-null constraint%';
`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        NORMALIZE_CLOSING_SCHEMA_JOB_ERRORS_SQL,
        { transaction }
      );
    });
  },

  async down() {
    // Forward-only cleanup: do not reintroduce raw database errors into UI-visible
    // async job state.
  },
};
