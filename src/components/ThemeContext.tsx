'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Vibrant } from 'node-vibrant/browser';

interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  setThemeFromImage: (imageUrl: string) => Promise<void>;
  resetTheme: () => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const defaultColors: ThemeColors = {
  primary: '#10b981', // Emerald
  secondary: '#6366f1', // Indigo
  tertiary: '#ec4899', // Pink
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('articulate-theme') as 'light' | 'dark' | 'system';
      return savedTheme || 'system';
    }
    return 'system';
  });

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('articulate-theme', newTheme);
  };

  const setThemeFromImage = async (imageUrl: string) => {
    try {
      const palette = await Vibrant.from(imageUrl).getPalette();
      const newColors: ThemeColors = {
        primary: palette.Vibrant?.hex || defaultColors.primary,
        secondary: palette.Muted?.hex || palette.DarkVibrant?.hex || defaultColors.secondary,
        tertiary: palette.LightVibrant?.hex || defaultColors.tertiary,
      };
      setColors(newColors);
    } catch (e) {
      console.error('Failed to extract colors from image', e);
    }
  };

  const resetTheme = () => {
    setColors(defaultColors);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', colors.primary);
    root.style.setProperty('--accent-secondary', colors.secondary);
    root.style.setProperty('--accent-tertiary', colors.tertiary);
    
    // Update main accent variables for dynamic UI response
    root.style.setProperty('--accent', colors.primary);
    // Create a semi-transparent version for the soft accent
    const softAccent = colors.primary.startsWith('#') 
      ? `${colors.primary}1a` 
      : colors.primary;
    root.style.setProperty('--accent-soft', softAccent);
  }, [colors]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      
      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ colors, setThemeFromImage, resetTheme, theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
