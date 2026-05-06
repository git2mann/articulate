'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
// @ts-expect-error - node-vibrant v4 exports field is complex for TS
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
}

const defaultColors: ThemeColors = {
  primary: '#10b981', // Emerald
  secondary: '#6366f1', // Indigo
  tertiary: '#ec4899', // Pink
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<ThemeColors>(defaultColors);

  const setThemeFromImage = async (imageUrl: string) => {
    try {
      // node-vibrant v4 usage
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
    // Update CSS variables on the document root
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', colors.primary);
    root.style.setProperty('--accent-secondary', colors.secondary);
    root.style.setProperty('--accent-tertiary', colors.tertiary);
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ colors, setThemeFromImage, resetTheme }}>
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
