import { AppDatabase } from "./lib/app-database";
import { BillingDatabase } from "./lib/billing-database";
import { GoogleSheetsClient } from "./lib/google-sheets-client";
import { NusaworkClient } from "./lib/nusawork-client";

import { EmployeeRepository } from "./repository/employee.repository";
import { SnapshotRepository } from "./repository/snapshot.repository";
import { ServiceCatalogRepository } from "./repository/service-catalog.repository";
import { NewCustomerRepository } from "./repository/new-customer.repository";
import { OldCustomerRepository } from "./repository/old-customer.repository";

import { EmployeeService } from "./service/employee.service";
import { SnapshotService } from "./service/snapshot.service";
import { ServiceCatalogService } from "./service/service-catalog.service";
import { NewCustomerService } from "./service/new-customer.service";
import { OldCustomerService } from "./service/old-customer.service";
import { NusaworkService } from "./service/nusawork.service";
import { AuthService } from "./service/auth.service";

import { HealthController } from "./controller/health.controller";
import { EmployeeController } from "./controller/employee.controller";
import { AuthController } from "./controller/auth.controller";

/**
 * Composition root: the one place the full dependency graph gets wired
 * together via constructor injection. Every other module should receive
 * its dependencies from here rather than constructing its own — that's
 * what makes each class swappable/testable in isolation.
 */
class Container {
  // Infra clients
  readonly appDatabase = new AppDatabase();
  readonly billingDatabase = new BillingDatabase();
  readonly sheetsClient = new GoogleSheetsClient();

  // Repositories
  readonly employeeRepository = new EmployeeRepository(this.appDatabase);
  readonly snapshotRepository = new SnapshotRepository(this.appDatabase);
  readonly serviceCatalogRepository = new ServiceCatalogRepository(this.billingDatabase);
  readonly newCustomerRepository = new NewCustomerRepository(
    this.billingDatabase,
    this.sheetsClient,
  );
  readonly oldCustomerRepository = new OldCustomerRepository(
    this.billingDatabase,
    this.sheetsClient,
  );
  readonly nusaworkClient = new NusaworkClient();

  // Services
  readonly employeeService = new EmployeeService(this.employeeRepository);
  readonly snapshotService = new SnapshotService();
  readonly serviceCatalogService = new ServiceCatalogService(this.serviceCatalogRepository);
  readonly newCustomerService = new NewCustomerService(
    this.newCustomerRepository,
    this.employeeService,
    this.serviceCatalogService,
    this.snapshotService,
  );
  readonly oldCustomerService = new OldCustomerService(
    this.oldCustomerRepository,
    this.employeeService,
    this.serviceCatalogService,
    this.snapshotService,
  );
  readonly nusaworkService = new NusaworkService(this.nusaworkClient);
  readonly authService = new AuthService();

  // Controllers
  readonly healthController = new HealthController();
  readonly employeeController = new EmployeeController(this.employeeService);
  readonly authController = new AuthController(this.authService, this.employeeService);

  /** Closes every open DB connection pool — call before a job/process exits. */
  async closeConnections(): Promise<void> {
    await Promise.all([this.appDatabase.close(), this.billingDatabase.close()]);
  }
}

export const container = new Container();
