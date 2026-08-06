import { findNewCustomerSheetRows } from "../repository/new-customer.repository";
import { replaceSnapshotsForPeriod } from "../repository/snapshot.repository";
import { getEmployeeIdByName } from "../service/employee.service";
import { getServiceIdByName } from "../service/service-catalog.service";
import {
  buildSnapshotValues,
  mapSheetRowToSnapshotInput,
  NEW_CUSTOMER_TYPES,
} from "../service/new-customer.service";
import { endPool } from "../lib/app-db";
import { endBillingPool } from "../lib/billing-db";
import { resolvePeriod } from "../helper/period.helper";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data dari sheet "${period}"...`);

  const [rows, employeeMap, serviceIdMap] = await Promise.all([
    findNewCustomerSheetRows(period),
    getEmployeeIdByName(),
    getServiceIdByName(),
  ]);

  const values: any[][] = [];
  let skipped = 0;

  for (const row of rows) {
    const built = buildSnapshotValues(
      mapSheetRowToSnapshotInput(row, serviceIdMap),
      employeeMap,
    );
    if (!built) {
      skipped++;
      continue;
    }
    values.push([period, ...built]);
  }

  await replaceSnapshotsForPeriod(period, values, NEW_CUSTOMER_TYPES);

  console.log(`Selesai. Ditambahkan: ${values.length}, dilewati: ${skipped}.`);
  await endPool();
  await endBillingPool();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await endPool().catch(() => {});
  await endBillingPool().catch(() => {});
  process.exit(1);
});
