import * as sheetsWoodRepo from "@/adapters/google-sheets/wood-repository";
import { upsertWood, deleteWoodFromDb } from "@/adapters/supabase/wood-repository";
import { writeSyncLog } from "@/adapters/supabase/sync-log";
import { isSupabaseEnabled } from "@/adapters/supabase/client";
import { getLogger } from "@/lib/logger";
import type { WoodMaterial } from "@/adapters/google-sheets/wood-repository";

const log = getLogger("dual-write-wood-repository");

export async function listWoods(): Promise<WoodMaterial[]> {
  return sheetsWoodRepo.listWoods();
}

export async function findWoodById(
  woodId: string
): Promise<WoodMaterial | null> {
  return sheetsWoodRepo.findWoodById(woodId);
}

export async function addWood(input: {
  name: string;
  imageUrl: string;
  features: string;
}): Promise<WoodMaterial> {
  const result = await sheetsWoodRepo.addWood(input);

  if (isSupabaseEnabled()) {
    try {
      await upsertWood(result);
      await writeSyncLog({
        sync_type: "dual_write",
        entity_type: "wood_material",
        entity_id: result.id,
        action: "create",
        status: "success",
      });
    } catch (e) {
      log.warn("木材追加の DB バックアップに失敗", { id: result.id, error: e });
    }
  }

  return result;
}

export async function updateWood(
  woodId: string,
  input: { name: string; imageUrl: string; features: string }
): Promise<WoodMaterial> {
  const result = await sheetsWoodRepo.updateWood(woodId, input);

  if (isSupabaseEnabled()) {
    try {
      await upsertWood(result);
      await writeSyncLog({
        sync_type: "dual_write",
        entity_type: "wood_material",
        entity_id: woodId,
        action: "update",
        status: "success",
      });
    } catch (e) {
      log.warn("木材更新の DB バックアップに失敗", { id: woodId, error: e });
    }
  }

  return result;
}

export async function deleteWood(woodId: string): Promise<void> {
  await sheetsWoodRepo.deleteWood(woodId);

  if (isSupabaseEnabled()) {
    try {
      await deleteWoodFromDb(woodId);
      await writeSyncLog({
        sync_type: "dual_write",
        entity_type: "wood_material",
        entity_id: woodId,
        action: "delete",
        status: "success",
      });
    } catch (e) {
      log.warn("木材削除の DB バックアップに失敗", { id: woodId, error: e });
    }
  }
}
