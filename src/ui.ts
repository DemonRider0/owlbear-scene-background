import OBR from "@owlbear-rodeo/sdk";
import type { Metadata, Player } from "@owlbear-rodeo/sdk";
import { DEFAULT_COLOR } from "./constants";
import {
  normalizeHexColor,
  parseRoomBackgroundSettings,
  setRoomBackgroundSettings,
  type RoomBackgroundSettings,
} from "./settings";
import "./ui.css";

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemento obrigatório da interface não encontrado: ${selector}`);
  }
  return element;
}

const form = getRequiredElement<HTMLFormElement>("#background-form");
const gmControls = getRequiredElement<HTMLElement>("#gm-controls");
const playerView = getRequiredElement<HTMLElement>("#player-view");
const currentBackground = getRequiredElement<HTMLElement>(
  "#current-background",
);
const colorPicker = getRequiredElement<HTMLInputElement>("#color-picker");
const hexInput = getRequiredElement<HTMLInputElement>("#hex-color");
const preview = getRequiredElement<HTMLElement>("#preview");
const validationError = getRequiredElement<HTMLElement>("#validation-error");
const applyButton = getRequiredElement<HTMLButtonElement>("#apply");
const restoreButton = getRequiredElement<HTMLButtonElement>("#restore");
const status = getRequiredElement<HTMLElement>("#status");

let currentRole: Player["role"] | null = null;
let currentSettings: RoomBackgroundSettings | null = null;
let busy = false;
let roleRevision = 0;
let metadataRevision = 0;
let unsubscribePlayer: (() => void) | null = null;
let unsubscribeRoomMetadata: (() => void) | null = null;

function setColor(color: string): void {
  colorPicker.value = color.toLowerCase();
  hexInput.value = color;
  preview.style.backgroundColor = color;
  hexInput.setAttribute("aria-invalid", "false");
  validationError.textContent = "";
}

function readValidColor(): string | null {
  const color = normalizeHexColor(hexInput.value);
  if (!color) {
    hexInput.setAttribute("aria-invalid", "true");
    validationError.textContent = "Use uma cor no formato #RRGGBB.";
    return null;
  }

  setColor(color);
  return color;
}

function render(): void {
  const isGm = currentRole === "GM";
  gmControls.hidden = !isGm;
  playerView.hidden = isGm || currentRole === null;

  colorPicker.disabled = busy || !isGm;
  hexInput.disabled = busy || !isGm;
  applyButton.disabled = busy || !isGm;
  restoreButton.disabled = busy || !isGm;

  const description = currentSettings?.enabled
    ? `Atual: ${currentSettings.color}`
    : "Usando o padrão do Owlbear";
  currentBackground.textContent = description;

  if (currentRole === null) {
    status.textContent = "Conectando ao Owlbear…";
  } else if (!busy) {
    status.textContent = isGm ? description : "";
  }
}

function receiveMetadata(metadata: Metadata): void {
  const settings = parseRoomBackgroundSettings(metadata);
  const changed =
    currentSettings?.enabled !== settings?.enabled ||
    currentSettings?.color !== settings?.color;

  currentSettings = settings;
  if (changed) {
    setColor(settings?.color ?? DEFAULT_COLOR);
  }
  render();
}

function receivePlayer(player: Player): void {
  currentRole = player.role;
  render();
}

function setBusy(nextBusy: boolean): void {
  busy = nextBusy;
  render();
}

function showError(error: unknown): void {
  status.textContent = error instanceof Error ? error.message : String(error);
}

setColor(DEFAULT_COLOR);

colorPicker.addEventListener("input", () => {
  setColor(colorPicker.value.toUpperCase());
});

hexInput.addEventListener("input", () => {
  const color = normalizeHexColor(hexInput.value);
  if (color) {
    colorPicker.value = color.toLowerCase();
    preview.style.backgroundColor = color;
    hexInput.setAttribute("aria-invalid", "false");
    validationError.textContent = "";
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const color = readValidColor();
  if (!color) {
    return;
  }

  setBusy(true);
  status.textContent = "Atualizando o fundo da sala…";
  void setRoomBackgroundSettings({ enabled: true, color })
    .then(() => {
      status.textContent = `Cor ${color} publicada.`;
    })
    .catch(showError)
    .finally(() => setBusy(false));
});

restoreButton.addEventListener("click", () => {
  const color = currentSettings?.color ?? DEFAULT_COLOR;

  setBusy(true);
  status.textContent = "Restaurando o padrão do Owlbear…";
  void setRoomBackgroundSettings({ enabled: false, color })
    .then(() => {
      status.textContent = "Padrão do Owlbear restaurado.";
    })
    .catch(showError)
    .finally(() => setBusy(false));
});

function stopUiLifecycle(): void {
  unsubscribePlayer?.();
  unsubscribePlayer = null;
  unsubscribeRoomMetadata?.();
  unsubscribeRoomMetadata = null;
}

async function startUiLifecycle(): Promise<void> {
  stopUiLifecycle();

  const initialRoleRevision = roleRevision;
  const initialMetadataRevision = metadataRevision;

  unsubscribePlayer = OBR.player.onChange((player) => {
    roleRevision += 1;
    receivePlayer(player);
  });
  unsubscribeRoomMetadata = OBR.room.onMetadataChange((metadata) => {
    metadataRevision += 1;
    receiveMetadata(metadata);
  });

  const [role, metadata] = await Promise.all([
    OBR.player.getRole(),
    OBR.room.getMetadata(),
  ]);
  if (roleRevision === initialRoleRevision) {
    currentRole = role;
  }
  if (metadataRevision === initialMetadataRevision) {
    receiveMetadata(metadata);
  } else {
    render();
  }
}

OBR.onReady(() => {
  void startUiLifecycle().catch(showError);
});

window.addEventListener("pagehide", stopUiLifecycle, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(stopUiLifecycle);
}
