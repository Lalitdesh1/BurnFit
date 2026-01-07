
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, DailyStats } from "./types";

// Always use the recommended naming and parameter object for initialization.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIResponse = async (
  profile: UserProfile,
  stats: DailyStats,
  history: { role: 'user' | 'model'; text: string }[],
  userMessage: string
) => {
  // Use 'gemini-3-pro-preview' for tasks requiring complex reasoning over personal health data.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      ...history.map(h => ({ role: h.role as 'user' | 'model', parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: userMessage }] }
    ],
    config: {
      systemInstruction: `You are BurnFit AI Coach, powered by Google Health Memories. 
      You have access to the user's historical fitness data.
      The user is ${profile.age} years old, ${profile.height}cm, ${profile.weight}kg, with a goal to ${profile.goal} weight.
      DIETARY PREFERENCE: The user follows a ${profile.dietaryPreference} diet. 
      IMPORTANT: Only suggest ${profile.dietaryPreference === 'vegetarian' ? 'vegetarian (no meat/fish)' : 'protein-rich (can include meat/fish)'} meal options if food is mentioned.
      
      Today: Eaten ${stats.intake} kcal, Burned ${stats.burned} kcal. Target: ${profile.dailyTarget} kcal.
      
      Personality:
      - Supportive, expert, and deeply integrated with their health history.
      - Mention that you are analyzing their "Google Health Memories" to provide better advice.
      - Friendly and motivational.
      - Keep responses short and actionable (max 3 sentences).`,
      temperature: 0.7,
    }
  });

  // Extract generated text using the .text property.
  return response.text || "I've analyzed your memories and I'm ready to help! Let's stay active.";
};

export const getFixMyDaySuggestion = async (
  profile: UserProfile,
  stats: DailyStats
) => {
  const prompt = `Based on your Google Health data and ${profile.dietaryPreference} dietary preference: Intake ${stats.intake}, Burned ${stats.burned}, Goal ${profile.dailyTarget}. Give me one simple action or meal suggestion.`;

  // Use 'gemini-3-flash-preview' for simple, quick suggestions.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: `You are BurnFit Coach. Access Google Health Memories. 
      The user is ${profile.dietaryPreference}. If suggesting food, it MUST be ${profile.dietaryPreference}.
      Provide exactly one supportive, brief activity or meal suggestion.`,
      temperature: 0.8,
    }
  });

  return response.text || "Take a 5-minute breather and a walk around the block!";
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string) => {
  // Multimodal request: sending image and text parts.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: mimeType } },
        { text: "Identify this food and estimate calories. Return JSON with 'foodName' and 'estimatedCalories'." }
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          estimatedCalories: { type: Type.NUMBER },
        },
        required: ["foodName", "estimatedCalories"],
      },
    },
  });

  try {
    const text = response.text?.trim() || "{}";
    return JSON.parse(text);
  } catch (e) {
    return { foodName: "Unknown Dish", estimatedCalories: 0 };
  }
};

export const estimateCaloriesFromText = async (foodDescription: string) => {
  // Text-based JSON response request with responseSchema.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: `Estimate calories for: "${foodDescription}". Return JSON with 'estimatedCalories'.` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          estimatedCalories: { type: Type.NUMBER },
        },
        required: ["estimatedCalories"],
      },
    },
  });

  try {
    const text = response.text?.trim() || "{}";
    return JSON.parse(text);
  } catch (e) {
    return { estimatedCalories: 0 };
  }
};
