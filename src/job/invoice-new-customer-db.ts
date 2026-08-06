import { fetchBillingSnapshotInputs } from "../lib/billingTransform";
import { getEmployeeIdByName } from "../lib/employee";
import { endPool } from "../lib/db";
import { endNisPool } from "../lib/nisDb";
import { resolvePeriod } from "../lib/periodArg";
import { buildSnapshotValues } from "../lib/snapshotRow";
import { replaceSnapshotsForPeriod } from "../lib/snapshotWriter";

async function run() {
  const period = resolvePeriod();
  console.log(`Mengambil data billing untuk periode "${period}"...`);

  const [inputs, employeeMap] = await Promise.all([
    fetchBillingSnapshotInputs(period),
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

  await replaceSnapshotsForPeriod(period, values);

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
