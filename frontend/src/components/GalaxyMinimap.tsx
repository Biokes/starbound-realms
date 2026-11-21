import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GalaxySystem } from '../hooks/useGalaxyData';
import { getSystemColor } from './GalaxyMap';

export interface GalaxyMinimapProps {
  systems: GalaxySystem[];
  walletAddress: string | null;
  scrollTop: number;
  viewportHeight?: number;
  gridWidth: number;
  gridHeight: number;
  cellSize?: number;
  cellGap?: number;
  onNavigate?: (scrollTop: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '120px',
    background: 'rgba(8, 11, 20, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border, #1e2a44)',
    borderRadius: '6px',
    padding: '4px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
    zIndex: 5,
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    padding: '0 2px',
  },
  label: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted, #94a3b8)',
    fontWeight: 700,
  },
  svg: {
    width: '100%',
    display: 'block',
    cursor: 'pointer',
    borderRadius: '4px',
    background: 'rgba(5, 7, 13, 0.95)',
  },
};

export function GalaxyMinimap({
  systems,
  walletAddress,
  scrollTop,
  viewportHeight = 600,
  gridWidth,
  gridHeight,
  cellSize = 32,
  cellGap = 2,
  onNavigate,
}: GalaxyMinimapProps) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (gridWidth === 0 || gridHeight === 0 || systems.length === 0) {
    return null;
  }

  const rowSize = cellSize + cellGap;
  const fullWidth = gridWidth * rowSize;
  const fullHeight = gridHeight * rowSize;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onNavigate || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.max(0, Math.min(1, clickY / rect.height));
    const targetY = clickRatio * fullHeight - viewportHeight / 2;
    const clampedY = Math.max(0, Math.min(fullHeight - viewportHeight, targetY));
    onNavigate(clampedY);
  };

  const indicatorHeight = Math.min(viewportHeight, fullHeight);
  const strokeWidth = Math.max(2, Math.round(fullWidth / 80));

  return (
    <div
      style={styles.container}
      role="region"
      aria-label={t('minimap.ariaLabel')}
      data-testid="galaxy-minimap"
    >
      <div style={styles.header}>
        <span style={styles.label}>{t('minimap.ariaLabel')}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${fullWidth} ${fullHeight}`}
        style={styles.svg}
        onClick={handleClick}
        role="img"
        aria-label={t('minimap.ariaLabel')}
      >
        {/* Systems */}
        {systems.map((system) => (
          <rect
            key={system.systemId}
            data-testid={`minimap-cell-${system.systemId}`}
            x={system.coordX * rowSize}
            y={system.coordY * rowSize}
            width={cellSize}
            height={cellSize}
            rx={2}
            fill={getSystemColor(system, walletAddress)}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          data-testid="minimap-viewport-indicator"
          x={0}
          y={Math.max(0, scrollTop)}
          width={fullWidth}
          height={indicatorHeight}
          fill="rgba(99, 179, 237, 0.25)"
          stroke="var(--accent, #63b3ed)"
          strokeWidth={strokeWidth}
          pointerEvents="none"
          aria-label={t('minimap.viewportAria')}
        />
      </svg>
    </div>
  );
}
