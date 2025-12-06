import fetch from "node-fetch";

// -----------------------------
// Random Motivationsnachrichten
// -----------------------------
const messages = [
  "🔥 Zeit, den inneren Schweinehund zu pulverisieren!",
  "🚀 Heute ist ein guter Tag für ein richtig starkes Workout!",
  "💪 Dein zukünftiges Ich wird dir danken!",
  "🏃‍♂️ Schuhe binden, rausgehen, Gas geben!",
  "⚡ Jede Einheit zählt – heute besonders!",
  "✨ Fortschritt beginnt genau jetzt."
];

// -----------------------------------
// Random trainingsbezogenes GIF holen
// -----------------------------------
async function getTrainingGif() {
  const tags = ["workout", "fitness", "running", "gym", "training", "exercise"];
  const randomTag = tags[Math.floor(Math.random() * tags.length)];

  const url = `https://api.giphy.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=${randomTag}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data?.data?.images?.original?.url) {
      return data.data.images.original.url;
    }
  } catch (e) {
    console.error("GIF Fehler:", e);
  }

  // Fallback GIF
  return "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif";
}

// ----------------------------------------------
// Strava-Aktivitäten laden & Inaktivität prüfen
// ----------------------------------------------
async function checkStrava() {
  const STRAVA_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
  const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

  const activitiesUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=1`;

  const activitiesResponse = await fetch(activitiesUrl, {
    headers: { Authorization: `Bearer ${STRAVA_TOKEN}` }
  });

  const activities = await activitiesResponse.json();
  const last = activities[0];

  const lastDate = new Date(last.start_date);
  const now = new Date();
  const diffMs = now - lastDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const daysText = diffDays === 1 ? "1 Tag" : `${diffDays} Tagen`;

  // Motivationsspruch
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  // GIF abrufen
  const gifUrl = await getTrainingGif();

  // Slack Nachricht
  const slackBody = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*🏋️‍♂️ Keine Aktivität seit ${daysText}!*  
${randomMessage}

:reißzwecke: Also los, alles liegen lassen – <https://goldinteractive.mocoapp.com/activities|Arbeiten beenden>`
        }
      },
      {
        type: "image",
        image_url: gifUrl,
        alt_text: "Motivation GIF"
      }
    ]
  };

  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slackBody)
  });

  console.log("📨 Slack Nachricht gesendet!");
}

checkStrava();
