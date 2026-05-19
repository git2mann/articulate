/**
 * NEURAL ENGINE (Section 2 & 11)
 * Local browser-side models for Vision and Text.
 * Optimized for Articulate's visual search.
 * Upgraded to Transformers.js v3 (@huggingface/transformers)
 */

let transformersPromise: Promise<any> | null = null;

async function getTransformers(onStatus?: (status: string) => void) {
  if (typeof window === 'undefined') return null;
  if (!transformersPromise) {
    transformersPromise = (async () => {
      const { pipeline, env, RawImage } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // Force WASM for reliability in parallel environments
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1; 
      }
      // Setup progress tracking for model downloads
      if (onStatus) {
        (env as any).onProgress = (progress: any) => {
          if (progress.status === 'progress') {
            const percent = Math.round(progress.progress);
            onStatus(`DOWNLOADING MODEL... ${percent}%`);
          } else if (progress.status === 'initiate') {
            onStatus(`INITIATING MODEL DOWNLOAD...`);
          }
        };
      }

      return { pipeline, env, RawImage };
    })();
  }
  return transformersPromise;
}

let embeddingPipeline: any = null;
let visionPipeline: any = null;
let visionInitializationPromise: Promise<any> | null = null;
let classifierPipeline: any = null;
let classifierInitializationPromise: Promise<any> | null = null;
let forceWasm = true;
let isInitializing = false;

/**
 * Detect the best available device for Transformers.js
 * Forced to WASM for maximum reliability during parallel indexing.
 */
async function getBestDevice(): Promise<'wasm'> {
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

    const { pipeline } = await getTransformers();

    if (!embeddingPipeline) {
      console.log("[Neural Engine] Initializing Text Model (all-MiniLM-L6-v2)...");
      const device = await getBestDevice();
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { 
        device,
        dtype: 'fp32' // Ensure stability
      });
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
import { CoverObject } from '@/types';

export async function describeImage(imageUrl: string, onStatus?: (status: string) => void): Promise<string> {
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
    const transformers = await getTransformers(onStatus);
    if (!transformers) return "";
    const { pipeline, RawImage } = transformers;

    if (!visionPipeline) {
      if (!visionInitializationPromise) {
        visionInitializationPromise = (async () => {
          const device = await getBestDevice();
          onStatus?.(`INITIALIZING ADVANCED VISION (Florence-2)...`);
          remoteLog(`Initializing Vision Model (Florence-2)...`, 'INFO');
          // Switch back to 'image-to-text' as 'image-text-to-text' is not yet standard in this build
          const p = await pipeline('image-to-text', 'onnx-community/Florence-2-base-ft', { 
            device,
            dtype: 'fp32' 
          });
          visionPipeline = p;
          return p;
        })();
      }
      await visionInitializationPromise;
    }

    onStatus?.(`PERFORMING DEEP VISUAL SCAN...`);
    const image = await RawImage.read(imageUrl);
    
    // Florence-2 uses specific prompts for different tasks. 
    // <DETAILED_CAPTION> is perfect for the "Nirvana-style" literal descriptions.
    const output = await visionPipeline(image, { 
      prompt: '<DETAILED_CAPTION>',
      max_new_tokens: 128 
    });
    
    if (!output || !output[0] || !output[0].generated_text) return "";

    // Clean up the Florence-2 specific tags from the output
    return output[0].generated_text.replace('<DETAILED_CAPTION>', '').trim();
  } catch (error: any) {
    console.error("Neural Engine (Vision) Error:", error?.message || error);
    return "";
  }
}

/**
 * Remote Logger: Sends client logs to backend console for debugging.
 */
async function remoteLog(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO', metadata?: any) {
  try {
    fetch('/api/diag/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level, metadata })
    }).catch(() => {}); // Fire and forget
  } catch (e) {}
}

/**
 * Local Visual Analyzer (Section 11)
 * Zero-Cost, API-Free Indexing using CLIP and Browser Canvas.
 */
