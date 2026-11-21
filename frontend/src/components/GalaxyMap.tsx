import React, { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { GalaxySystem } from '../hooks/useGalaxyData';
import { GalaxyMinimap } from './GalaxyMinimap';
import { OwnedSystemsList } from './OwnedSystemsList';

export const CELL_SIZE = 32;
export const CELL_GAP = 2;
export const VIEWPORT_HEIGHT = 600;
export const OVERSCAN_ROWS = 3;

export interface GalaxyFilterState {
  resource?: 'all' | 'Iron' | 'Energy' | 'Plasma' | '';
  ownership?: 'all' | 'mine' | 'unclaimed' | 'others' | '';
}

/** Filters systems by resource type and/or ownership status. */
export function filterSystems(
  systems: GalaxySystem[],
  filters: GalaxyFilterState,
  walletAddress: string | null
): GalaxySystem[] {
  return systems.filter((system) => {
    if (filters.resource && filters.resource !== 'all') {
      if (system.resourceType !== filters.resource) {
        return false;
      }
    }

    if (filters.ownership && filters.ownership !== 'all') {
      if (filters.ownership === 'mine') {
        if (!walletAddress || system.owner !== walletAddress) {
          return false;
        }
      } else if (filters.ownership === 'unclaimed') {
        if (system.owner !== null) {
          return false;
        }
      } else if (filters.ownership === 'others') {
        if (!system.owner || (walletAddress && system.owner === walletAddress)) {
          return false;
        }
      }
    }

    return true;
  });
}

/** Returns one past the furthest claimed/unclaimed coordinate in each axis. */
export function getGridDimensions(systems: GalaxySystem[]): { width: number; height: number } {
  if (systems.length === 0) {
    return { width: 0, height: 0 };
  }
  return {
    width: Math.max(...systems.map((s) => s.coordX)) + 1,
    height: Math.max(...systems.map((s) => s.coordY)) + 1,
  };
}

/** Returns the CSS color for a system cell, relative to the connected wallet. */
export function getSystemColor(system: GalaxySystem, walletAddress: string | null): string {
  if (!system.owner || !walletAddress) {
    return 'var(--unclaimed)';
  }
  return system.owner === walletAddress ? 'var(--accent)' : 'var(--red)';
}

/** Returns a complete accessible name for a galaxy cell. */
export function getSystemAriaLabel(system: GalaxySystem, walletAddress: string | null): string {
  const ownership = !system.owner
    ? i18n.t('galaxy.unclaimed', 'unclaimed')
    : system.owner === walletAddress
      ? i18n.t('galaxy.ownedByYou', 'owned by you')
      : i18n.t('galaxy.ownedBy', { owner: system.owner, defaultValue: `owned by ${system.owner}` });

  const event = system.activeEvent
    ? i18n.t('galaxy.activeEvent', { type: system.activeEvent.type, defaultValue: `, active event: ${system.activeEvent.type}` })
    : '';

  return i18n.t('galaxy.ariaLabel', {
    systemId: system.systemId,
    ownership,
    resourceType: system.resourceType,
    event,
    defaultValue: `System ${system.systemId}, ${ownership}, resource ${system.resourceType}${event}`,
  });
}

/** Selects only cells in (or just outside) the visible vertical window. */
export function getVisibleSystems(
  systems: GalaxySystem[],
  scrollTop: number,
  viewportHeight = VIEWPORT_HEIGHT,
): GalaxySystem[] {
  const rowHeight = CELL_SIZE + CELL_GAP;
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  const lastRow = Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN_ROWS;
  return systems.filter((system) => system.coordY >= firstRow && system.coordY <= lastRow);
}

export interface GalaxyMapProps {
  systems: GalaxySystem[];
  walletAddress: string | null;
  onSelectSystem?: (systemId: number, trigger: SVGRectElement) => void;
  selectedSystemId?: number | null;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    padding: '0.75rem 1rem',
    background: 'var(--bg-card, #0f1729)',
    border: '1px solid var(--border, #1e2a44)',
    borderRadius: '8px',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted, #94a3b8)',
  },
  select: {
    background: 'rgba(8, 11, 20, 0.9)',
    border: '1px solid var(--border, #1e2a44)',
    color: 'var(--text, #e2e8f0)',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resetBtn: {
    background: 'transparent',
    border: '1px solid var(--border, #1e2a44)',
    color: 'var(--text-muted, #94a3b8)',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
  },
  layoutRow: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    width: '100%',
  },
  viewportWrapper: {
    flex: 1,
    position: 'relative',
    background: 'var(--bg-card, #0f1729)',
    border: '1px solid var(--border, #1e2a44)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
};

/** Renders the galaxy grid as an SVG with filtering, minimap overview, and owned systems sidebar. */
export function GalaxyMap({
  systems,
  walletAddress,
  onSelectSystem,
  selectedSystemId,
}: GalaxyMapProps) {
  const { t } = useTranslation();
  const [filterState, setFilterState] = useState<GalaxyFilterState>({
    resource: 'all',
    ownership: 'all',
  });
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const { width, height } = getGridDimensions(systems);
  const svgWidth = width * (CELL_SIZE + CELL_GAP);
  const svgHeight = height * (CELL_SIZE + CELL_GAP);

  const filteredSystems = filterSystems(systems, filterState, walletAddress);
  const visibleSystems = getVisibleSystems(filteredSystems, scrollTop);

  const isFilterActive =
    (filterState.resource && filterState.resource !== 'all') ||
    (filterState.ownership && filterState.ownership !== 'all');

  const selectSystem = (systemId: number, trigger: SVGRectElement) => {
    onSelectSystem?.(systemId, trigger);
  };

  const handleCellKeyDown = (event: KeyboardEvent<SVGRectElement>, systemId: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    selectSystem(systemId, event.currentTarget);
  };

  const handleJumpToSystem = (systemId: number) => {
    const target = systems.find((s) => s.systemId === systemId);
    if (target && viewportRef.current) {
      const targetY = target.coordY * (CELL_SIZE + CELL_GAP);
      const centered = Math.max(0, targetY - VIEWPORT_HEIGHT / 2 + CELL_SIZE);
      viewportRef.current.scrollTop = centered;
      setScrollTop(centered);
    }
    const cellEl = document.getElementById(`galaxy-cell-${systemId}`) as SVGRectElement | null;
    if (cellEl) {
      selectSystem(systemId, cellEl);
    } else if (onSelectSystem) {
      onSelectSystem(systemId, null as unknown as SVGRectElement);
    }
  };

  const handleMinimapNavigate = (newScrollTop: number) => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = newScrollTop;
    }
    setScrollTop(newScrollTop);
  };

  return (
    <div style={styles.container} data-testid="galaxy-map-container">
      {/* Filter controls above map */}
      <div style={styles.filterBar} data-testid="galaxy-filter-bar">
        <div style={styles.filterGroup}>
          <label htmlFor="resource-filter" style={styles.filterLabel}>
            {t('filters.resource')}:
          </label>
          <select
            id="resource-filter"
            data-testid="resource-filter"
            aria-label={t('filters.filterByResource')}
            style={styles.select}
            value={filterState.resource || 'all'}
            onChange={(e) =>
              setFilterState((prev) => ({
                ...prev,
                resource: e.target.value as GalaxyFilterState['resource'],
              }))
            }
          >
            <option value="all">{t('filters.allResources')}</option>
            <option value="Iron">Iron</option>
            <option value="Energy">Energy</option>
            <option value="Plasma">Plasma</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label htmlFor="ownership-filter" style={styles.filterLabel}>
            {t('filters.ownership')}:
          </label>
          <select
            id="ownership-filter"
            data-testid="ownership-filter"
            aria-label={t('filters.filterByOwnership')}
            style={styles.select}
            value={filterState.ownership || 'all'}
            onChange={(e) =>
              setFilterState((prev) => ({
                ...prev,
                ownership: e.target.value as GalaxyFilterState['ownership'],
              }))
            }
          >
            <option value="all">{t('filters.allOwnership')}</option>
            <option value="mine">{t('filters.mine')}</option>
            <option value="unclaimed">{t('filters.unclaimed')}</option>
            <option value="others">{t('filters.others')}</option>
          </select>
        </div>

        {isFilterActive && (
          <button
            type="button"
            data-testid="reset-filters"
            style={styles.resetBtn}
            onClick={() => setFilterState({ resource: 'all', ownership: 'all' })}
          >
            {t('filters.reset')}
          </button>
        )}
      </div>

      {/* Main Map + Sidebar layout */}
      <div style={styles.layoutRow}>
        <OwnedSystemsList
          systems={systems}
          walletAddress={walletAddress}
          selectedSystemId={selectedSystemId}
          onSelectSystem={handleJumpToSystem}
        />

        <div style={styles.viewportWrapper}>
          <div
            ref={viewportRef}
            style={{ maxHeight: `${VIEWPORT_HEIGHT}px`, overflow: 'auto' }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            aria-label={t('galaxy.viewportAria')}
          >
            <svg
              viewBox={`0 0 ${svgWidth || CELL_SIZE} ${svgHeight || CELL_SIZE}`}
              style={{
                width: '100%',
                height: `${svgHeight || CELL_SIZE}px`,
                maxWidth: `${svgWidth}px`,
              }}
              role="img"
              aria-label={t('galaxy.mapAria')}
            >
              {visibleSystems.map((system) => (
                <g key={system.systemId}>
                  <rect
                    id={`galaxy-cell-${system.systemId}`}
                    data-testid={`galaxy-cell-${system.systemId}`}
                    x={system.coordX * (CELL_SIZE + CELL_GAP)}
                    y={system.coordY * (CELL_SIZE + CELL_GAP)}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={4}
                    fill={getSystemColor(system, walletAddress)}
                    stroke="var(--border)"
                    style={{ cursor: onSelectSystem ? 'pointer' : 'default' }}
                    role={onSelectSystem ? 'button' : 'img'}
                    tabIndex={onSelectSystem ? 0 : undefined}
                    aria-label={getSystemAriaLabel(system, walletAddress)}
                    onClick={(event) => selectSystem(system.systemId, event.currentTarget)}
                    onKeyDown={(event) => handleCellKeyDown(event, system.systemId)}
                  >
                    <title>
                      {t('galaxy.title', {
                        systemId: system.systemId,
                        resourceType: system.resourceType,
                        defaultValue: `System ${system.systemId} — ${system.resourceType}`,
                      })}
                    </title>
                  </rect>
                  {system.activeEvent && (
                    <g aria-hidden="true" pointerEvents="none">
                      <circle
                        cx={system.coordX * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 6}
                        cy={system.coordY * (CELL_SIZE + CELL_GAP) + 6}
                        r={6}
                        fill="var(--red)"
                        stroke="var(--bg-card)"
                        strokeWidth={2}
                      />
                      <text
                        x={system.coordX * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 6}
                        y={system.coordY * (CELL_SIZE + CELL_GAP) + 9}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={700}
                        fill="white"
                      >
                        !
                      </text>
                      <title>{`${system.activeEvent.type}${system.activeEvent.details ? `: ${system.activeEvent.details}` : ''}`}</title>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Minimap */}
          <GalaxyMinimap
            systems={filteredSystems}
            walletAddress={walletAddress}
            scrollTop={scrollTop}
            viewportHeight={VIEWPORT_HEIGHT}
            gridWidth={width}
            gridHeight={height}
            cellSize={CELL_SIZE}
            cellGap={CELL_GAP}
            onNavigate={handleMinimapNavigate}
          />
        </div>
      </div>
    </div>
  );
}
