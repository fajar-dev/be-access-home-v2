export type ServiceCatalogRow = {
  ServiceId: string;
  ServiceType: string;
};

export interface IServiceCatalogRepository {
  findAll(): Promise<ServiceCatalogRow[]>;
}

export interface IServiceCatalogService {
  /**
   * Sheet-sourced rows only carry the service's display name, not its
   * ServiceId, so this is a best-effort name lookup against the billing
   * DB — not a guaranteed match (see service-catalog.service.ts).
   */
  getServiceIdByName(): Promise<Map<string, string>>;
  resolveServiceId(
    serviceName: string | null | undefined,
    serviceIdMap: Map<string, string>,
  ): string | null;
}
