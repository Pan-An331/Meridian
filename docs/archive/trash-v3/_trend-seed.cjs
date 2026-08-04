const fs = require("fs");
const cookie = fs.readFileSync("/tmp/trend-cookies.txt", "utf8").split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("\t").pop()).filter(Boolean).join("; ");

const items = [
  ["上周考研英语", "learning", "考研", "2026-07-29T09:00:00", "2026-07-29T10:00:00"],
  ["上周电赛", "practice", "竞赛", "2026-07-31T14:00:00", "2026-07-31T16:00:00"],
  ["本周考研高数", "learning", "考研", "2026-08-03T09:00:00", "2026-08-03T10:30:00"],
  ["本周考研线代", "learning", "考研", "2026-08-05T09:00:00", "2026-08-05T10:00:00"],
  ["本周健身", "health", "身材", "2026-08-07T08:00:00", "2026-08-07T09:00:00"],
];

(async () => {
  for (const [title, cat, theme, start, end] of items) {
    const r = await fetch("http://localhost:3000/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ title, taskType: "scheduled", category: cat, theme, startTime: start, endTime: end }),
    });
    console.log(title, "->", r.status);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
