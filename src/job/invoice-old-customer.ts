import { getSheetRows } from "../lib/sheets";
import { getEmployeeIdByName } from "../lib/employee";
import { endPool } from "../lib/db";
import { resolvePeriod } from "../lib/periodArg";
import { buildRecurringSnapshotValues, RECURRING_TYPES } from "../lib/snapshotRow";
import { replaceSnapshotsForPeriod } from "../lib/snapshotWriter";

async function run() {
  const sheetTitle = resolvePeriod();
  console.log(`Mengambil data dari sheet "${sheetTitle}"...`);

  const [rows, employeeMap] = await Promise.all([
    getSheetRows(sheetTitle, process.env.GOOGLE_SPREADSHEET_ID_OLD_CUSTOMER!),
    getEmployeeIdByName(),
  ]);

  const values: any[][] = [];
  let skipped = 0;

  for (const row of rows) {
    const built = buildRecurringSnapshotValues(
      {
        category: row.get("Category"),
        paid: row.get("Paid"),
        namaService: row.get("Nama Service"),
        dpp: row.get("DPP"),
        prorate: null,
        upgrade: null,
        biayaAlat: null,
        setup: null,
        sales: row.get("Sales"),
        managerSales: row.get("Manager Sales"),
        aiInvoice: row.get("AI Invoice"),
        aiReceipt: row.get("AI Receipt"),
        cid: row.get("CID"),
        namaCustomer: row.get("Nama Customer"),
        company: row.get("Company"),
        csid: row.get("CSID"),
        account: row.get("Account"),
        vendor: row.get("Vendor"),
        lineRental: row.get("Line Rental"),
        paidDate: row.get("Tanggal Input Pembayaran"),
        bulan: row.get("Bulan"),
        telatBulan: row.get("Telat (Bulan)"),
        biayaReferral: row.get("Biaya Referral"),
        referralName: row.get("Reseller"),
      },
      employeeMap,
    );

    if (!built) {
      skipped++;
      continue;
    }

    values.push([sheetTitle, ...built]);
  }

  await replaceSnapshotsForPeriod(sheetTitle, values, RECURRING_TYPES);

  console.log(`Selesai. Ditambahkan: ${values.length}, dilewati: ${skipped}.`);
  await endPool();
}

run().catch(async (error) => {
  console.error("Job gagal:", error);
  await endPool().catch(() => {});
  process.exit(1);
});
