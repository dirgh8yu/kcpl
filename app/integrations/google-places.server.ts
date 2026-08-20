const GOOGLE_PLACES_AUTOCOMPLETE_ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

export type GooglePlaceSuggestion = {
  place_id: string;
  text: string;
  main_text: string;
  secondary_text: string;
  types: string[];
};

type GooglePlacesResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
};

export class GooglePlacesConfigurationError extends Error {
  constructor() {
    super("Google Places API is not configured for this deployment.");
    this.name = "GooglePlacesConfigurationError";
  }
}

function cleanInput(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 180);
}

export async function autocompleteGooglePlaces(input: string): Promise<GooglePlaceSuggestion[]> {
  const apiKey = process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim();
  if (!apiKey) throw new GooglePlacesConfigurationError();

  const query = cleanInput(input);
  if (query.length < 3) return [];

  const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
        "suggestions.placePrediction.types",
      ].join(","),
    },
    body: JSON.stringify({
      input: query,
      languageCode: "en",
      // Prefer KCPL's Nepal/India operating corridor without excluding global
      // origins or destinations. locationBias can still return results outside
      // this rectangle when the typed query clearly points elsewhere.
      locationBias: {
        rectangle: {
          low: { latitude: 6.5, longitude: 68.0 },
          high: { latitude: 35.8, longitude: 97.5 },
        },
      },
    }),
  });

  let payload: GooglePlacesResponse;
  try {
    payload = await response.json() as GooglePlacesResponse;
  } catch {
    throw new Error(`Google Places returned HTTP ${response.status} with a non-JSON response.`);
  }

  if (!response.ok) {
    const detail = payload.error?.message?.trim();
    throw new Error(detail || `Google Places returned HTTP ${response.status}.`);
  }

  return (payload.suggestions ?? [])
    .map((item) => item.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId && prediction.text?.text))
    .slice(0, 5)
    .map((prediction) => ({
      place_id: prediction.placeId!,
      text: prediction.text!.text!.trim(),
      main_text: prediction.structuredFormat?.mainText?.text?.trim() || prediction.text!.text!.trim(),
      secondary_text: prediction.structuredFormat?.secondaryText?.text?.trim() || "",
      types: Array.isArray(prediction.types) ? prediction.types.filter((item): item is string => typeof item === "string") : [],
    }));
}
