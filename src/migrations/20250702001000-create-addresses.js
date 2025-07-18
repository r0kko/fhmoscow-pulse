'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('addresses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      source: { type: Sequelize.STRING(250) },
      result: { type: Sequelize.STRING(500) },
      postal_code: { type: Sequelize.STRING(10) },
      country: { type: Sequelize.STRING(150) },
      country_iso_code: { type: Sequelize.STRING(10) },
      federal_district: { type: Sequelize.STRING(20) },
      region_fias_id: { type: Sequelize.STRING(50) },
      region_kladr_id: { type: Sequelize.STRING(20) },
      region_iso_code: { type: Sequelize.STRING(10) },
      region_with_type: { type: Sequelize.STRING(150) },
      region_type: { type: Sequelize.STRING(10) },
      region_type_full: { type: Sequelize.STRING(50) },
      region: { type: Sequelize.STRING(150) },
      area_fias_id: { type: Sequelize.STRING(50) },
      area_kladr_id: { type: Sequelize.STRING(20) },
      area_with_type: { type: Sequelize.STRING(150) },
      area_type: { type: Sequelize.STRING(10) },
      area_type_full: { type: Sequelize.STRING(50) },
      area: { type: Sequelize.STRING(150) },
      city_fias_id: { type: Sequelize.STRING(50) },
      city_kladr_id: { type: Sequelize.STRING(20) },
      city_with_type: { type: Sequelize.STRING(150) },
      city_type: { type: Sequelize.STRING(10) },
      city_type_full: { type: Sequelize.STRING(50) },
      city: { type: Sequelize.STRING(150) },
      city_area: { type: Sequelize.STRING(150) },
      city_district_fias_id: { type: Sequelize.STRING(50) },
      city_district_kladr_id: { type: Sequelize.STRING(20) },
      city_district_with_type: { type: Sequelize.STRING(150) },
      city_district_type: { type: Sequelize.STRING(10) },
      city_district_type_full: { type: Sequelize.STRING(50) },
      city_district: { type: Sequelize.STRING(150) },
      settlement_fias_id: { type: Sequelize.STRING(50) },
      settlement_kladr_id: { type: Sequelize.STRING(20) },
      settlement_with_type: { type: Sequelize.STRING(150) },
      settlement_type: { type: Sequelize.STRING(10) },
      settlement_type_full: { type: Sequelize.STRING(50) },
      settlement: { type: Sequelize.STRING(150) },
      street_fias_id: { type: Sequelize.STRING(50) },
      street_kladr_id: { type: Sequelize.STRING(20) },
      street_with_type: { type: Sequelize.STRING(150) },
      street_type: { type: Sequelize.STRING(10) },
      street_type_full: { type: Sequelize.STRING(50) },
      street: { type: Sequelize.STRING(150) },
      stead_fias_id: { type: Sequelize.STRING(50) },
      stead_kladr_id: { type: Sequelize.STRING(20) },
      stead_cadnum: { type: Sequelize.STRING(50) },
      stead_type: { type: Sequelize.STRING(10) },
      stead_type_full: { type: Sequelize.STRING(50) },
      stead: { type: Sequelize.STRING(50) },
      house_fias_id: { type: Sequelize.STRING(50) },
      house_kladr_id: { type: Sequelize.STRING(20) },
      house_cadnum: { type: Sequelize.STRING(50) },
      house_type: { type: Sequelize.STRING(10) },
      house_type_full: { type: Sequelize.STRING(50) },
      house: { type: Sequelize.STRING(50) },
      house_flat_count: { type: Sequelize.STRING(10) },
      block_type: { type: Sequelize.STRING(10) },
      block_type_full: { type: Sequelize.STRING(50) },
      block: { type: Sequelize.STRING(50) },
      entrance: { type: Sequelize.STRING(10) },
      floor: { type: Sequelize.STRING(10) },
      flat_fias_id: { type: Sequelize.STRING(50) },
      flat_cadnum: { type: Sequelize.STRING(50) },
      flat_type: { type: Sequelize.STRING(10) },
      flat_type_full: { type: Sequelize.STRING(50) },
      flat: { type: Sequelize.STRING(50) },
      flat_area: { type: Sequelize.STRING(50) },
      square_meter_price: { type: Sequelize.STRING(50) },
      flat_price: { type: Sequelize.STRING(50) },
      postal_box: { type: Sequelize.STRING(50) },
      room_type: { type: Sequelize.STRING(10) },
      room_type_full: { type: Sequelize.STRING(50) },
      room: { type: Sequelize.STRING(50) },
      fias_id: { type: Sequelize.STRING(50) },
      fias_code: { type: Sequelize.STRING(50) },
      fias_level: { type: Sequelize.STRING(10) },
      fias_actuality_state: { type: Sequelize.STRING(10) },
      kladr_id: { type: Sequelize.STRING(20) },
      geoname_id: { type: Sequelize.STRING(20) },
      capital_marker: { type: Sequelize.STRING(10) },
      okato: { type: Sequelize.STRING(20) },
      oktmo: { type: Sequelize.STRING(20) },
      tax_office: { type: Sequelize.STRING(10) },
      tax_office_legal: { type: Sequelize.STRING(10) },
      timezone: { type: Sequelize.STRING(50) },
      geo_lat: { type: Sequelize.STRING(20) },
      geo_lon: { type: Sequelize.STRING(20) },
      beltway_hit: { type: Sequelize.STRING(10) },
      beltway_distance: { type: Sequelize.STRING(10) },
      qc_geo: { type: Sequelize.INTEGER },
      qc_complete: { type: Sequelize.INTEGER },
      qc_house: { type: Sequelize.INTEGER },
      qc: { type: Sequelize.INTEGER },
      unparsed_parts: { type: Sequelize.STRING(250) },
      metro: { type: Sequelize.JSONB },
      divisions: { type: Sequelize.JSONB },
      created_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: { type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('addresses');
  },
};
