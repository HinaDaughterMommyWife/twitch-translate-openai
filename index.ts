import tmi from "tmi.js";
import { createServer } from "http";
import OpenAI from "openai";
import {
  colorLog,
  filteredMessage,
  getEmotes,
  getGlobalEmotes,
  readToken,
  saveToken,
} from "./utils";
import { readFileSync } from "fs";
import path from "path/posix";
import pino from "pino";
import PinoPretty from "pino-pretty";

const TWITCH_BOT_USERNAME =
  Bun.env.TWITCH_BOT_USERNAME || "comomegustapadreball";
const TWITCH_CHANNEL = Bun.env.TWITCH_LISTENING_CHANNEL || "thedarkraimola";
const TARGET_USER = Bun.env.TWITCH_TARGET_USERNAME || "guibelorgulloperuano";

const TWITCH_CLIENT_ID = Bun.env.TWITCH_CLIENT_ID as string;
const TWITCH_CLIENT_SECRET = Bun.env.TWITCH_CLIENT_SECRET as string;
const TWITCH_REDIRECT_URI = Bun.env.TWITCH_REDIRECT_URI as string;

const TWITCH_OWNER_USERNAME =
  (Bun.env.TWITCH_OWNER_USERNAME as string) || "guibelorgulloperuano";

const OPENAI_BASE_URL =
  Bun.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY as string;

const prettyToFile = PinoPretty({
  colorize: true,
  translateTime: "SYS:standard",
  ignore: "pid,hostname",
  destination: "./twitch-bot.log",
  sync: true,
  mkdir: true,
});

const logger = pino({}, prettyToFile);

// -------------------------------------------------- //

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(
  TWITCH_REDIRECT_URI
)}&response_type=code&scope=chat:read+chat:edit`;

let twitchAccessToken = "";

let systemPrompt = "";

let FILTER_EMOTES = ["dummyEmotes"];

function redirectToAuth() {
  colorLog(`Abre esta URL para autenticar: ${authUrl}`, "WHITE");
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/callback")) {
      const urlParams = new URLSearchParams(req.url.split("?")[1]);
      const code = urlParams.get("code");

      if (!code) {
        res.end("Error: No se recibió el código de autenticación.");
        return;
      }

      const tokenRes: any = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: TWITCH_REDIRECT_URI,
        }),
      }).then((res) => res.json());

      twitchAccessToken = tokenRes.access_token;
      const refreshToken = tokenRes.refresh_token;

      saveToken({ refresh_token: refreshToken });

      colorLog("Autenticación exitosa, iniciando lectura de chat...", "GREEN");
      res.end("Autenticado correctamente, puedes cerrar esta ventana.");
      startTwitchChat();

      server.close(() => {
        colorLog("Servidor detenido.", "YELLOW");
        colorLog("¡Listo para recibir mensajes del chat!", "GREEN");
        console.log("\n");
      });
    }
  }).listen(3000);
}

// ------------------ Funciones de Twitch ----------------- //

function startTwitchChat() {
  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: TWITCH_BOT_USERNAME,
      password: `oauth:${twitchAccessToken}`,
    },
    channels: [TWITCH_CHANNEL],
  });

  client.connect();

  client.on("connected", async () => {
    try {
      const channelEmotes = await getEmotes(
        TWITCH_CHANNEL,
        twitchAccessToken,
        TWITCH_CLIENT_ID
      );
      const globalEmotes = await getGlobalEmotes(
        twitchAccessToken,
        TWITCH_CLIENT_ID
      );

      FILTER_EMOTES = [
        ...channelEmotes.map((emote: any) => emote.name),
        ...globalEmotes.map((emote: any) => emote.name),
      ];
    } catch (error) {
      colorLog("Error al obtener los emotes para filtrar:", "RED");
      console.warn(error);
      return;
    }
  });

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    // --------- Simple health check --------- //

    if (
      tags.username &&
      tags.username.toLowerCase() === TWITCH_OWNER_USERNAME.toLowerCase() &&
      message === "ඞඞ"
    ) {
      colorLog("Health check from owner", "GREEN");
      client.say(channel, "PotFriend");
      console.log("\n");
      return;
    }

    // --------------------------------------- //

    if (
      tags.username &&
      tags.username.toLowerCase() === TARGET_USER.toLowerCase()
    ) {
      logger.info(`Mensaje de ${TARGET_USER}: ${message}`);
      colorLog(`Mensaje de ${TARGET_USER}: ${message}`, "CYAN");

      let cleanedMessage = filteredMessage(message, FILTER_EMOTES);

      if (!cleanedMessage) {
        return;
      }

      const translatedMessage = await translateMessage(cleanedMessage);

      if (translatedMessage === "NO_TRANSLATE") {
        logger.warn("No se pudo traducir el mensaje:", message);
        colorLog("No se pudo traducir el mensaje.", "YELLOW");
        colorLog(`Mensaje original: ${message}`, "YELLOW");
        console.log("\n");
        return;
      }

      if (translatedMessage) {
        logger.info(`Enviando mensaje traducido: ${translatedMessage}`);
        colorLog(`Enviando mensaje: ${translatedMessage}`, "GREEN");
        console.log("\n");
        const message = `«${tags.username}»: ${translatedMessage}`;
        client.say(channel, message);
      }
    }
  });

  client.on("disconnected", () => {
    colorLog("Desconectado del chat", "YELLOW");
    process.exit(1);
  });
}

// ------------------ Funciones de OpenAI ----------------- //

interface OpenAIResponse {
  translate: string;
  success: boolean;
}

if (!OPENAI_API_KEY) {
  colorLog(
    "Por favor, asegúrate de que la variable de entorno DEEPSEEK_API_KEY esté configurada correctamente.",
    "RED"
  );
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

async function translateMessage(message: string) {
  try {
    const completion: any = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: message,
        },
      ],
      model: "deepseek-chat",
      response_format: {
        type: "json_object",
      },
      temperature: 1.3,
    });

    const response = completion.choices[0].message.content!;

    const parsedResponse: OpenAIResponse = JSON.parse(response);

    if (parsedResponse.success) {
      return parsedResponse.translate;
    }

    return "NO_TRANSLATE";
  } catch (error) {
    console.warn("Error al traducir este mensaje:", message);
    return "NO_TRANSLATE";
  }
}

// ----------------- Inicio del script ----------------- //

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_REDIRECT_URI) {
  colorLog(
    "Por favor, asegúrate de que las variables de entorno TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET y TWITCH_REDIRECT_URI estén configuradas correctamente.",
    "RED"
  );
  process.exit(1);
}

let tokenData = readToken();

try {
  systemPrompt = readFileSync(
    path.join(__dirname, "context/translate.md"),
    "utf-8"
  );
} catch (error) {
  colorLog("Error al leer el archivo de contexto:", "RED");
  process.exit(1);
}

if (tokenData && tokenData.refresh_token) {
  colorLog(
    "Refresh token encontrado, obteniendo nuevo access token...",
    "GREEN"
  );
  fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  })
    .then((res) => res.json())
    .then((tokenRes: any) => {
      if (tokenRes.access_token) {
        colorLog("Access token renovado", "GREEN");
        twitchAccessToken = tokenRes.access_token;
        startTwitchChat();
      } else {
        colorLog("Error al renovar el access token", "RED");
        redirectToAuth();
      }
    })
    .catch(() => {
      colorLog("Error al intentar renovar el access token:", "RED");
      redirectToAuth();
    });
} else {
  colorLog("No se encontró refresh token, autenticando...", "GREEN");
  redirectToAuth();
}
