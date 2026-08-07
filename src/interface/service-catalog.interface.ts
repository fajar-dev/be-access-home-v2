import type { BusinessOperation } from "../helper/business-operation.helper";

export type ServiceCatalogRow = {
  ServiceId: string;
  ServiceType: string;
  BusinessOperation: string | null;
};

/** What a sheet row's service name resolves to in the billing catalog. */
export type ServiceCatalogEntry = {
  serviceId: string;
  businessOperation: BusinessOperation | null;
};

export interface IServiceCatalogRepository {
  findAll(): Promise<ServiceCatalogRow[]>;
}

export interface IServiceCatalogService {
  /**
   * Sheet-sourced rows only carry the service's display name, not its
   * ServiceId or BusinessOperation, so this is a best-effort name lookup
   * against the billing DB — not a guaranteed match (see
   * service-catalog.service.ts).
   */
  getCatalogByName(): Promise<Map<string, ServiceCatalogEntry>>;
  resolveServiceId(
    serviceName: string | null | undefined,
    catalog: Map<string, ServiceCatalogEntry>,
  ): string | null;
  resolveBusinessOperation(
    serviceName: string | null | undefined,
    catalog: Map<string, ServiceCatalogEntry>,
  ): BusinessOperation | null;
}
