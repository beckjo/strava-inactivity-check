import fetch from "node-fetch";

// -------------------------------------------------------
// CONFIG
// -------------------------------------------------------
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const DAYS = parseInt(process.env.DAYS_WITHOUT_ACTIVITY || "5", 10);

// -------------------------------------------------------
// 1) Strava Access Token aktualisieren
// -------------------------------------------------------
async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    console.error("❌ Strava Token Error:", data);
    throw new Error("Strava Token konnte nicht abgerufen werden");
  }
  return data.access_token;
}

// -------------------------------------------------------
// 2) Letzte Strava-Aktivitäten holen
// -------------------------------------------------------
async function getActivities(accessToken, afterDays) {
  const now = Math.floor(Date.now() / 1000);
  const after = now - afterDays * 24 * 60 * 60;
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  return data;
}

// -------------------------------------------------------
// 3) GPT generiert Motivationsnachricht
// -------------------------------------------------------
async function generateMotivation(activityName, days) {
  const prompt = `
Du bist ein motivierender Sport-Coach.
Erzeuge eine kurze, peppige Motivationsnachricht auf Deutsch.
Kontext:
- letzte Aktivität: "${activityName}"
- Tage ohne Training: ${days}
Ton: locker, motivierend, 1–2 Sätze.
  `;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0.9,
    }),
  });

  const data = await res.json();
  if (!data.choices) return "Zeit, wieder in die Gänge zu kommen! 💪";
  return data.choices[0].message.content.trim();
}

// -------------------------------------------------------
// 4) Slack Nachricht mit Blocks senden
// -------------------------------------------------------
async function sendSlackMessageBlocks(last, daysSinceLast, motivation) {
  const dayText = daysSinceLast === 1 ? "Tag" : "Tage";

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `⚠️ *Keine Aktivität seit ${daysSinceLast} ${dayText}!*` } },
    { type: "divider" },
  ];

  if (last) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Letzte Aktivität:*\n• *Name:* ${last.name}\n• *Distanz:* ${(last.distance/1000).toFixed(1)} km\n• *Dauer:* ${Math.round(last.moving_time/60)} min\n• *Datum:* ${new Date(last.start_date).toLocaleString("de-CH")}`
      }
    });
  } else {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Keine vorherige Aktivität gefunden._" } });
  }

  blocks.push({ type: "divider" });
  blocks.push({ type: "section", text: { type: "mrkdwn", text: `💬 _${motivation}_` } });

  await fetch(SLACK_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks }) });
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------
async function main() {
  try {
    console.log("🔄 Strava Access Token abrufen …");
    const token = await getAccessToken();

    console.log("📡 Aktivitäten prüfen …");
    const activities = await getActivities(token, DAYS);

    if (activities.length > 0) {
      console.log("✅ Aktivität gefunden → keine Nachricht nötig.");
      return;
    }

    console.log("⚠️ Keine Aktivität → sende Slack Nachricht.");

    // Letzte Aktivität unabhängig vom Zeitraum holen
    const lastRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=1", { headers: { Authorization: `Bearer ${token}` } });
    const lastList = await lastRes.json();
    const last = lastList[0];

    // Tage seit letzter Aktivität berechnen
    let daysSinceLast = DAYS;
    let lastDate = new Date();
    if (last) {
      lastDate = new Date(last.start_date);
      const diffMs = new Date() - lastDate;
      daysSinceLast = Math.max(1, Math.floor(diffMs / (1000*60*60*24))); // min. 1 Tag
    }

    const motivation = await generateMotivation(last?.name ?? "Training", daysSinceLast);

    await sendSlackMessageBlocks(last, daysSinceLast, motivation);
    console.log("📨 Slack Nachricht gesendet!");

  } catch (err) {
    console.error("❌ Fehler:", err);
    process.exit(1); // sorgt dafür, dass GitHub Actions als "failed" markiert wird
  }
}

main();
