/**
 * Trade offers table (#204) and galaxy events table (#207).
 *
 * trade_offers holds peer-to-peer resource exchange offers. Status transitions:
 *   open → accepted (taker fills it) or open → cancelled (maker withdraws).
 *
 * galaxy_events records on-chain random events (pirate raids, resource surges)
 * emitted by the galaxy-map contract (#206/#207).
 */
exports.up = (pgm) => {
  pgm.createTable('trade_offers', {
    offer_id:       { type: 'BIGSERIAL', primaryKey: true },
    maker:          { type: 'VARCHAR(56)', notNull: true },
    offer_resource: { type: 'VARCHAR(10)', notNull: true },
    offer_amount:   { type: 'NUMERIC', notNull: true },
    want_resource:  { type: 'VARCHAR(10)', notNull: true },
    want_amount:    { type: 'NUMERIC', notNull: true },
    status:         { type: 'VARCHAR(16)', notNull: true, default: "'open'" },
    taker:          { type: 'VARCHAR(56)' },
    ledger_sequence: { type: 'BIGINT' },
    created_at:     { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
    updated_at:     { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('trade_offers', ['status'], { name: 'idx_trade_offers_status' });
  pgm.createIndex('trade_offers', ['maker'],  { name: 'idx_trade_offers_maker' });

  pgm.createTable('galaxy_events', {
    id:              { type: 'BIGSERIAL', primaryKey: true },
    event_type:      { type: 'VARCHAR(32)', notNull: true },
    system_id:       { type: 'INTEGER', notNull: true },
    affected_player: { type: 'VARCHAR(56)' },
    magnitude:       { type: 'INTEGER', notNull: true, default: 0 },
    ledger_sequence: { type: 'BIGINT', notNull: true },
    created_at:      { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('galaxy_events', ['event_type'],      { name: 'idx_galaxy_events_type' });
  pgm.createIndex('galaxy_events', ['system_id'],       { name: 'idx_galaxy_events_system' });
  pgm.createIndex('galaxy_events', ['ledger_sequence'], { name: 'idx_galaxy_events_ledger' });
};

exports.down = (pgm) => {
  pgm.dropTable('galaxy_events');
  pgm.dropTable('trade_offers');
};
