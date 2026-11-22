/**
 * Adds the system upgrade level to star_systems (#296).
 *
 * Populated by the indexer from the galaxy-map `upgraded` event and returned
 * by GET /galaxy through `SELECT *`.
 *
 * Run with: `npm run migrate:up`
 */
exports.up = (pgm) => {
  pgm.addColumn('star_systems', {
    upgrade_level: { type: 'INTEGER', notNull: true, default: 0 },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('star_systems', 'upgrade_level');
};
