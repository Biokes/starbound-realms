import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

const mockSetPreferences = vi.fn();
let mockTheme: 'light' | 'dark' = 'dark';

vi.mock('../hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { theme: mockTheme },
    setPreferences: mockSetPreferences,
  }),
}));

beforeEach(() => {
  mockSetPreferences.mockReset();
  mockTheme = 'dark';
});

describe('ThemeToggle', () => {
  it('renders a toggle button with aria-label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByLabelText(/Switch to light mode/i)).toBeInTheDocument();
  });

  it('toggles from dark to light on click', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetPreferences).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('toggles from light to dark on click', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetPreferences).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('shows correct aria-label for light mode', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByLabelText(/Switch to dark mode/i)).toBeInTheDocument();
  });
});
