/**
 * NEURAL ENGINE (Section 2 & 11)
 * Local browser-side models for Vision and Text.
 * Optimized for Articulate's visual search.
 */

// EXTREME GLOBAL SHIM: Fix for Transformers.js + Turbopack "undefined to object" crash
if (typeof window !== 'undefined') {
  const g = globalThis as any;
  
  // 1. Ensure process.env exists
  g.process = g.process || { env: {} };
  g.process.env = g.process.env || {};
  
  // 2. Pre-initialize the 'env' object. Transformers.js checks for this globally 
  // before falling back to its internal defaults.
  const envShim = {
    allowLocalModels: false,
    useBrowserCache: true,
    customCache: {},
    backends: {
      onnx: {},
      webgpu: {},
      wasm: {}
    }
  };

  // Set multiple potential global names used by different versions/builds
  g.env = g.env || envShim;
  g.__XENOVA_ENV__ = g.__XENOVA_ENV__ || envShim;
  
  // Ensure the internal backends are initialized to prevent isEmpty() crash
  if (g.env && !g.env.backends) g.env.backends = {};
  if (g.env && !g.env.customCache) g.env.customCache = {};
}

let embeddingPipeline: any = null;
let visionPipeline: any = null;

/**
 * Robust Text Embedding Engine
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    // Defensive Dynamic Import
    let transformers: any;
    try {
      transformers = await import('@xenova/transformers');
    } catch (importError: any) {
      console.error("[Neural Engine] Critical Import Failure:", importError?.message || importError);
      return [];
    }
    
    // Support both ESM and default-wrapped exports
    const pipeline = transformers.pipeline || transformers.default?.pipeline;
    const env = transformers.env || transformers.default?.env;

    if (!pipeline) {
      throw new Error("Neural Engine: Pipeline function not found.");
    }

    // Secondary Environment Guard
    if (env) {
      try {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        if (typeof (env as any).customCache === 'undefined') {
          (env as any).customCache = {};
        }
      } catch (e) {}
    }

    // Singleton pattern for the model pipeline
    if (!embeddingPipeline) {
      console.log("[Neural Engine] Initializing Text Model (all-MiniLM-L6-v2)...");
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
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
    const transformers = await import('@xenova/transformers');
    const pipeline = transformers.pipeline || transformers.default?.pipeline;
    const env = transformers.env || transformers.default?.env;

    if (!pipeline) throw new Error("Pipeline missing");

    if (env) {
      env.allowLocalModels = false;
      if (typeof (env as any).customCache === 'undefined') {
        (env as any).customCache = {};
      }
    }

    if (!visionPipeline) {
      console.log("[Neural Engine] Initializing Vision Model (vit-gpt2)...");
      visionPipeline = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    }

    const output = await visionPipeline(imageUrl);
    if (!output || !output[0] || !output[0].generated_text) return "visual artwork";

    return output[0].generated_text;
  } catch (error: any) {
    console.error("Neural Engine (Vision) Error:", error?.message || error);
    return "visual artwork";
  }
}

/**
 * Local Visual Analyzer: Uses browser canvas for raw pixel analysis.
 */
export async function analyzeVisuals(imageUrl: string) {
  return new Promise((resolve) => {
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
