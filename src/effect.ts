import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import type { Effect, Item } from "@owlbear-rodeo/sdk";
import {
  EFFECT_ID,
  EFFECT_METADATA_KEY,
  LEGACY_POC_METADATA_KEY,
} from "./constants";
import { normalizeHexColor } from "./settings";

const COLOR_UNIFORM = "backgroundColor";
const SOLID_COLOR_SHADER = `
uniform vec3 ${COLOR_UNIFORM};

half4 main(float2 coord) {
  return half4(${COLOR_UNIFORM}, 1.0);
}
`;

interface EffectMetadata {
  version: 1;
  color: string;
}

let operationQueue: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => undefined);
  return result;
}

function isManagedEffect(item: Item): item is Effect {
  return (
    item.type === "EFFECT" &&
    (item.id === EFFECT_ID ||
      EFFECT_METADATA_KEY in item.metadata ||
      item.metadata[LEGACY_POC_METADATA_KEY] === true)
  );
}

function getEffectMetadata(item: Effect): EffectMetadata | null {
  const metadata = item.metadata[EFFECT_METADATA_KEY];
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("version" in metadata) ||
    !("color" in metadata)
  ) {
    return null;
  }

  const candidate = metadata as Record<string, unknown>;
  return candidate.version === 1 && typeof candidate.color === "string"
    ? { version: 1, color: candidate.color }
    : null;
}

function effectMatches(item: Effect, color: string): boolean {
  const metadata = getEffectMetadata(item);
  return (
    metadata?.color === color &&
    item.effectType === "VIEWPORT" &&
    item.layer === "MAP" &&
    item.blendMode === "SRC_OVER" &&
    item.zIndex === Number.MIN_SAFE_INTEGER &&
    item.disableAutoZIndex === true &&
    item.disableHit === true &&
    item.locked === true
  );
}

function hexToVector(color: string): { x: number; y: number; z: number } {
  return {
    x: Number.parseInt(color.slice(1, 3), 16) / 255,
    y: Number.parseInt(color.slice(3, 5), 16) / 255,
    z: Number.parseInt(color.slice(5, 7), 16) / 255,
  };
}

function buildBackgroundEffect(color: string): Effect {
  const metadata: EffectMetadata = { version: 1, color };

  return buildEffect()
    .id(EFFECT_ID)
    .name("Cor de Fundo da Cena")
    .effectType("VIEWPORT")
    .sksl(SOLID_COLOR_SHADER)
    .uniforms([{ name: COLOR_UNIFORM, value: hexToVector(color) }])
    .blendMode("SRC_OVER")
    .layer("MAP")
    .zIndex(Number.MIN_SAFE_INTEGER)
    .disableAutoZIndex(true)
    .disableHit(true)
    .locked(true)
    .metadata({ [EFFECT_METADATA_KEY]: metadata })
    .build();
}

async function getManagedEffects(): Promise<Effect[]> {
  const items = await OBR.scene.local.getItems(isManagedEffect);
  return items.filter(isManagedEffect);
}

export function applyBackgroundEffect(colorInput: string): Promise<void> {
  const color = normalizeHexColor(colorInput);
  if (!color) {
    return Promise.reject(new Error("Use uma cor no formato #RRGGBB."));
  }

  return enqueue(async () => {
    const managedEffects = await getManagedEffects();
    const matchingEffect = managedEffects.find((effect) =>
      effectMatches(effect, color),
    );

    if (matchingEffect) {
      const duplicates = managedEffects.filter(
        (effect) => effect.id !== matchingEffect.id,
      );
      if (duplicates.length > 0) {
        await OBR.scene.local.deleteItems(
          duplicates.map((effect) => effect.id),
        );
      }
      return;
    }

    if (managedEffects.length > 0) {
      await OBR.scene.local.deleteItems(
        managedEffects.map((effect) => effect.id),
      );
    }

    await OBR.scene.local.addItems([buildBackgroundEffect(color)]);
  });
}

export function removeBackgroundEffect(): Promise<void> {
  return enqueue(async () => {
    const managedEffects = await getManagedEffects();
    if (managedEffects.length > 0) {
      await OBR.scene.local.deleteItems(
        managedEffects.map((effect) => effect.id),
      );
    }
  });
}
