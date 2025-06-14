const CLIENT_ID = Bun.env.TWITCH_CLIENT_ID || "";
const CLIENT_SECRET = Bun.env.TWITCH_CLIENT_SECRET || "";
// const BROADCASTER_ID = '57105861';
const BROADCASTER_ID = "834020615";
const CHANNEL_NAME = "guibelorgulloperuano";

/// TESTING SHIT

async function getAccessToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  const data: any = await res.json();
  return data.access_token;
}

async function subscribeToStreamOnline(sessionId: any, token: any) {
  const res = await fetch(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "stream.online",
        version: "1",
        condition: {
          broadcaster_user_id: BROADCASTER_ID,
        },
        transport: {
          method: "websocket",
          session_id: sessionId,
        },
      }),
    }
  );

  const json: any = await res.json();

  if (!res.ok) {
    throw new Error(`Error al suscribirse: ${JSON.stringify(json)}`);
  }

  await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "stream.offline",
      version: "1",
      condition: {
        broadcaster_user_id: BROADCASTER_ID,
      },
      transport: {
        method: "websocket",
        session_id: sessionId,
      },
    }),
  });

  console.log("📨 Suscripción creada:", json.data[0].id);
}

function startWebSocket(token: any) {
  const ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

  ws.addEventListener("open", () => {
    checkIfStreamIsOnline(token);
    console.log("🔄 WebSocket reconectado.");
  });

  ws.addEventListener("message", async (data: any) => {
    const msg = JSON.parse(data);
    console.log("📡 Mensaje recibido:", msg);
    const type = msg.metadata?.message_type;

    if (type === "session_welcome") {
      const sessionId = msg.payload.session.id;
      console.log("🟢 Session ID:", sessionId);
      await subscribeToStreamOnline(sessionId, token);
    }

    if (type === "notification") {
      const event = msg.payload.event;
      console.log(
        `🎥 ${event.broadcaster_user_login} está en vivo. Empezó a las ${event.started_at}`
      );
    }

    if (type === "session_keepalive") {
      console.log("📶 Keepalive recibido.");
    }

    if (type === "session_reconnect") {
      const newUrl = msg.payload.session.reconnect_url;
      console.log("🔁 Reconectando a:", newUrl);
      ws.close();
      reconnectWebSocket(newUrl, token);
    }
  });

  ws.addEventListener("close", () => console.log("❌ WebSocket cerrado."));
  ws.addEventListener("error", (err) =>
    console.error("⚠️ Error en WebSocket:", err)
  );
}

async function checkIfStreamIsOnline(token: any) {
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${BROADCASTER_ID}`,
    {
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data: any = await res.json();
  if (data.data && data.data.length > 0) {
    const stream = data.data[0];
    console.log(`🎥 El streamer ya está en vivo: ${stream.title}`);
  } else {
    console.log("❌ El streamer no está en vivo en este momento.");
  }
}

function reconnectWebSocket(url: string, token: any) {
  const ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    checkIfStreamIsOnline(token);
    console.log("🔄 WebSocket reconectado.");
  });

  ws.addEventListener("message", (data: any) => {
    const msg = JSON.parse(data);
    if (msg.metadata?.message_type === "notification") {
      const event = msg.payload.event;
      console.log(
        `🎥 ${event.broadcaster_user_login} está en vivo. Empezó a las ${event.started_at}`
      );
    }
  });

  ws.addEventListener("close", () =>
    console.log("❌ WebSocket reconectado cerrado.")
  );
  ws.addEventListener("error", (err) =>
    console.error("⚠️ Error reconexión:", err)
  );
}

(async () => {
  try {
    const token = "xrkjuqr42lqknntd0hwee3arhc6xv5";
    startWebSocket(token);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
})();

/* async function getAccessToken() {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'client_credentials',
        }),
    });

    const data = await res.json();
    return data.access_token;
}

async function getBroadcasterId(channelName, token) {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
        headers: {
            'Client-ID': CLIENT_ID,
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await res.json();

    if (data.data.length === 0) {
        throw new Error('Canal no encontrado');
    }

    const user = data.data[0];
    console.log(`✅ ${channelName} → ID: ${user.id}`);
    return user.id;
}

(async () => {
    const token = await getAccessToken();
    const broadcasterId = await getBroadcasterId(CHANNEL_NAME, token);
})(); */
