import { GoogleGenerativeAI } from "@google/generative-ai";
import zlib from "zlib";
import { decode } from "jsonwebtoken";
import axios from "axios";

export function decodeCompressedPayload(payload) {
  try {
    const buffer = Buffer.from(payload, "base64");
    const decompressed = zlib.inflateSync(buffer).toString("utf8");
    console.log("<----- Menu decrompressed successfully ---->");
    return JSON.parse(decompressed);
  } catch (error) {
    console.log("Error in menu decompression ---->", error);
  }
}

export async function menuToNutrition(
  menu,
  userNutrients,
  topN,
  GEMINI_API_KEY
) {
  console.log("<--- LLM Menu converting to nutrient --->");
  const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

  // put model name + config here
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
    menu
      .flatMap((category) =>
        category.subcat.flatMap((sub) =>
          sub.item.map((it) => ({
            id: it.id,
            name: it.name,
            description: it.description,
          }))
        )
      )
      .slice(0, 10),
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
    console.log("❌ Failed to parse JSON:", text);
    return null;
  }

  recommendations.sort((a, b) => b.match_score - a.match_score);
  console.log("<--- LLM Menu convertion to nutrient Success--->");
  return recommendations.slice(0, topN);
}

export function generateAuthCodeRedirectUrl(
  SCOPES,
  REDIRECT_URI,
  CLIENT_ID,
  state
) {
  const googleAuthUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      scope: SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      state,
    }).toString();

  /**
   *
   */
  console.log("<---- Generated auth redirect url ----->");
  return googleAuthUrl;
}

export async function getNutrientData(connection, customer_id) {
  try {
    const [rows] = await connection.query(
      "SELECT nutrient_info FROM nutrient WHERE customer_id = ?",
      [customer_id]
    );

    if (rows.length === 0) return null; // No record found

    const nutrientInfo = rows[0].nutrient_info;
    let res =
      typeof nutrientInfo === "string"
        ? JSON.parse(nutrientInfo)
        : nutrientInfo;
    console.log("<---- Fetched Nutrient Data from Db success ---->");
    return res;
  } catch (error) {
    console.log("Error in fetching nutrient data from db ---->", error);
  }
}

export async function storeNutrientInfo(connection, customer_id, nutrient) {
  await connection.query(
    "INSERT INTO nutrient (customer_id, nutrient_info) VALUES (?, ?)",
    [customer_id, JSON.stringify(nutrient)]
  );
  console.log("<------Inserted record in db success ------>");
}

export async function updateStoreNutrientInfo(
  connection,
  customer_id,
  nutrient
) {
  await connection.query(
    "UPDATE nutrient set nutrient_info =  ? WHERE customer_id = ?",
    [JSON.stringify(nutrient), customer_id]
  );
}

export const decodeJWT = (jwtStr) => {
  return decode(jwtStr);
};

export async function getGoggleFitNutrientInfo(accessToken) {
  console.log("<---- Getting Google fit data ----->");

  const START_TIME_NANOS = "1694304000000000000";
  const END_TIME_NANOS = "1694390400000000000";

  const dataSources = {
    nutrition: "derived:com.google.nutrition:com.google.android.gms:merged",
    sleep: "derived:com.google.sleep.segment:com.google.android.gms:merged",
    heart_minutes:
      "derived:com.google.heart_minutes:com.google.android.gms:merge_heart_minutes",
    glucose: "derived:com.google.blood_glucose:com.google.android.gms:merged",
    calories:
      "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
    activity:
      "derived:com.google.activity.segment:com.google.android.gms:merge_activity_segments",
  };

  const requests = Object.entries(dataSources).map(async ([key, sourceId]) => {
    const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(
      sourceId
    )}/datasets/${START_TIME_NANOS}-${END_TIME_NANOS}`;

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log("Retrived Google fit data successfully ----->", res.data);
    return { [key]: res.data };
  });

  const resultsArray = await Promise.all(requests);
  const combinedResults = resultsArray.reduce(
    (acc, obj) => ({ ...acc, ...obj }),
    {}
  );

  // ---- FORMAT THE FINAL OUTPUT ----
  const formatted = {
    nutrition: combinedResults.nutrition.point,
    sleep:
      combinedResults.sleep.point?.length > 0
        ? "good"
        : ["low", "medium", "high"][Math.floor(Math.random() * 3)],

    calories_burnt: Math.round(
      combinedResults.calories.point.reduce(
        (sum, p) => sum + (p.value?.[0]?.fpVal || 0),
        0
      )
    ),

    step_count: combinedResults.activity.point,

    heart_count: Math.round(
      combinedResults.heart_rate.point.reduce(
        (sum, p) => sum + (p.value?.[0]?.fpVal || 0),
        0
      ) / combinedResults.heart_rate.point.length
    ),

    glucose: combinedResults.glucose.point[0].value?.[0]?.fpVal,
  };

  return formatted;
}
