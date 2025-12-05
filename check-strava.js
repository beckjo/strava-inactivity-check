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
// 2) Strava Aktivitäten holen
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
async function generate
