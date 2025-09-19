/**
 * Need to update before demo
 * 1. AI api key
 * 2. Access key default
 */

import express from "express";
import mysql from "mysql2/promise";
import axios from "axios";
import {
  menuToNutrition,
  decodeCompressedPayload,
  getNutrientData,
  generateAuthCodeRedirectUrl,
  decodeJWT,
  getGoggleFitNutrientInfo,
  storeNutrientInfo,
} from "./utils.js";
// const GEMINI_API_KEY = "AIzaSyDMYbV8kjvSEUyQTCfCd-Bmfmhg-b45wfE";
const GEMINI_API_KEY = "AIzaSyD1eDLzrfY2bP5BrTTjoP0Iy-9c6q1Y2Og";
const app = express();
const topMenuCount = 5;
app.use(express.json({ limit: "2mb" })); // allow larger payloads

// MySQL connection
const pool = mysql.createPool({
  host: "mysql-19a101e6-blkannan2001-b108.g.aivencloud.com",
  port: "26960",
  user: "avnadmin",
  password: "AVNS_35h45hWM558rOQJ6cSm",
  database: "defaultdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

//call from UI
app.post("/menu", async (req, res) => {
  try {
    // console.log("Menu Body----->", JSON.stringify(req.body));
    // console.log("Menu Querystring--->:", req.body);
    // console.log("Menu Response--->:", res);

    const { payload } = req.body;
    const state = req.query?.state;
    const jwtPayload = decodeJWT(state);
    const customer_id = jwtPayload?.sub;
    console.log("Customer ID:", customer_id);

    if (!payload) {
      return res.status(400).json({ error: "No payload provided" });
    }

    //get menu from UI and decompress it
    const menu = decodeCompressedPayload(req.body.payload);

    //get nutrient data from db
    let userNutrientData = await getNutrientData(pool, customer_id);

    //convert menu to nutrient
    let nutrientMenu;
    try {
      nutrientMenu = await menuToNutrition(
        menu,
        userNutrientData,
        topMenuCount,
        GEMINI_API_KEY
      );
    } catch (err) {
      console.log("Error in llm menu converstion:", err);
    }

    res.json({ status: "success", data: nutrientMenu });
  } catch (err) {
    console.log("Whole menu Error:", err);
    return res.status(400).json({ error: err.message });
  }
});

app.get("/auth", async (req, res) => {
  const CLIENT_ID =
    "970816301355-sdsarnnt91nrndcarg6jvf9gsd78t6t2.apps.googleusercontent.com";
  const CLIENT_SECRET = "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";
  const REDIRECT_URI = "https://bac613105882.ngrok-free.app/auth";
  const SCOPES = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.nutrition.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.blood_pressure.read",
    "https://www.googleapis.com/auth/fitness.blood_glucose.read",
  ];

  console.log("Auth query--->", req.query);
  const code = req.query?.code;
  const state = req.query?.state;
  const jwtPayload = decodeJWT(state);
  const customer_id = jwtPayload?.sub;
  if (code && state) {
    try {
      const params = new URLSearchParams();
      params.append("code", code);
      params.append("client_id", CLIENT_ID);
      params.append("client_secret", CLIENT_SECRET);
      params.append("redirect_uri", REDIRECT_URI);
      params.append("grant_type", "authorization_code");

      const response = await axios.post(
        "https://oauth2.googleapis.com/token",
        params,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      console.log("<----- Access token generated successfully ----->");
      //get nutrient data from db
      let userNutrientData = await getNutrientData(pool, customer_id);

      //if data not in db get from google fit and insert in db
      if (!userNutrientData) {
        userNutrientData = await getGoggleFitNutrientInfo(
          response?.data?.access_token
        );
        await storeNutrientInfo(pool, customer_id, userNutrientData);
      }

      return res.redirect(302, `http://localhost:8080/location/london/EC1A2AT`);
    } catch (error) {
      return res
        .status(400)
        .json({ error: error.response?.data || error.message });
    }
  }
  const location = generateAuthCodeRedirectUrl(
    SCOPES,
    REDIRECT_URI,
    CLIENT_ID,
    state
  );
  console.log("location ", location);
  return res.redirect(302, location);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
