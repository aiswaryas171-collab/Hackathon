import express from "express";
import { menuToNutrition, decodeCompressedPayload } from "./utils.js";

const app = express();
const topMenuCount = 5;
app.use(express.json({ limit: "2mb" })); // allow larger payloads

//call from UI
app.post("/api/data", async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ error: "No payload provided" });
    }
    //get menu from UI and decompress it
    const menu = await decodeCompressedPayload(req.body.payload);

    //TODO
    //fetch from db
    const userNutrientData = {
      steps: 8000,
      calories: 2100,
      sleep: 5,
      weight: 70,
      step_count: 7541,
    };

    //convert menu to nutrient
    const nutrientMenu = await menuToNutrition(
      menu,
      userNutrientData,
      topMenuCount
    );

    res.json({ status: "success", data: nutrientMenu });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
