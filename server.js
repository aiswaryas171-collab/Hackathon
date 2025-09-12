import express from "express";
import zlib from "zlib";

const app = express();
app.use(express.json({ limit: "2mb" })); // allow larger payloads

// API endpoint
app.post("/api/data", (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ error: "No payload provided" });
    }

    // decode + decompress
    const buffer = Buffer.from(payload, "base64");
    const decompressed = zlib.inflateSync(buffer).toString("utf8");
    const obj = JSON.parse(decompressed);

    console.log("✅ Received:", obj);

    res.json({ status: "ok", received: obj });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(400).json({ error: "Invalid compressed payload" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
