import express from "express";
import { parseTask, breakdownTask, realDate, AiOutputError } from "./ai.js";

const app = express();
app.use(express.json({ limit: "20kb" }));

function sendError(err, res, rephraseMessage) {
  if (err instanceof AiOutputError) {
    return res.status(422).json({ error: rephraseMessage });
  }
  console.error(err);
  if (err.status === 429) {
    return res.status(429).json({ error: "The daily free AI quota has been reached. Try again tomorrow." });
  }
  if (err.status === 503 || err.status === 504) {
    return res.status(503).json({ error: "The AI model is slow or busy right now. Try again in a moment." });
  }
  res.status(500).json({ error: "Something went wrong. Try again in a minute." });
}

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
    sendError(err, res, "I couldn't turn that into a task. Try rephrasing, or add it by hand.");
  }
});

app.post("/api/breakdown", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "This task has no title." });
  if (title.length > 120) return res.status(400).json({ error: "That title is too long." });

  try {
    const subtasks = await breakdownTask(title);
    res.json({ subtasks });
  } catch (err) {
    sendError(err, res, "I couldn't break that down. Try again, or add steps yourself.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));