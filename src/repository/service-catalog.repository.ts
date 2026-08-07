import type { BillingDatabase } from "../lib/billing-database";
import type {
  IServiceCatalogRepository,
  ServiceCatalogRow,
} from "../interface/service-catalog.interface";

export class ServiceCatalogRepository implements IServiceCatalogRepository {
  constructor(private readonly billingDb: BillingDatabase) {}

  // Ordered by ServiceId so that, when multiple services share the same
  // ServiceType name, the caller can deterministically pick the first one.
  findAll(): Promise<ServiceCatalogRow[]> {
    return this.billingDb.query<ServiceCatalogRow[]>(
      "SELECT ServiceId, ServiceType, BusinessOperation FROM Services ORDER BY ServiceId ASC",
    );
  }
}
