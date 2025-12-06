import fetch from "node-fetch";

// 🟢 Randomisierte Motivationssprüche
const messages = [
  "Zeit, wieder anzugreifen! 💥",
  "Nur du kannst die Schweinehunde besiegen! 🐶💪",
  "Der nächste Sieg wartet nicht auf dich – also los! 🏁",
  "Ein Schritt, eine Kurbelumdrehung, ein Erfolg näher! 🚴‍♂️🔥",
  "Heute ist ein guter Tag, um stärker zu werden! 💪"
];

// 🟦 Trainingsbezogene GIF-Suche (Giphy)
async function getTrainingGif() {
  try {
    const apiKey = "dc6zaTOxFJmzC"; // public beta key
    const tags = ["fitness", "workout", "training", "motivation", "gym"];
    const tag = tags[Math.floor(Math.random() * tags.length)];

    const url = `https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${tag}`;
    const res = await fetch(url);
    const json = await res.json();

    return json?.data?.images?.downsized_large?.url || null;
  } catch (err) {
    console.error("❌ Fehler beim GIF laden:", err);
    return null;
  }
}

// 🟧 Slack Nachricht senden
async function sendSlackMessage(text, gifUrl = null) {
  const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text }
    }
  ];

  if (gifUrl) {
    blocks.push({
      type: "image",
      image_url: gifUrl,
      alt_text: "Motivation"
    });
  }

  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks })
  });

  console.log("📨 Slack Nachricht gesendet!");
}

// 🟥 Strava prüfen
async function checkStrava() {
  console.log("🔄 Strava Access Token abrufen …");

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.STRAVA_REFRESH_TOKEN
    })
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("❌ Fehler Token:", tokenData);
    return;
  }

  const accessToken = tokenData.access_token;

  console.log("📡 Aktivitäten prüfen …");

  const activitiesUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=1`;

  const activitiesResponse = await fetch(activitiesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  let activities;

  try {
    activities = await activitiesResponse.json();
  } catch (err) {
    console.error("❌ Fehler JSON:", err);
    return;
  }

  // API Fehler →
  if (activities?.errors) {
    console.error("❌ Strava API Error:", activities);
    await sendSlackMessage(
      "⚠️ *Strava API Fehler!* Kann Aktivitäten nicht abrufen."
    );
    return;
  }

  // Keine Aktivitäten →
  if (!Array.isArray(activities) || activities.length === 0) {
    console.log("⚠️ Keine Aktivitäten gefunden.");
    await sendSlackMessage("⚠️ *Keine Strava-Aktivitäten gefunden!* Bitte Token prüfen!");
    return;
  }

  const last = activities[0];

  if (!last?.start_date) {
    console.log("⚠️ Ungültige Strava-Daten.");
    await sendSlackMessage("⚠️ *Ungültige Daten von Strava!* Kann Datum nicht lesen.");
    return;
  }

  const lastDate = new Date(last.start_date);
  const now = new Date();

  const diffMs = now - lastDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const daysText = diffDays === 1 ? "1 Tag" : `${diffDays} Tagen`;

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  const gifUrl = await getTrainingGif();

  const messageText = `*🏋️‍♂️ Keine Aktivität seit ${daysText}!*  
${randomMessage}

:reißzwecke: Also los, alles liegen lassen – <https://goldinteractive.mocoapp.com/activities|Arbeiten beenden>`;

  await sendSlackMessage(messageText, gifUrl);
}

checkStrava();
