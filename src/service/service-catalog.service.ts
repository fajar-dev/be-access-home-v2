import type {
  IServiceCatalogRepository,
  IServiceCatalogService,
} from "../interface/service-catalog.interface";

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
export class ServiceCatalogService implements IServiceCatalogService {
  constructor(private readonly serviceCatalogRepository: IServiceCatalogRepository) {}

  async getServiceIdByName(): Promise<Map<string, string>> {
    const rows = await this.serviceCatalogRepository.findAll();

    const map = new Map<string, string>();
    for (const row of rows) {
      const key = normalizeServiceType(row.ServiceType);
      if (!map.has(key)) map.set(key, row.ServiceId);
    }
    return map;
  }

  resolveServiceId(
    serviceName: string | null | undefined,
    serviceIdMap: Map<string, string>,
  ): string | null {
    const trimmed = serviceName?.trim();
    if (!trimmed) return null;

    return serviceIdMap.get(normalizeServiceType(trimmed)) ?? null;
  }
}
