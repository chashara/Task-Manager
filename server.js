import express from "express";
import { parseTask, realDate, AiOutputError } from "./ai.js";

const app = express();
app.use(express.json({ limit: "20kb" }));

app.post("/api/parse", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  const today = String(req.body?.today ?? "");

  if (!text) return res.status(400).json({ error: "Please type a task." });
  if (text.length > 300) return res.status(400).json({ error: "That is too long. Keep it under 300 characters." });
  if (!realDate(today)) return res.status(400).json({ error: "Missing or invalid date." });

  // the categories the app already has, so the AI can pick one of them
  const categories = Array.isArray(req.body.categories)
    ? req.body.categories
        .filter((c) => typeof c === "string" && c.trim() && c.length <= 30)
        .slice(0, 20)
    : ["General"];

  try {
    const task = await parseTask(text, today, categories.length ? categories : ["General"]);
    res.json({ task });
  } catch (err) {
    if (err instanceof AiOutputError) {
      return res.status(422).json({ error: "I couldn't turn that into a task. Try rephrasing, or add it by hand." });
    }
    console.error(err);
    if (err.status === 429) {
      return res.status(429).json({ error: "The daily free AI quota has been reached. Add the task by hand, or try again tomorrow." });
    }
    if (err.status === 503) {
      return res.status(503).json({ error: "The AI model is busy right now. Try again in a moment." });
    }
    res.status(500).json({ error: "Something went wrong. Try again in a minute." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));