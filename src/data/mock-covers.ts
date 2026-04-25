import { CoverObject } from '@/types';

export const MOCK_COVERS: CoverObject[] = [
  {
    cover_id: '1',
    image_url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&h=400&fit=crop',
    album_name: 'Midnight City',
    artist: 'Neon Dreams',
    tracks: ['City Lights', 'Night Drive'],
    embedding: [0.1, 0.8, 0.3], // Mock embedding
    tags: {
      colors: ['blue', 'purple', 'pink'],
      brightness: 'dark',
      style: 'photograph',
      objects: ['buildings', 'neon lights'],
      composition: 'portrait',
      mood: 'mysterious'
    },
    description: 'A dark city street with vibrant neon signs in blue and pink.'
  },
  {
    cover_id: '2',
    image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&h=400&fit=crop',
    album_name: 'Sunset Abstract',
    artist: 'Color Theory',
    tracks: ['Gradient', 'Fade'],
    embedding: [0.9, 0.4, 0.1],
    tags: {
      colors: ['orange', 'red', 'yellow'],
      brightness: 'bright',
      style: 'abstract',
      objects: [],
      composition: 'scattered',
      mood: 'happy'
    },
    description: 'A bright abstract gradient of warm sunset colors.'
  },
  {
    cover_id: '3',
    image_url: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&h=400&fit=crop',
    album_name: 'Forest Echoes',
    artist: 'Nature Boy',
    tracks: ['Trees', 'Wind'],
    embedding: [0.2, 0.3, 0.7],
    tags: {
      colors: ['green', 'brown'],
      brightness: 'dark',
      style: 'photograph',
      objects: ['trees', 'fog'],
      composition: 'portrait',
      mood: 'mysterious'
    },
    description: 'A dense, misty forest with tall dark trees.'
  },
  {
    cover_id: '4',
    image_url: 'https://images.unsplash.com/photo-1526218626217-dc65a29bb444?w=400&h=400&fit=crop',
    album_name: 'Minimalist White',
    artist: 'The Architect',
    tracks: ['Empty', 'Space'],
    embedding: [0.5, 0.5, 0.5],
    tags: {
      colors: ['white', 'grey'],
      brightness: 'bright',
      style: 'illustration',
      objects: ['cube'],
      composition: 'centered',
      mood: 'mysterious'
    },
    description: 'A simple white cube centered on a grey background.'
  },
  {
    cover_id: '5',
    image_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=400&fit=crop',
    album_name: 'Electric Soul',
    artist: 'Volt',
    tracks: ['Spark', 'Current'],
    embedding: [0.3, 0.6, 0.9],
    tags: {
      colors: ['blue', 'black'],
      brightness: 'dark',
      style: 'abstract',
      objects: ['lightning'],
      composition: 'centered',
      mood: 'mysterious'
    },
    description: 'A dark background with a single blue lightning bolt in the center.'
  }
];
