/**
 * NEURAL ENGINE (Section 2 & 11)
 * Local browser-side models for Vision and Text.
 */
let embeddingPipeline: any = null;
let visionPipeline: any = null;
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const err = new Error('[Neural Engine] getEmbedding called with invalid or empty text: ' + String(text));
      // Print stack trace and context for debugging
      console.warn(err.message);
      if (err.stack) console.warn('Call stack:', err.stack);
      return [];
    }
    const transformersModule = await import('@xenova/transformers');
    
    // Support both namespace and default export if applicable
    const transformers = (transformersModule as any).pipeline ? transformersModule : (transformersModule as any).default;
    
    if (!transformers || !transformers.pipeline) {
      console.error("Transformers module structure:", Object.keys(transformersModule || {}));
      throw new Error("Transformers library failed to load or has invalid structure");
    }

    const { pipeline, env } = transformers;

    // Safety check for env object
    if (env && typeof env === 'object') {
      try {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
      } catch (e) {
        console.warn("Could not set env properties:", e);
      }
    }

    if (!embeddingPipeline) {
      console.log("[Neural Engine] Initializing Text Model...");
      embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    if (!output || !output.data) {
      console.warn("[Neural Engine] Empty output from model");
      return [];
    }

    return Array.from(output.data);
  } catch (error: any) {
    console.error("Neural Engine (Text) Error:", error.message || error);
    // Log the stack trace if available to help debugging
    if (error.stack) console.error(error.stack);
    return [];
  }
}

/**
 * Local Vision Engine: Describes an image URL using a browser-side model.
 */
import { describeImageHuggingFace } from './huggingface';

export async function describeImage(imageUrl: string): Promise<string> {
  // Try Hugging Face API first
  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || '';
  if (apiKey) {
    const hfResult = await describeImageHuggingFace(imageUrl, apiKey);
    if (hfResult && !hfResult.toLowerCase().includes('no description')) {
      return hfResult;
    }
  }
  // Fallback to local model
  try {
    const transformers = await import('@xenova/transformers');
    if (!transformers || !transformers.pipeline) {
      throw new Error("Transformers library failed to load");
    }

    const { pipeline, env } = transformers;
    if (env) env.allowLocalModels = false;

    if (!visionPipeline) {
      visionPipeline = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    }

    const output = await visionPipeline(imageUrl);
    if (!output || !output[0] || !output[0].generated_text) return "visual artwork";

    return output[0].generated_text;
  } catch (error) {
    console.error("Neural Engine (Vision) Error:", error);
    return "visual artwork";
  }
}


/**
 * Local Visual Analyzer: Uses the browser's canvas to extract 
 * brightness and dominant color data.
 */
export async function analyzeVisuals(imageUrl: string) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ brightness: 'bright', colors: ['unknown'] });

      canvas.width = 50; // Small sample for speed
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      const data = ctx.getImageData(0, 0, 50, 50).data;
      let totalBrightness = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        // Simple perceived brightness formula
        totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      }
      
      const avgBrightness = totalBrightness / (data.length / 4);
      resolve({
        brightness: avgBrightness < 120 ? 'dark' : 'bright',
        colors: ['unknown'] // Could be expanded with color clustering
      });
    };
    img.onerror = () => resolve({ brightness: 'bright', colors: ['unknown'] });
    img.src = imageUrl;
  });
}

/**
 * Compares a description against a list of options and returns the best match.
 * (e.g., is "a rainy street" more "dark" or "bright"?)
 */
export async function semanticallyClassify(text: string, options: string[]): Promise<string> {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('[Neural Engine] semanticallyClassify called with invalid or empty text:', text);
      return options[0];
    }
    const textEmbedding = await getEmbedding(text);
    let bestMatch = options[0];
    let highestSimilarity = -1;

    for (const option of options) {
      if (!option || typeof option !== 'string' || option.trim().length === 0) {
        console.warn('[Neural Engine] semanticallyClassify skipping invalid option:', option);
        continue;
      }
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
