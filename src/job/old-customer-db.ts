import { replaceSnapshotsForPeriod } from "../repository/snapshot.repository";
import { getEmployeeIdByName } from "../service/employee.service";
import {
  buildRecurringSnapshotValues,
  fetchOldCustomerSnapshotInputs,
  RECURRING_TYPES,
} from "../service/old-customer.service";
import { endPool } from "../lib/app-db";
import { endBillingPool } from "../lib/billing-db";
import { resolvePeriod } from "../helper/period.helper";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data billing (old customer) untuk periode "${period}"...`);

  const [inputs, employeeMap] = await Promise.all([
    fetchOldCustomerSnapshotInputs(period),
    getEmployeeIdByName(),
  ]);

  const values: any[][] = [];
  let skipped = 0;

  for (const input of inputs) {
    const built = buildRecurringSnapshotValues(input, employeeMap);
    if (!built) {
      skipped++;
      continue;
    }
    values.push([period, ...built]);
  }

  await replaceSnapshotsForPeriod(period, values, RECURRING_TYPES);

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
