import fetch from "node-fetch";

// --------------------------
// GitHub Secrets als Env
// --------------------------
const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  SLACK_WEBHOOK_URL,
  DAYS_WITHOUT_ACTIVITY = 5
} = process.env;

// --------------------------
// Zufällige Motivationsnachrichten
// --------------------------
const motivationalMessages = [
  "Deine Beine vermissen dich! 🏃‍♂️",
  "Heute laufen wir nicht – wir fliegen! 💨",
  "Muskelalarm! 💪 Zeit, sie wieder zu wecken!",
  "Lass die Couch nicht gewinnen! 🛋️💥",
  "Ab auf die Strecke – die Kilometer warten! 🏞️",
  "Zeig deinem inneren Schweinehund, wer Boss ist! 🐷➡️💪",
  "Zeit für Bewegung! Dein Körper sagt danke! 🙌",
  "Rekorde brechen oder einfach Spaß haben – los geht’s! ⚡",
  "Jede Bewegung zählt – also los! 🔥",
  "Laufen, rollen, strampeln – Hauptsache aktiv! 🚴‍♀️"
];

// Zusätzliche kleine Emojis / Variationen
const emojiExtras = ["✨", "🌟", "⚡", "🔥", "💨", "💪", "🏃‍♂️", "🏃‍♀️"];

// --------------------------
// Zufällige Auswahl
// --------------------------
function getRandomMotivation() {
  const idx = Math.floor(Math.random() * motivationalMessages.length);
  const emoji = emojiExtras[Math.floor(Math.random() * emojiExtras.length)];
  return `${motivationalMessages[idx]} ${emoji}`;
}

// --------------------------
// Strava Access Token abrufen
// --------------------------
async function getAccessToken() {
  console.log("🔄 Strava Access Token abrufen …");
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token: STRAVA_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });

  const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    body: params
  });

  const data = await res.json();
  if (data.access_token) {
    return data.access_token;
  } else {
    console.error("❌ Fehler beim Abrufen des Access Tokens", data);
    return null;
  }
}

// --------------------------
// Letzte Aktivitäten abrufen
// --------------------------
async function getLastActivity(token) {
  console.log("📡 Aktivitäten prüfen …");
  const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=1", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const activities = await res.json();
  return activities.length > 0 ? activities[0] : null;
}

// --------------------------
// Slack Nachricht senden
// --------------------------
async function sendSlackMessage(lastActivity, daysSinceLast) {
  const motivation = getRandomMotivation();
  const mocoLink = "https://goldinteractive.mocoapp.com/activities";

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `⚠️ *Keine Aktivität seit ${daysSinceLast} Tagen!*` } },
    { type: "divider" }
  ];

  if (lastActivity) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Letzte Aktivität:*\n• *Name:* ${lastActivity.name}\n• *Distanz:* ${(lastActivity.distance/1000).toFixed(1)} km\n• *Dauer:* ${Math.round(lastActivity.moving_time/60)} min\n• *Datum:* ${new Date(lastActivity.start_date).toLocaleString("de-CH")}`
      }
    });
    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `💬 _${motivation}_\n\n📌 Also los, alles liegen lassen – [Arbeit beenden](${mocoLink})`
    }
  });

  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks })
  });

  if (res.ok) {
    console.log("📨 Slack Nachricht gesendet!");
  } else {
    console.error("❌ Slack Nachricht konnte nicht gesendet werden:", await res.text());
  }
}

// --------------------------
// Main
// --------------------------
(async () => {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const lastActivity = await getLastActivity(token);
    const now = new Date();
    const lastDate = lastActivity ? new Date(lastActivity.start_date) : null;
    const diffDays = lastDate ? Math.floor((now - lastDate) / (1000*60*60*24)) : Infinity;

    if (diffDays >= DAYS_WITHOUT_ACTIVITY) {
      console.warn("⚠️ Keine Aktivität → sende Slack Nachricht.");
      await sendSlackMessage(lastActivity, diffDays);
    } else {
      console.log(`✅ Aktivität innerhalb der letzten ${DAYS_WITHOUT_ACTIVITY} Tage vorhanden.`);
    }
  } catch (e) {
    console.error("❌ Fehler im Script:", e);
  }
})();
