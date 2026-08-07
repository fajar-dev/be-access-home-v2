import { container } from "../container";
import { getDateRangeForPeriod, resolvePeriod, toSqlDate } from "../helper/period.helper";

async function run() {
  const { start, end } = getDateRangeForPeriod(resolvePeriod());
  const startDate = toSqlDate(start);
  const endDate = toSqlDate(end);

  console.log(`Mengambil data churn untuk periode ${startDate} s.d. ${endDate}...`);

  const { synced, deleted } = await container.churnService.syncFromBilling(startDate, endDate);

  console.log(`Selesai. Disinkronkan: ${synced}, dihapus (orphan): ${deleted}.`);
  await container.closeConnections();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await container.closeConnections().catch(() => {});
  process.exit(1);
});
