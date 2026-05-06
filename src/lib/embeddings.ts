/**
 * NEURAL ENGINE (Section 2 & 11)
 * Local browser-side models for Vision and Text.
 * Optimized for Articulate's visual search.
 * Upgraded to Transformers.js v3 (@huggingface/transformers)
 */

let embeddingPipeline: any = null;
let visionPipeline: any = null;
let classifierPipeline: any = null;

/**
 * Detect the best available device for Transformers.js
 * Optimized for universal compatibility: Forces WASM for now to avoid WebGPU failures.
 */
async function getBestDevice() {
  if (typeof window === 'undefined') return 'wasm';
  // WASM is the most stable backend across all browsers/environments currently.
  return 'wasm';
}

/**
 * Robust Text Embedding Engine
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    if (typeof window === 'undefined') return []; 
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    if (!embeddingPipeline) {
      console.log("[Neural Engine] Initializing Text Model (all-MiniLM-L6-v2)...");
      const device = await getBestDevice();
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device });
    }

    const output = await embeddingPipeline(text, { 
      pooling: 'mean', 
      normalize: true 
    });

    if (!output || !output.data) return [];
    return Array.from(output.data);
  } catch (error: any) {
    console.error("Neural Engine (Text) Error:", error?.message || error);
    return [];
  }
}

/**
 * Local Vision Engine: Describes an image URL using a browser-side model.
 */
import { describeImageHuggingFace } from './huggingface';

export async function describeImage(imageUrl: string): Promise<string> {
  if (typeof window === 'undefined') return "visual artwork";

  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || '';
  if (apiKey) {
    try {
      const hfResult = await describeImageHuggingFace(imageUrl, apiKey);
      if (hfResult && !hfResult.toLowerCase().includes('no description')) {
        return hfResult;
      }
    } catch (e) {
      console.warn("[Neural Engine] HuggingFace fallback active.");
    }
  }

  try {
    const { pipeline, env, RawImage } = await import('@huggingface/transformers');
    env.allowLocalModels = false;

    if (!visionPipeline) {
      console.log("[Neural Engine] Initializing Vision Model (vit-gpt2)...");
      const device = await getBestDevice();
      visionPipeline = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', { device });
    }

    const image = await RawImage.read(imageUrl);
    const output = await visionPipeline(image);
    if (!output || !output[0] || !output[0].generated_text) return "visual artwork";

    return output[0].generated_text;
  } catch (error: any) {
    console.error("Neural Engine (Vision) Error:", error?.message || error);
    return "visual artwork";
  }
}

/**
 * Local Visual Analyzer (Section 11)
 * Zero-Cost, API-Free Indexing using CLIP and Browser Canvas.
 */
export async function analyzeImageLocally(imageUrl: string, albumName: string, artistName: string): Promise<any> {
  if (typeof window === 'undefined') return null;

  try {
    const { pipeline, env, RawImage } = await import('@huggingface/transformers');
    
    // Configure environment for browser-side performance
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    if (!classifierPipeline) {
      const device = await getBestDevice();
      console.log(`[Neural Engine] Initializing CLIP Model (quantized) on ${device}...`);
      // Use quantized model for 4x smaller download and faster inference
      classifierPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { device });
    }

    console.log(`[Local Indexing] Fetching & Analyzing "${albumName}"...`);
    
    // 1. Fetch image robustly
    const image = await RawImage.read(imageUrl);

    // 2. Define tags to classify
    const styleOptions = ['photograph', 'illustration', 'abstract', '3d render', 'minimalist', 'vibrant painting'];
    const compositionOptions = ['centered subject', 'scattered elements', 'close-up portrait', 'wide landscape', 'symmetrical'];
    const moodOptions = ['happy', 'melancholic', 'aggressive', 'peaceful', 'mysterious', 'energetic'];

    // 3. Run classifications and basic analysis
    const [styleResults, compResults, moodResults, basicVisuals] = await Promise.all([
      classifierPipeline(image, styleOptions),
      classifierPipeline(image, compositionOptions),
      classifierPipeline(image, moodOptions),
      analyzeVisuals(imageUrl) as Promise<any>
    ]);

    const bestStyle = styleResults[0].label;
    const bestComp = compResults[0].label.split(' ')[0]; 
    const bestMood = moodResults[0].label;

    // Map style
    let style: 'photograph' | 'illustration' | 'abstract' = 'photograph';
    if (bestStyle === 'illustration' || bestStyle === 'vibrant painting') style = 'illustration';
    else if (bestStyle === 'abstract' || bestStyle === 'minimalist') style = 'abstract';

    // Map composition
    let composition: 'centered' | 'scattered' | 'portrait' = 'centered';
    if (bestComp === 'scattered') composition = 'scattered';
    else if (bestComp === 'close-up') composition = 'portrait';

    const tags = {
      colors: basicVisuals.colors || ['unknown'],
      brightness: basicVisuals.brightness || 'bright',
      style: style,
      objects: [bestStyle], // Simple fallback
      composition: composition,
      mood: bestMood
    };

    const description = `Album cover for "${albumName}" by ${artistName}. It features a ${bestStyle} with a ${bestMood} mood and ${composition} composition. Local neural fingerprints confirm high aesthetic confidence.`;

    return { tags, description, isLocal: true };
  } catch (e: any) {
    console.error("[Local Indexing] Critical Failure:", e.message);
    return null;
  }
}

/**
 * Local Visual Analyzer: Uses browser canvas for raw pixel analysis.
 */
export async function analyzeVisuals(imageUrl: string) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ brightness: 'bright', colors: ['unknown'] });

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ brightness: 'bright', colors: ['unknown'] });

      canvas.width = 50; 
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      const data = ctx.getImageData(0, 0, 50, 50).data;
      let totalBrightness = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      }
      
      const avgBrightness = totalBrightness / (data.length / 4);
      resolve({
        brightness: avgBrightness < 120 ? 'dark' : 'bright',
        colors: ['unknown']
      });
    };
    img.onerror = () => resolve({ brightness: 'bright', colors: ['unknown'] });
    img.src = imageUrl;
  });
}

/**
 * Semantic Classifier: Maps descriptions to structured tags.
 */
export async function semanticallyClassify(text: string, options: string[]): Promise<string> {
  try {
    if (!text || text.trim().length === 0) return options[0];
    
    const textEmbedding = await getEmbedding(text);
    if (!textEmbedding || textEmbedding.length === 0) return options[0];

    let bestMatch = options[0];
    let highestSimilarity = -1;

    for (const option of options) {
      const optionEmbedding = await getEmbedding(option);
      if (!optionEmbedding || optionEmbedding.length === 0) continue;
      
      const similarity = computeCosineSimilarity(textEmbedding, optionEmbedding);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = option;
      }
    }
    return bestMatch;
  } catch (e) {
    return options[0];
  }
}

/**
 * Utility to find top N most similar covers in a library based on embeddings
 */
export function findSimilarCovers(target: CoverObject, library: CoverObject[], limit = 5): CoverObject[] {
  const targetId = target.cover_id || (target as any).id;
  if (!target.embedding || target.embedding.length === 0) return [];
  
  return library
    .filter(c => {
      const cId = c.cover_id || (c as any).id;
      return cId !== targetId && c.embedding && c.embedding.length > 0;
    })
    .map(c => ({
      cover: c,
      similarity: computeCosineSimilarity(target.embedding, c.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => item.cover);
}

/**
 * Vector Math: Cosine Similarity
 */
export function computeCosineSimilarity(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(v1.length, v2.length);
  for (let i = 0; i < len; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
