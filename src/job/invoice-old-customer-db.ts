import { fetchOldBillingSnapshotInputs } from "../lib/oldBillingTransform";
import { getEmployeeIdByName } from "../lib/employee";
import { endPool } from "../lib/db";
import { endNisPool } from "../lib/nisDb";
import { resolvePeriod } from "../lib/periodArg";
import { buildRecurringSnapshotValues, RECURRING_TYPES } from "../lib/snapshotRow";
import { replaceSnapshotsForPeriod } from "../lib/snapshotWriter";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data billing (old customer) untuk periode "${period}"...`);

  const [inputs, employeeMap] = await Promise.all([
    fetchOldBillingSnapshotInputs(period),
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
  await endNisPool();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await endPool().catch(() => {});
  await endNisPool().catch(() => {});
  process.exit(1);
});
