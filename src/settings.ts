import OBR from "@owlbear-rodeo/sdk";
import type { Metadata } from "@owlbear-rodeo/sdk";
import { ROOM_SETTINGS_METADATA_KEY } from "./constants";

export interface RoomBackgroundSettings {
  enabled: boolean;
  color: string;
}

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

export function normalizeHexColor(value: string): string | null {
  const color = value.trim();
  return HEX_COLOR_PATTERN.test(color) ? color.toUpperCase() : null;
}

export function parseRoomBackgroundSettings(
  metadata: Metadata,
): RoomBackgroundSettings | null {
  const value = metadata[ROOM_SETTINGS_METADATA_KEY];
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const color =
    typeof candidate.color === "string"
      ? normalizeHexColor(candidate.color)
      : null;

  return typeof candidate.enabled === "boolean" && color
    ? { enabled: candidate.enabled, color }
    : null;
}

export async function setRoomBackgroundSettings(
  settings: RoomBackgroundSettings,
): Promise<RoomBackgroundSettings> {
  const color = normalizeHexColor(settings.color);
  if (!color) {
    throw new Error("Use uma cor no formato #RRGGBB.");
  }

  if ((await OBR.player.getRole()) !== "GM") {
    throw new Error("Apenas o GM pode alterar o fundo da sala.");
  }

  const normalizedSettings: RoomBackgroundSettings = {
    enabled: settings.enabled,
    color,
  };
  await OBR.room.setMetadata({
    [ROOM_SETTINGS_METADATA_KEY]: normalizedSettings,
  });
  return normalizedSettings;
}
