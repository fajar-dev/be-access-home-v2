import { billingQuery } from "../lib/billing-db";

export type ServiceCatalogRow = {
  ServiceId: string;
  ServiceType: string;
};

// Ordered by ServiceId so that, when multiple services share the same
// ServiceType name, the caller can deterministically pick the first one.
export function findAllServices(): Promise<ServiceCatalogRow[]> {
  return billingQuery<ServiceCatalogRow[]>(
    "SELECT ServiceId, ServiceType FROM Services ORDER BY ServiceId ASC",
  );
}
