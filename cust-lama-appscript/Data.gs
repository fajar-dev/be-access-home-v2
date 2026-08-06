class Data {
  constructor(data, diff) {
    this._data = data;
    this._diff = diff;
  }

  setCustomerTemp(custList) {
    this._custList = custList;
  }

  getValue(rowIndex, fn) {
    let colIndex = this.columnIndex(fn);
    if (colIndex < 0) return "";
    let value = this._data[rowIndex + 1][colIndex];
    return value;
  }

  getCustomerId(rowIndex) {
    return this.getValue(rowIndex, this.getCustomerId);
  }

  getCustomerServiceId(rowIndex) {
    return this.getValue(rowIndex, this.getCustomerServiceId);
  }

  getAutoIncrementValueOfInvoice(rowIndex) {
    return this.getValue(rowIndex, this.getAutoIncrementValueOfInvoice);
  }

  getAutoIncrementValueOfReceipt(rowIndex) {
    return this.getValue(rowIndex, this.getAutoIncrementValueOfReceipt);
  }

  getNamaCustomer(rowIndex) {
    let customerId = this.getCustomerId(rowIndex);
    let customerName = this.getValue(rowIndex, this.getNamaCustomer);
    return (
      '=HYPERLINK("https://isx.nusa.net.id/customer.php?custId=' +
      customerId +
      '&pid=profile","' +
      customerName +
      '")'
    );
  }

  getCompanyName(rowIndex) {
    return this.getValue(rowIndex, this.getCompanyName);
  }

  getAccountName(rowIndex) {
    let customerServiceId = this.getCustomerServiceId(rowIndex);
    let accountName = this.getValue(rowIndex, this.getAccountName);
    return (
      '=HYPERLINK("https://isx.nusa.net.id/v2/customer/service/' +
      customerServiceId +
      '/detail","' +
      accountName +
      '")'
    );
  }

  getServiceName(rowIndex) {
    return this.getValue(rowIndex, this.getServiceName);
  }

  getServiceCategory(rowIndex) {
    let value = this.getValue(rowIndex, this.getServiceCategory);
    let sid = this.getServiceId(rowIndex);
    return mapCategory(value, sid);
  }

  getBandwidthInMbps(rowIndex) {
    return this.getValue(rowIndex, this.getBandwidthInMbps);
  }

  getVendorName(rowIndex) {
    if (!["FO", "FO Prepaid"].includes(this.getServiceCategory(rowIndex))) {
      return "";
    }
    return this.getValue(rowIndex, this.getVendorName);
  }

  getVendorCharge(rowIndex) {
    if (!["FO", "FO Prepaid"].includes(this.getServiceCategory(rowIndex))) {
      return 0;
    }
    let vendor = this.getVendorName(rowIndex);
    let charge = this.getValue(rowIndex, this.getVendorCharge);
    if (vendor?.match(/Nusanet/) && !charge) charge = 0;
    return charge;
  }

  getInvoiceDate(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceDate);
  }

  getInvoiceExpDate(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceExpDate);
  }

  getInvoiceStartPeriod(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceStartPeriod);
  }

  getInvoiceEndPeriod(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceEndPeriod);
  }

  getInvoiceTotalPeriodInMonth(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceTotalPeriodInMonth) || 1;
  }

  getInvoiceDPP(rowIndex) {
    return this.getValue(rowIndex, this.getInvoiceDPP);
  }

  getFlagInvoiceIsPaid(rowIndex) {
    return this.getValue(rowIndex, this.getFlagInvoiceIsPaid);
  }

  getPaymentInputDate(rowIndex) {
    return this.getValue(rowIndex, this.getPaymentInputDate);
  }

  getPaymentTransactionDate(rowIndex) {
    return this.getValue(rowIndex, this.getPaymentTransactionDate);
  }

  getBranchName(rowIndex) {
    return this.getValue(rowIndex, this.getBranchName);
  }

  getSalesName(rowIndex) {
    var custs = this._custList;
    if (custs.length > 0 && custs.includes(this.getCustomerId(rowIndex))) {
      return "Megah Syahputra";
    }
    return this.getValue(rowIndex, this.getSalesName);
  }

  getSalesManagerName(rowIndex) {
    var custs = this._custList;
    if (custs.length > 0 && custs.includes(this.getCustomerId(rowIndex))) {
      return "Fauzan";
    }
    return this.getValue(rowIndex, this.getSalesManagerName);
  }

  getResellerCharge(rowIndex) {
    let period = getPeriod(this._diff);
    let isInvoiceProrata = this.checkInvoiceIsProrata(rowIndex);
    if (isInvoiceProrata) return "";
    let map_accountName_reseller = getBonusResellerReport(period);
    let accountName = this.getValue(rowIndex, this.getAccountName);
    let resellerCharge = 0;
    if (map_accountName_reseller.hasOwnProperty(accountName)) {
      resellerCharge = map_accountName_reseller[accountName.trim()];
    }
    return resellerCharge || "";
  }

  getBaseAmountForCommissionAfterReduction(rowIndex) {
    let base = this.getInvoiceDPP(rowIndex);
    let total_month = this.getInvoiceTotalPeriodInMonth(rowIndex);
    let late_month = this.getLatePaymentInMonth(rowIndex) - 0;
    let ratio = Math.max(10 - late_month, 5) / 10;
    // NOTE: meeting bahas IS 5 agustus, permintaan cristin, infonya seharusnya sejak jan25, tp gpp mulai dari agustus2025 saja
    // NOTE: 25aug cristin minta balikin
    base -= this.getVendorCharge(rowIndex) * total_month; // fian: info dr cristin, line rental * total bulan
    base -= this.getResellerCharge(rowIndex);
    base *= ratio;
    base = Math.max(base, 0);
    return base;
  }

  getLatePaymentInMonth(rowIndex) {
    let paymentDate = new Date(this.getPaymentTransactionDate(rowIndex));
    if (!paymentDate.getTime()) return "";
    let expDate = new Date(this.getInvoiceExpDate(rowIndex));
    let month = 0;
    month += paymentDate.getFullYear() * 12 + paymentDate.getMonth() + 1;
    month -= expDate.getFullYear() * 12 + expDate.getMonth() + 2;
    month += paymentDate.getDate() > expDate.getDate() ? 1 : 0;
    return Math.max(month, 0) || "";
  }

  getServiceId(rowIndex) {
    return this.getValue(rowIndex, this.getServiceId);
  }

  checkInvoiceIsProrata(rowIndex) {
    let value = this.getValue(rowIndex, this.checkInvoiceIsProrata);
    return !!parseInt(value);
  }

  getIsHandledByWhmcs(rowIndex) {
    return this.getValue(rowIndex, this.getIsHandledByWhmcs);
  }

  getResellerName(rowIndex) {
    return this.getValue(rowIndex, this.getResellerName);
  }

  columns() {
    return [
      ["CID", this.getCustomerId, true],
      ["CSID", this.getCustomerServiceId, true],
      ["AI Invoice", this.getAutoIncrementValueOfInvoice, true],
      ["AI Receipt", this.getAutoIncrementValueOfReceipt, true],
      ["Nama Customer", this.getNamaCustomer, true],
      ["Company", this.getCompanyName, true],
      ["Account", this.getAccountName, true],
      ["Nama Service", this.getServiceName, true],
      ["Category", this.getServiceCategory, true],
      ["Bandwidth (Mbps)", this.getBandwidthInMbps, true],
      ["Vendor", this.getVendorName, true],
      ["Line Rental", this.getVendorCharge, true],
      ["Tanggal Invoice", this.getInvoiceDate, true],
      ["Tanggal Jatuh Tempo", this.getInvoiceExpDate, true],
      ["Period Start", this.getInvoiceStartPeriod, true],
      ["Period End", this.getInvoiceEndPeriod, true],
      ["Bulan", this.getInvoiceTotalPeriodInMonth, true],
      ["DPP", this.getInvoiceDPP, true],
      ["Paid", this.getFlagInvoiceIsPaid, true],
      ["Tanggal Input Pembayaran", this.getPaymentInputDate, true],
      ["Tanggal Transaksi Pembayaran", this.getPaymentTransactionDate, true],
      ["Cabang", this.getBranchName, true],
      ["Sales", this.getSalesName, true],
      ["Manager Sales", this.getSalesManagerName, true],
      ["Biaya Referral", this.getResellerCharge, true],
      ["Telat (Bulan)", this.getLatePaymentInMonth, true],
      ["Dasar Komisi", this.getBaseAmountForCommissionAfterReduction, true],
      ["Is Prorata", this.checkInvoiceIsProrata, false],
      ["SID", this.getServiceId, false],
      ["WHMCS", this.getIsHandledByWhmcs, true],
      ["Reseller", this.getResellerName, true],
    ];
  }

  columnIndex(fn) {
    let i = this.columns()
      .map((x) => x[1])
      .indexOf(fn);
    return this._data[0].indexOf(this.columns()[i][0]);
  }

  columnNames() {
    return this.columns()
      .filter((x) => x[2])
      .map((x) => x[0]);
  }

  values() {
    return this._data.slice(1);
  }

  toTable() {
    let _columns = this.columnNames();
    let _entries = [];

    for (let [rowIndex, row] of this.values().entries()) {
      let _row = [];
      for (let fn of this.columns()
        .filter((x) => x[2])
        .map((x) => x[1])) {
        _row.push(eval("this." + fn.name + "(rowIndex)"));
      }
      _entries.push(_row);
    }

    let i1 = this.columnNames().indexOf("Tanggal Transaksi Pembayaran");
    let i2 = this.columnNames().indexOf("Tanggal Invoice");
    let sorter = function (x, y) {
      if (x[i1] && y[i1]) {
        if (x[i1] > y[i1]) return 1;
        if (x[i1] < y[i1]) return -1;
      }
      if (!x[i1] && y[i1]) return 1;
      if (x[i1] && !y[i1]) return -1;
      if (x[i2] > y[i2]) return 1;
      if (x[i2] < y[i2]) return -1;
      return 0;
    };
    _entries.sort(sorter);

    return [_columns].concat(_entries);
  }

  createResumptionTrigger() {
    deleteTriggers(); // Clean up old triggers first
    ScriptApp.newTrigger("processLargeDataset")
      .timeBased()
      .after(60000) // 1 minute delay
      .create();
  }

  deleteTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((t) => ScriptApp.deleteTrigger(t));
  }
}
