import { CoverObject, VisualTags } from '@/types';

/**
 * Fetch and deduplicate album covers from the user's LIKED SONGS.
 * Uses /me/tracks endpoint (Section 5.2).
 */
export async function fetchUserAlbums(accessToken: string): Promise<CoverObject[]> {
  const allItems: any[] = [];
  const limit = 50;
  
  // Fetch up to 150 liked songs (3 pages)
  for (let offset = 0; offset < 150; offset += limit) {
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.warn(`Spotify API Liked Songs failed: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      if (!data.items || data.items.length === 0) break;
      
      allItems.push(...data.items);
      if (data.items.length < limit) break; 
    } catch (e) {
      console.error("Fetch Liked Songs failed:", e);
      break;
    }
  }

  // Deduplicate by album ID (Section 5.3)
  const uniqueAlbums = new Map<string, any>();
  allItems.forEach((item: any) => {
    if (item.track && item.track.album) {
      const album = item.track.album;
      if (!uniqueAlbums.has(album.id)) {
        uniqueAlbums.set(album.id, album);
      }
    }
  });

  return Array.from(uniqueAlbums.values()).map((album: any) => ({
    cover_id: album.id,
    image_url: album.images[0]?.url || '',
    album_name: album.name,
    artist: album.artists[0]?.name || 'Unknown Artist',
    tracks: [], 
    embedding: [], 
    description: `Album "${album.name}" by ${album.artists[0]?.name}`,
    tags: {
      colors: ['unknown'],
      brightness: 'bright',
      style: 'photograph',
      objects: [],
      composition: 'centered',
      mood: 'unknown',
    }
  }));
}

/**
 * Get a Spotify access token using Client Credentials flow (for public data).
 */
export async function getSpotifyServiceToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing Spotify Client ID or Secret for service token.");
    return null;
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch (e) {
    console.error("Failed to fetch Spotify service token:", e);
    return null;
  }
}

/**
 * Search for a specific album on Spotify to get its metadata and cover art.
 */
export async function searchSpotifyAlbum(album: string, artist: string, accessToken: string): Promise<any | null> {
  const query = `album:${album} artist:${artist}`;
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.albums.items.length > 0) {
      return data.albums.items[0];
    }

    // FALLBACK: If specific search fails, try a broader search with just the album name
    const fallbackResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(album)}&type=album&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      return fallbackData.albums.items[0] || null;
    }

    return null;
  } catch (e) {
    console.error("Spotify Search failed:", e);
    return null;
  }
}
