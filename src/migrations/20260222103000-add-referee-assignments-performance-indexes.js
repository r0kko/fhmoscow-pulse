'use strict';

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
}

module.exports = {
  async up(queryInterface) {
    if (
      !(await hasIndex(
        queryInterface,
        'match_referees',
        'idx_match_referees_match_role_status'
      ))
    ) {
      await queryInterface.addIndex(
        'match_referees',
        ['match_id', 'referee_role_id', 'status_id'],
        {
          name: 'idx_match_referees_match_role_status',
        }
      );
    }

    if (
      !(await hasIndex(
        queryInterface,
        'match_referees',
        'idx_match_referees_user_status'
      ))
    ) {
      await queryInterface.addIndex(
        'match_referees',
        ['user_id', 'status_id'],
        {
          name: 'idx_match_referees_user_status',
        }
      );
    }

    if (
      !(await hasIndex(
        queryInterface,
        'match_referee_draft_clears',
        'idx_match_referee_draft_clears_group_match'
      ))
    ) {
      await queryInterface.addIndex(
        'match_referee_draft_clears',
        ['referee_role_group_id', 'match_id'],
        {
          name: 'idx_match_referee_draft_clears_group_match',
        }
      );
    }
  },

  async down(queryInterface) {
    if (
      await hasIndex(
        queryInterface,
        'match_referee_draft_clears',
        'idx_match_referee_draft_clears_group_match'
      )
    ) {
      await queryInterface.removeIndex(
        'match_referee_draft_clears',
        'idx_match_referee_draft_clears_group_match'
      );
    }

    if (
      await hasIndex(
        queryInterface,
        'match_referees',
        'idx_match_referees_user_status'
      )
    ) {
      await queryInterface.removeIndex(
        'match_referees',
        'idx_match_referees_user_status'
      );
    }

    if (
      await hasIndex(
        queryInterface,
        'match_referees',
        'idx_match_referees_match_role_status'
      )
    ) {
      await queryInterface.removeIndex(
        'match_referees',
        'idx_match_referees_match_role_status'
      );
    }
  },
};
