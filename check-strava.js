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
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN,
    }),
  });

  const json = await response.json();
  if (!json.access_token) {
    console.error("❌ Fehler beim Holen eines neuen Access Tokens:", json);
    throw new Error("Strava Token Error");
  }

  return json.access_token;
}

// -------------------------------------------------------
// 2) Letzte Strava-Aktivitäten holen
// -------------------------------------------------------
async function getActivities(accessToken, afterDays) {
  const now = Math.floor(Date.now() / 1000);
  const after = now - afterDays * 24 * 60 * 60;

  const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
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
Ton: locker, motivierend, maximal 1–2 Sätze.
  `;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

  const json = await response.json();

  if (!json.choices) {
    console.error("❌ GPT Fehler:", json);
    return "Zeit, wieder in die Gänge zu kommen! 💪";
  }

  return json.choices[0].message.content.trim();
}

// -------------------------------------------------------
// 4) Slack-Nachricht senden
// -------------------------------------------------------
async function sendSlackMessage(text) {
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------
async function main() {
  try {
    console.log("🔄 Hole Strava Access Token …");
    const token = await getAccessToken();

    console.log("📡 Hole Aktivitäten …");
    const activities = await getActivities(token, DAYS);

    console.log("➡ Aktuelle Aktivitäten:", activities);

    if (activities.length > 0) {
      console.log("✅ Es gab eine Aktivität → Keine Slack Nachricht.");
      return;
    }

    console.log("⚠️ Keine Aktivität gefunden → Sende Slack Nachricht.");

    // Letzte Aktivität holen (unabhängig vom Zeitraum)
    const lastActivityResponse = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=1",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const lastList = await lastActivityResponse.json();
    const last = lastList[0];

    // Dynamische Berechnung der Tage seit letzter Aktivität
    let daysSinceLast = DAYS;
    let lastDate = new Date();
    if (last) {
      lastDate = new Date(last.start_date);
      const now = new Date();
      const diffMs = now - lastDate;
      daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const dayText = daysSinceLast === 1 ? "Tag" : "Tage";

    // GPT-Motivation
    const motivation = await generateMotivation(last?.name ?? "Training", daysSinceLast);

    // Nachricht formatieren
    const formatted = `
*Keine Aktivität seit ${daysSinceLast} ${dayText}!* 😴

*Letzte Aktivität:*  
• ${last?.name ?? "–"}  
• ${last ? (last.distance / 1000).toFixed(1) + " km" : "-"}  
• ${last ? Math.round(last.moving_time / 60) + " min" : "-"}  
• am ${lastDate.toLocaleString("de-CH")}

_${motivation}_
    `;

    await sendSlackMessage(formatted);

    console.log("📨 Slack-Nachricht gesendet!");

  } catch (err) {
    console.error("❌ Fehler:", err);
  }
}

main();
