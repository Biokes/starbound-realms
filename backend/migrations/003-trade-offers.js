exports.up = (pgm) => {
  pgm.createTable('trade_offers', {
    offer_id: { type: 'VARCHAR(128)', primaryKey: true },
    offer: { type: 'JSONB', notNull: true },
    status: {
      type: 'VARCHAR(16)',
      notNull: true,
      default: 'open',
      check: `status IN ('open', 'accepted', 'cancelled')`,
    },
    ledger_sequence: { type: 'BIGINT', notNull: true },
    created_at: { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('trade_offers');
};
