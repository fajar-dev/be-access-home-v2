import { replaceSnapshotsForPeriod } from "../repository/snapshot.repository";
import { getEmployeeIdByName } from "../service/employee.service";
import {
  buildSnapshotValues,
  fetchNewCustomerSnapshotInputs,
  NEW_CUSTOMER_TYPES,
} from "../service/new-customer.service";
import { endPool } from "../lib/app-db";
import { endBillingPool } from "../lib/billing-db";
import { resolvePeriod } from "../helper/period.helper";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data billing untuk periode "${period}"...`);

  const [inputs, employeeMap] = await Promise.all([
    fetchNewCustomerSnapshotInputs(period),
    getEmployeeIdByName(),
  ]);

  const values: any[][] = [];
  let skipped = 0;

  for (const input of inputs) {
    const built = buildSnapshotValues(input, employeeMap);
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
