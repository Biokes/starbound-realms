/**
 * Notifications table for per-player event notifications (#217).
 *
 * Populated by the indexer processor whenever a relevant event is indexed
 * (battle_resolved loss, alliance invite acceptance, system claimed/transferred).
 * Served via GET /player/:address/notifications.
 */
exports.up = (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'BIGSERIAL', primaryKey: true },
    player: { type: 'VARCHAR(56)', notNull: true },
    type: {
      type: 'VARCHAR(32)',
      notNull: true,
      comment: 'battle_lost | battle_won | system_lost | alliance_joined | alliance_left',
    },
    message: { type: 'TEXT', notNull: true },
    payload: { type: 'JSONB', notNull: false },
    read: { type: 'BOOLEAN', notNull: true, default: false },
    created_at: { type: 'TIMESTAMP', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('notifications', ['player'], { name: 'idx_notifications_player' });
  pgm.createIndex('notifications', ['player', 'read'], { name: 'idx_notifications_player_read' });
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
};
