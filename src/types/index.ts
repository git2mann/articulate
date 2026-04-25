// Extend NextAuth Session type to include accessToken
import { Session as NextAuthSession } from "next-auth";

declare global {
  var geminiQuotaExceededUntil: number | undefined;
}

export interface SessionWithToken extends NextAuthSession {
  accessToken?: string;
}
export interface VisualTags {
  colors: string[];
  brightness: 'dark' | 'bright';
  style: 'photograph' | 'illustration' | 'abstract';
  objects: string[];
  composition: 'centered' | 'scattered' | 'portrait';
  mood: string;
}

export interface CoverObject {
  cover_id: string;
  image_url: string;
  album_name: string;
  artist: string;
  tracks: string[];
  embedding: number[];
  tags: VisualTags;
  description: string;
  spotify_url?: string;
  spotify_uri?: string;
}

export interface AlbumCandidate {
  id: string;
  title: string;
  artist: string;
  year?: string;
  visualDescription: string;
  confidence: number;
  image_url?: string;
  spotify_url?: string;
  spotify_uri?: string;
  embedding?: number[];
  tags?: VisualTags;
}

export interface SearchState {
  query: string;
  candidates: AlbumCandidate[];
  questions: string[];
  answers: Record<string, string>;
  isComplete: boolean;
}
