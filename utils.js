import { GoogleGenerativeAI } from "@google/generative-ai";
import zlib from "zlib";

export function decodeCompressedPayload(payload) {
  const buffer = Buffer.from(payload, "base64");
  const decompressed = zlib.inflateSync(buffer).toString("utf8");
  return JSON.parse(decompressed);
}

export async function menuToNutrition(menu, userNutrients, topN) {
  const GEMINI_API_KEY = "AIzaSyDMYbV8kjvSEUyQTCfCd-Bmfmhg-b45wfE";
  const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

  //   put model name + config here
  const model = ai.getGenerativeModel({
    model: "gemini-1.5-flash", // or gemini-1.5-pro
    generationConfig: {
      temperature: 0.4,
    },
  });

  const prompt = `
    You are a nutrition assistant.
    User profile:
    ${JSON.stringify(userNutrients, null, 2)}
    
    Menu items:
    ${JSON.stringify(
      menu.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
      })),
      null,
      2
    )}
    
    Return JSON array with: {id, name, benefit, match_score (0-100)}.
      `;

  // call with plain string, no extra options
  const result = await model.generateContent(prompt);

  const text = result.response
    .text()
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let recommendations;
  try {
    recommendations = JSON.parse(text);
  } catch (e) {
    console.error("❌ Failed to parse JSON:", text);
    return [];
  }

  recommendations.sort((a, b) => b.match_score - a.match_score);
  return recommendations.slice(0, topN);
}