export async function analyzeImageLocally(
  imageUrl: string, 
  albumName: string, 
  artistName: string,
  onStatus?: (status: string) => void
): Promise<any> {
  if (typeof window === 'undefined') return null;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const transformers = await getTransformers(onStatus);
      if (!transformers) return null;
      const { pipeline, RawImage } = transformers;

      if (!classifierPipeline) {
        if (!classifierInitializationPromise) {
          classifierInitializationPromise = (async () => {
            const device = await getBestDevice();
            onStatus?.(`LOADING NEURAL ARCHIVE...`);
            remoteLog(`Initializing CLIP Model on ${device}...`, 'INFO');
            const p = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { 
              device,
              dtype: 'fp32'
            });
            classifierPipeline = p;
            return p;
          })();
        }
        await classifierInitializationPromise;
      }

      onStatus?.(`ANALYZING ARTWORK...`);
      remoteLog(`Analyzing "${albumName}" by ${artistName} (Attempt ${attempts + 1})...`, 'INFO');
      
      // 1. Fetch image with timeout
      const imagePromise = RawImage.read(imageUrl);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Image fetch timeout")), 15000));
      const image = await Promise.race([imagePromise, timeoutPromise]) as any;

      // 2. Define tags to classify
      const styleOptions = ['photograph', 'illustration', 'abstract', '3d render', 'minimalist', 'vibrant painting'];
      const compositionOptions = ['centered subject', 'scattered elements', 'close-up portrait', 'wide landscape', 'symmetrical'];
      const moodOptions = ['happy', 'melancholic', 'aggressive', 'peaceful', 'mysterious', 'energetic'];
      const objectOptions = ['a person', 'a group of people', 'nature and landscapes', 'a city with buildings', 'animals', 'cars and vehicles', 'text and typography', 'vibrant colors and patterns', 'nothing specific'];

      // 3. Run inferences SEQUENTIALLY to prevent GPU/Memory deadlock
      onStatus?.(`DECODING AESTHETICS...`);
      const styleResults = await classifierPipeline(image, styleOptions);
      const compResults = await classifierPipeline(image, compositionOptions);
      const moodResults = await classifierPipeline(image, moodOptions);
      const objectResults = await classifierPipeline(image, objectOptions);
      const basicVisuals = await analyzeVisuals(imageUrl) as any;

      const bestStyle = styleResults[0].label;
      const bestComp = compResults[0].label.split(' ')[0]; 
      const bestMood = moodResults[0].label;
      const bestObject = objectResults[0].label;

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
        objects: [bestObject],
        composition: composition,
        mood: bestMood
      };

      // Use Florence-2 for a state-of-the-art literal description
      const richDescription = await describeImage(imageUrl, onStatus);
      
      // Construct a more literal, content-focused description
      const visualContent = richDescription ? richDescription.trim() : `An image of ${bestObject}`;
      // Ensure it ends with a period if it doesn't have one
      const punctuation = visualContent.endsWith('.') ? '' : '.';
      
      const description = `${visualContent}${punctuation} This ${bestStyle} cover has a ${bestMood} mood and ${composition} layout.`;

      remoteLog(`Successfully indexed "${albumName}"`, 'INFO');      return { tags, description, isLocal: true };
    } catch (e: any) {
      attempts++;
      remoteLog(`Attempt ${attempts} failed for "${albumName}": ${e.message}`, 'WARN');
      
      if (e.message?.includes('aborted') || e.message?.includes('gpu') || e.message?.includes('webgpu') || e.message?.includes('timeout')) {
        forceWasm = true;
        classifierPipeline = null; 
      }

      if (attempts >= maxAttempts) {
        remoteLog(`Critical Failure after ${maxAttempts} attempts for "${albumName}"`, 'ERROR');
        return null;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 500));
    }
  }
  return null;
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

      // Use small canvas for performance
      canvas.width = 10; 
      canvas.height = 10;
      ctx.drawImage(img, 0, 0, 10, 10);
      
      const data = ctx.getImageData(0, 0, 10, 10).data;
      let r = 0, g = 0, b = 0;
      let totalBrightness = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i+1];
        b += data[i+2];
        totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      }
      
      const count = data.length / 4;
      const avgR = Math.round(r / count);
      const avgG = Math.round(g / count);
      const avgB = Math.round(b / count);
      const avgBrightness = totalBrightness / count;

      resolve({
        brightness: avgBrightness < 120 ? 'dark' : 'bright',
        colors: [`rgb(${avgR},${avgG},${avgB})`]
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
