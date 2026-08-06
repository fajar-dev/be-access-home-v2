import { findAllServices } from "../repository/service-catalog.repository";

function normalizeServiceType(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Sheet-sourced rows only carry the service's display name (Nama Service),
 * not its ServiceId, so this is a best-effort name lookup against the
 * billing DB — not a guaranteed match. Service names are NOT unique (many
 * ServiceIds can share the same ServiceType), so when there's a collision
 * this deterministically keeps the first ServiceId in ID order rather than
 * picking arbitrarily.
 */
export async function getServiceIdByName(): Promise<Map<string, string>> {
  const rows = await findAllServices();

  const map = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeServiceType(row.ServiceType);
    if (!map.has(key)) map.set(key, row.ServiceId);
  }
  return map;
}

export function resolveServiceId(
  serviceName: string | null | undefined,
  serviceIdMap: Map<string, string>,
): string | null {
  const trimmed = serviceName?.trim();
  if (!trimmed) return null;

  return serviceIdMap.get(normalizeServiceType(trimmed)) ?? null;
}
