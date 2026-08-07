import { container } from "../container";
import { NewCustomerService } from "../service/new-customer.service";
import { resolvePeriod } from "../helper/period.helper";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data dari sheet "${period}"...`);

  const [rows, employeeMap, catalog] = await Promise.all([
    container.newCustomerRepository.findSheetRows(period),
    container.employeeService.getEmployeeIdByName(),
    container.serviceCatalogService.getCatalogByName(),
  ]);

  const values: any[][] = [];
  let skipped = 0;

  for (const row of rows) {
    const input = container.newCustomerService.mapSheetRowToSnapshotInput(row, catalog);
    const built = container.newCustomerService.buildSnapshotValues(input, employeeMap);
    if (!built) {
      skipped++;
      continue;
    }
    values.push([period, ...built]);
  }

  await container.snapshotRepository.replaceForPeriod(period, values, NewCustomerService.TYPES);

  console.log(`Selesai. Ditambahkan: ${values.length}, dilewati: ${skipped}.`);
  await container.closeConnections();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await container.closeConnections().catch(() => {});
  process.exit(1);
});
