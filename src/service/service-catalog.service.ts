import {
  normalizeBusinessOperation,
  type BusinessOperation,
} from "../helper/business-operation.helper";
import type {
  IServiceCatalogRepository,
  IServiceCatalogService,
  ServiceCatalogEntry,
} from "../interface/service-catalog.interface";

function normalizeServiceType(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Sheet-sourced rows only carry the service's display name (Nama Service),
 * not its ServiceId or BusinessOperation, so this is a best-effort name
 * lookup against the billing DB — not a guaranteed match. Service names are
 * NOT unique (many ServiceIds can share the same ServiceType), so when
 * there's a collision this deterministically keeps the first entry in
 * ServiceId order rather than picking arbitrarily.
 */
export class ServiceCatalogService implements IServiceCatalogService {
  constructor(private readonly serviceCatalogRepository: IServiceCatalogRepository) {}

  async getCatalogByName(): Promise<Map<string, ServiceCatalogEntry>> {
    const rows = await this.serviceCatalogRepository.findAll();

    const map = new Map<string, ServiceCatalogEntry>();
    for (const row of rows) {
      const key = normalizeServiceType(row.ServiceType);
      if (map.has(key)) continue;
      map.set(key, {
        serviceId: row.ServiceId,
        businessOperation: normalizeBusinessOperation(row.BusinessOperation),
      });
    }
    return map;
  }

  private lookup(
    serviceName: string | null | undefined,
    catalog: Map<string, ServiceCatalogEntry>,
  ): ServiceCatalogEntry | null {
    const trimmed = serviceName?.trim();
    if (!trimmed) return null;
    return catalog.get(normalizeServiceType(trimmed)) ?? null;
  }

  resolveServiceId(
    serviceName: string | null | undefined,
    catalog: Map<string, ServiceCatalogEntry>,
  ): string | null {
    return this.lookup(serviceName, catalog)?.serviceId ?? null;
  }

  resolveBusinessOperation(
    serviceName: string | null | undefined,
    catalog: Map<string, ServiceCatalogEntry>,
  ): BusinessOperation | null {
    return this.lookup(serviceName, catalog)?.businessOperation ?? null;
  }
}
