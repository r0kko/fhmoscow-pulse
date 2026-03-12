function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    patronymic: user.patronymic || null,
  };
}

function toPublicStatus(status) {
  if (!status) return null;
  return {
    id: status.id,
    alias: status.alias,
    name_ru: status.name_ru,
  };
}

function toPublicTariffRule(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    tournament_id: rule.tournament_id,
    stage_group_id: rule.stage_group_id,
    referee_role_id: rule.referee_role_id,
    fare_code: rule.fare_code,
    base_amount_rub: rule.base_amount_rub,
    meal_amount_rub: rule.meal_amount_rub,
    travel_mode: rule.travel_mode,
    valid_from: rule.valid_from,
    valid_to: rule.valid_to || null,
    status: toPublicStatus(rule.TariffStatus),
    version: rule.version,
    stage_group: rule.TournamentGroup
      ? {
          id: rule.TournamentGroup.id,
          name: rule.TournamentGroup.name || null,
        }
      : null,
    referee_role: rule.RefereeRole
      ? {
          id: rule.RefereeRole.id,
          name: rule.RefereeRole.name || null,
        }
      : null,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  };
}

function toPublicTravelRate(rate) {
  if (!rate) return null;
  return {
    id: rate.id,
    ground_id: rate.ground_id,
    rate_code: rate.rate_code || null,
    travel_amount_rub: rate.travel_amount_rub,
    valid_from: rate.valid_from,
    valid_to: rate.valid_to || null,
    status: toPublicStatus(rate.TravelRateStatus),
    created_at: rate.created_at,
    updated_at: rate.updated_at,
  };
}

function toPublicPosting(posting) {
  if (!posting) return null;
  return {
    id: posting.id,
    line_no: posting.line_no,
    posting_type: posting.PostingType
      ? {
          id: posting.PostingType.id,
          alias: posting.PostingType.alias,
          name_ru: posting.PostingType.name_ru,
        }
      : null,
    component: posting.Component
      ? {
          id: posting.Component.id,
          alias: posting.Component.alias,
          name_ru: posting.Component.name_ru,
        }
      : null,
    amount_rub: posting.amount_rub,
    reason_code: posting.reason_code || null,
    comment: posting.comment || null,
  };
}

function toPublicAccrualChainDocument(document) {
  if (!document) return null;
  return {
    id: document.id,
    accrual_number: document.accrual_number,
    total_amount_rub: document.total_amount_rub || null,
    created_at: document.created_at || null,
    status: toPublicStatus(document.DocumentStatus),
  };
}

function toPublicAccrualDocument(document) {
  if (!document) return null;
  return {
    id: document.id,
    accrual_number: document.accrual_number,
    tournament_id: document.tournament_id,
    match_id: document.match_id,
    match_referee_id: document.match_referee_id,
    referee_id: document.referee_id,
    referee_role_id: document.referee_role_id,
    stage_group_id: document.stage_group_id,
    ground_id: document.ground_id || null,
    fare_code_snapshot: document.fare_code_snapshot,
    tariff_rule_id: document.tariff_rule_id || null,
    travel_rate_id: document.travel_rate_id || null,
    match_date_snapshot: document.match_date_snapshot,
    base_amount_rub: document.base_amount_rub,
    meal_amount_rub: document.meal_amount_rub,
    travel_amount_rub: document.travel_amount_rub,
    total_amount_rub: document.total_amount_rub,
    currency: document.currency,
    status: toPublicStatus(document.DocumentStatus),
    source: toPublicStatus(document.Source),
    original_document_id: document.original_document_id || null,
    tournament: document.Tournament
      ? {
          id: document.Tournament.id,
          name: document.Tournament.name || null,
        }
      : null,
    match: document.Match
      ? {
          id: document.Match.id,
          date_start: document.Match.date_start || null,
          home_team: document.Match.HomeTeam
            ? {
                id: document.Match.HomeTeam.id,
                name: document.Match.HomeTeam.name || null,
              }
            : null,
          away_team: document.Match.AwayTeam
            ? {
                id: document.Match.AwayTeam.id,
                name: document.Match.AwayTeam.name || null,
              }
            : null,
        }
      : null,
    referee: toPublicUser(document.Referee),
    referee_role: document.RefereeRole
      ? {
          id: document.RefereeRole.id,
          name: document.RefereeRole.name || null,
        }
      : null,
    stage_group: document.TournamentGroup
      ? {
          id: document.TournamentGroup.id,
          name: document.TournamentGroup.name || null,
        }
      : null,
    ground: document.Ground
      ? {
          id: document.Ground.id,
          name: document.Ground.name || null,
        }
      : null,
    tariff_rule: document.RefereeTariffRule
      ? {
          id: document.RefereeTariffRule.id,
          fare_code: document.RefereeTariffRule.fare_code || null,
        }
      : null,
    travel_rate: document.GroundRefereeTravelRate
      ? {
          id: document.GroundRefereeTravelRate.id,
          rate_code: document.GroundRefereeTravelRate.rate_code || null,
          travel_amount_rub: document.GroundRefereeTravelRate.travel_amount_rub,
        }
      : null,
    original_document: toPublicAccrualChainDocument(document.OriginalDocument),
    adjustments: Array.isArray(document.Adjustments)
      ? document.Adjustments.map(toPublicAccrualChainDocument)
      : [],
    postings: Array.isArray(document.Postings)
      ? document.Postings.map(toPublicPosting)
      : [],
    created_at: document.created_at,
    updated_at: document.updated_at,
  };
}

function toPublicAuditEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    action: event.action,
    before_json: event.before_json,
    after_json: event.after_json,
    actor: toPublicUser(event.Actor),
    created_at: event.created_at,
  };
}

export default {
  toPublicTariffRule,
  toPublicTravelRate,
  toPublicPosting,
  toPublicAccrualDocument,
  toPublicAuditEvent,
};
