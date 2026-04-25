// Hugging Face Inference API client for image captioning
// Uses BLIP-2 or LLaVA for high-quality image descriptions

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/Salesforce/blip2-opt-2.7b'; // You can swap to LLaVA or other models if needed

export async function describeImageHuggingFace(imageUrl: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        inputs: imageUrl,
        options: { wait_for_model: true }
      })
    });
    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text;
    }
    if (data?.generated_text) {
      return data.generated_text;
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return 'No description available.';
  } catch (error) {
    console.error('Hugging Face Vision API Error:', error);
    return 'No description available.';
  }
}
