import { CoverObject, VisualTags } from '@/types';

export function filterCandidates(
  candidates: CoverObject[],
  attribute: keyof VisualTags,
  value: string
): CoverObject[] {
  return candidates.filter((c) => {
    const tagValue = c.tags[attribute];
    if (Array.isArray(tagValue)) {
      return tagValue.includes(value);
    }
    return tagValue === value;
  });
}

export function getBestQuestion(candidates: CoverObject[], answeredAttributes: string[]) {
  const attributes: (keyof VisualTags)[] = [
    'brightness',
    'style',
    'composition',
    'mood',
    'colors',
    'objects',
  ];

  const availableAttributes = attributes.filter(
    (attr) => !answeredAttributes.includes(attr)
  );

  let bestAttr: keyof VisualTags | null = null;
  let lowestImbalance = Infinity;
  let bestValues: string[] = [];

  for (const attr of availableAttributes) {
    const counts: Record<string, number> = {};
    candidates.forEach((c) => {
      // Safety check: skip if tags are missing
      if (!c.tags) return;
      const val = c.tags[attr];
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v === 'unknown') return;
          counts[v] = (counts[v] || 0) + 1;
        });
      } else {
        if (val === 'unknown') return;
        counts[val] = (counts[val] || 0) + 1;
      }
    });

    const values = Object.keys(counts);
    // Section 8: Aim for attributes that split candidates (at least 2 distinct values)
    if (values.length < 2) continue;

    const frequencies = Object.values(counts);
    // Select attribute with lowest imbalance
    const imbalance = Math.max(...frequencies) - Math.min(...frequencies);

    // Prefer questions that have more known values
    const unknownCount = (candidates.length - frequencies.reduce((a, b) => a + b, 0));
    const score = imbalance + (unknownCount * 0.5);

    if (score < lowestImbalance) {
      lowestImbalance = score;
      bestAttr = attr;
      bestValues = values;
    }
  }

  // Only return a question if it has a chance to filter out some candidates
  return bestAttr ? { attribute: bestAttr, values: bestValues } : null;
}

export function getQuestionLabel(attribute: string, values: string[]): string {
  switch (attribute) {
    case 'brightness':
      return 'Thinking about the lighting... Was the artwork mostly dark and moody, or was it bright and clear?';
    case 'style':
      return 'What kind of art style do you remember? Was it a real photograph, or more of an illustration/abstract design?';
    case 'composition':
      return 'How were the main elements arranged? Was it a centered subject, a portrait, or more of a scattered/busy layout?';
    case 'mood':
      return 'What was the overall vibe or feeling of the cover?';
    case 'colors':
      return `I'm seeing some specific tones. Did it feature colors like ${values.slice(0, 3).join(', ')}?`;
    case 'objects':
      return `Do you recall seeing any specific objects, like a ${values[0]}?`;
    default:
      return `Tell me more about the visual ${attribute} of the cover.`;
  }
}

export function getAnswerLabel(attribute: string, value: string): string {
  const labels: Record<string, Record<string, string>> = {
    brightness: {
      dark: "Mostly dark/moody",
      bright: "Bright and clear"
    },
    style: {
      photograph: "Real photograph",
      illustration: "Drawn or illustrated",
      abstract: "Abstract or patterns"
    },
    composition: {
      centered: "Subject in the center",
      portrait: "A close-up portrait",
      scattered: "Busy or scattered"
    }
  };
  
  return labels[attribute]?.[value] || value.charAt(0).toUpperCase() + value.slice(1);
}
