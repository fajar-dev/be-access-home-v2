export type Scalar = string | number | Date | null | undefined;

export type SnapshotType = "new" | "upgrade" | "prorate" | "recurring";

/** Normalized shape both the sheet-based and DB-based sources map into before snapshot rules are applied. */
export type RawSnapshotInput = {
  category: string | null | undefined;
  paid: Scalar;
  namaService: Scalar;
  dpp: Scalar;
  prorate: Scalar;
  upgrade: Scalar;
  biayaAlat: Scalar;
  setup: Scalar;
  sales: Scalar;
  managerSales: Scalar;
  aiInvoice: Scalar;
  aiReceipt: Scalar;
  cid: Scalar;
  namaCustomer: Scalar;
  company: Scalar;
  csid: Scalar;
  account: Scalar;
  vendor: Scalar;
  lineRental: Scalar;
  paidDate: Scalar;
  bulan: Scalar;
  telatBulan: Scalar;
  biayaReferral: Scalar;
  referralName: Scalar;
  businessOperation?: Scalar;
};
