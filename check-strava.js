import fetch from "node-fetch";

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  SLACK_WEBHOOK_URL,
  DAYS_WITHOUT_ACTIVITY
} = process.env;

async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN
    })
  });
  return res.json();
}

async function getRecentActivities(accessToken) {
  const after = Math.floor(Date.now() / 1000) - DAYS_WITHOUT_ACTIVITY * 86400;

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  return res.json();
}

async function notifySlack() {
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `⚠️ Du warst seit **${DAYS_WITHOUT_ACTIVITY} Tagen** nicht auf Strava aktiv. Zeit für eine Runde! 🚴‍♂️🏃‍♂️💪`
    })
  });
}

async function main() {
  const tokenData = await getAccessToken();
  const activities = await getRecentActivities(tokenData.access_token);

  if (activities.length === 0) {
    console.log("Keine Aktivitäten → Slack Nachricht");
    await notifySlack();
  } else {
    console.log("Aktiv → keine Nachricht");
  }
}

main();
