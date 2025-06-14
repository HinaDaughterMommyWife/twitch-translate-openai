import fs from "fs";
import path from "path";

const tokenFilePath = path.join(__dirname, "token.json");

export function saveToken(token: any) {
  fs.writeFileSync(tokenFilePath, JSON.stringify(token), "utf8");
}

export function readToken() {
  if (fs.existsSync(tokenFilePath)) {
    const tokenData = fs.readFileSync(tokenFilePath, "utf8");
    return JSON.parse(tokenData);
  }
  return null;
}

export function filteredMessage(
  message: string,
  FILTER_EMOTES: string[]
): string {
  let filteredMessage = message
    .split(" ")
    .filter((word) => !FILTER_EMOTES.includes(word))
    .join(" ")
    .trim();

  filteredMessage = filteredMessage.replace(/(https?:\/\/[^\s]+)/g, "");
  filteredMessage = filteredMessage.replace(/(www\.[^\s]+)/g, "");
  filteredMessage = filteredMessage.replace(/([a-z]+\.+[a-z]+\.[a-z]+)/g, "");
  filteredMessage = filteredMessage.replace(/!\S+/g, "");

  filteredMessage = filteredMessage.trim();

  return filteredMessage;
}

const COLORS = {
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",
  UNDERLINE: "\x1b[4m",
  BLACK: "\x1b[30m",
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
  BG_BLACK: "\x1b[40m",
  BG_RED: "\x1b[41m",
  BG_GREEN: "\x1b[42m",
  BG_YELLOW: "\x1b[43m",
  BG_BLUE: "\x1b[44m",
  BG_MAGENTA: "\x1b[45m",
  BG_CYAN: "\x1b[46m",
  BG_WHITE: "\x1b[47m",
};

export function colorLog(text: string, color: keyof typeof COLORS): void {
  const colorCode = COLORS[color] || COLORS.RESET;
  console.log(`${colorCode}${text}${COLORS.RESET}`);
}

async function getUserId(
  username: string,
  token: string,
  TWITCH_CLIENT_ID: string
): Promise<string> {
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const resData: any = await res.json();
  if (!resData.data?.[0]) throw new Error(`User not found: ${username}`);
  return resData.data[0].id;
}

export async function getEmotes(
  username: string,
  token: string,
  TWITCH_CLIENT_ID: string
): Promise<any[]> {
  const userId = await getUserId(username, token, TWITCH_CLIENT_ID);
  if (!userId) {
    throw Error(`No se pudo obtener el ID del usuario: ${username}`);
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${userId}`,
    {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const resData: any = await res.json();
  return resData.data ?? [];
}

export async function getGlobalEmotes(
  token: string,
  TWITCH_CLIENT_ID: string
): Promise<any[]> {
  const res = await fetch(`https://api.twitch.tv/helix/chat/emotes/global`, {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  const resData: any = await res.json();
  return resData.data ?? [];
}
