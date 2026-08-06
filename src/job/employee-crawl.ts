import { container } from "../container";
import { getDateRangeForPeriod, resolvePeriod, toSqlDate } from "../helper/period.helper";

async function run() {
  const crawledIds: string[] = [];
  const { start, end } = getDateRangeForPeriod(resolvePeriod());
  const startDate = toSqlDate(start);
  const endDate = toSqlDate(end);

  const sales = await container.nusaworkService.getSalesHome();
  for (const employee of sales) {
    await container.employeeService.upsertEmployee(employee);
    await container.employeeService.upsertStatusPeriod(
      employee.employeeId,
      startDate,
      endDate,
      employee.status,
    );
    crawledIds.push(employee.employeeId);
    console.log("Employee inserted:", employee.employeeId);
  }

  const admins = await container.nusaworkService.getEmployeeAdmin();
  for (const employee of admins) {
    await container.employeeService.upsertEmployee(employee);
    crawledIds.push(employee.employeeId);
    console.log("Employee inserted:", employee.employeeId);
  }

  // Deactivate anyone in the database that this run didn't see.
  const dbIds = await container.employeeService.getAllEmployeeIds();
  const deactivateIds = dbIds.filter((id) => !crawledIds.includes(id));

  for (const id of deactivateIds) {
    await container.employeeService.deactivateEmployee(id);
    console.log("Employee deactivated:", id);
  }

  console.log(
    `Selesai. Di-crawl: ${crawledIds.length}, dinonaktifkan: ${deactivateIds.length}.`,
  );
  await container.closeConnections();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await container.closeConnections().catch(() => {});
  process.exit(1);
});
