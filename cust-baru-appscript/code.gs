const COLUMNS = [
  "CID",
  "CSID",
  "AI Invoice",
  "AI Receipt",
  "Nama Customer",
  "Company",
  "Account",
  "Nama Service",
  "Category",
  "Awal Aktif",
  "Bandwidth (Mbps)",
  "Vendor",
  "Line Rental",
  "Tanggal Invoice",
  // 'Tanggal Jatuh Tempo',
  "Period Start",
  "Period End",
  "Bulan",
  "DPP",
  "DPP - Line Rental",
  "Biaya Alat",
  "Setup",
  "Upgrade",
  "Upgrade - Line Rental",
  "Prorate",
  "Paid",
  "Tanggal Input Pembayaran",
  "Tanggal Transaksi Pembayaran",
  "Telat (Bulan)",
  "Cabang",
  "Sales",
  "Manager Sales",
  "Referral",
  "Biaya Referral",
  "Status Pembayaran Referral",
  "Status Customer",
  // 'Komisi'
];

const SETUP_CODE = [
  "SETUP000",
  "JSTRKKBL",
  "TARIKKBL",
  "TRKKBLDT",
  "INSTALWF",
  "TRKKBLFO",
  "MNTNCE00",
  "JSSETTAP",
  "TARKBLFO",
  "TARIKKBV",
];

const EXC_SETUP = {
  202601: [],
};

const EXC_INV_AI = {
  202601: [1773668, 1773584, 1783642, 1780825],
  202602: [
    1788170, 1780825, 1789348, 1789024, 1789353, 1788735, 1677742, 1789028,
    1789080, 1780172, 1789025, 1788824, 1790733, 1789736,
  ],
  202603: [
    1807019, 1807024, 1807025, 1807026, 1807027, 1807008, 1807406, 1807614,
  ],
  202604: [1825569, 1825572, 1825571],
  202605: [1845612, 1846986, 1846988],
};

const ALAT_INV_AI = {
  202601: [],
};

const EXCHANGE_SERVICE_NAME = {
  202408: {
    1569935: "Broadband Wireless Silver 10 Mbps",
    1555039: "Starlink Prepaid Mobile Regional inland Personal",
  },
  202605: {
    1862978: "NusaSelecta Prime 100",
    1846947: "NusaSelecta Prime 100",
    1847035: "NusaSelecta Prime 100",
    1847109: "NusaSelecta Prime 100",
    1847166: "NusaSelecta Prime 100",
    1847330: "NusaSelecta Prime 100",
    1847412: "NusaSelecta Basic 30",
    1847418: "NusaSelecta Prime 100",
    1847453: "NusaSelecta Prime 100",
    1847457: "NusaSelecta Prime 100",
    1847468: "NusaSelecta Prime 100",
    1847495: "NusaSelecta Prime 100",
    1847541: "NusaSelecta Prime 100",
    1847543: "NusaSelecta Prime 100",
    1847581: "NusaSelecta Prime 100",
    1847751: "NusaSelecta Prime 100",
    1847796: "NusaSelecta Prime 100",
    1847860: "NusaSelecta Prime 100",
    1847965: "NusaSelecta Basic 30",
    1847996: "NusaSelecta Prime 100",
  },
  202606: {
    1886224: "NusaSelecta Prime 100",
    1889706: "NusaSelecta Prime 100",
    1889731: "NusaSelecta Prime 100",
    1889743: "NusaSelecta Basic 30",
    1892290: "NusaSelecta Basic 30",
    1892306: "NusaSelecta Basic 30",
  },
  202607: {
    1913158: "Broadband FO Home Standard Prepaid 100 Mbps",
    1913161: "Broadband FO Home Standard Prepaid 100 Mbps",
    1923884: "NusaSelecta Basic 30",
    1923912: "NusaSelecta Basic 30",
  },
};

const EXCHANGE_INV_STOCK = {
  202508: {
    1711855: 650000,
  },
};

function onOpen() {
  let today = getToday();
  let todayx = today.toISODate();
  let day = today.getDate();
  let closed_period = "202309";
  try {
    let menu = SpreadsheetApp.getUi().createMenu("NIS");
    if (!addLockMenu(menu)) menu.addSeparator();
    let period = getPeriod();
    let prevPeriod = getPeriod(-1);
    if (day >= 26 && !isPeriodLocked(prevPeriod)) {
      if (prevPeriod > closed_period)
        menu.addItem("Process " + prevPeriod, "doUpdatePrev");
    }
    if (period > closed_period && !isPeriodLocked(period))
      menu.addItem("Process " + period, "doUpdate");
    if (todayx >= "2025-01-21" && todayx <= "2025-01-25") {
      let nextPeriod = getPeriod(+1);
      if (!isPeriodLocked(nextPeriod)) {
        if (nextPeriod > closed_period)
          menu.addItem("Process " + nextPeriod, "doUpdateNext");
      }
    }
    menu.addToUi();
  } catch (e) {
    Logger.log(e);
  }
}

function doUpdate(diff) {
  diff = diff || 0;
  const period = getPeriod(diff);
  if (isPeriodLocked(period)) {
    SpreadsheetApp.getUi().alert(`Cannot process. Period ${period} is Locked!`);
    return;
  }
  getBonusResellerReport(period);
  let data = getData(diff);
  let sheet = getOrCreateSheet(diff);
  // if (!isOnlyOneSheet()) sheet.hideSheet()
  sheet.clearNotes();
  sheet.clearContents();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  sheet.showSheet();
}

function doUpdateCurrent() {
  doUpdate();
}

function doUpdatePrev() {
  doUpdate(-1);
}

function doUpdateNext() {
  doUpdate(+1);
}

function doUpdateDaily() {
  let date = new Date();
  let is_locked = date.getDate() >= 27 && date.getDay() >= 2;
  if (date.getDate() > 25 && !is_locked) doUpdatePrev();
  doUpdateCurrent();
}

function getOrCreateSheet(diff) {
  let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // let spreadsheet = SpreadsheetApp.openById('1iGkrQZGVnRGtsD31li6JEV4cLEt7c7YbcGUYp28NKts')
  let period = getPeriod(diff);
  let new_sheet = spreadsheet.getSheetByName(period);
  if (!new_sheet) {
    let template_sheet = spreadsheet.getSheetByName("Template");
    new_sheet = template_sheet.copyTo(spreadsheet);
    new_sheet.setName(period);
  }

  let protection = new_sheet.protect();
  let me = Session.getEffectiveUser();
  protection.removeEditors(protection.getEditors());
  protection.addEditor(me);
  protection.addEditor("surya@nusa.id");
  protection.addEditor("linda@nusa.id");

  return new_sheet;
}

function getData(diff) {
  let [start_date, end_date] = getStartEndDate(diff);
  if (end_date.getMonth() + 1 == 1 && end_date.getFullYear() == 2025) {
    end_date = new Date("January 20, 2025");
  }
  if (start_date.getMonth() + 1 == 1 && start_date.getFullYear() == 2025) {
    start_date = new Date("January 21, 2025");
  }
  end_date.setHours(23, 59, 59);
  let invoice_data = Connection.query(
    SQL_INVOICE_RECEIPT.replace(
      /\$\(start_date\)/g,
      dateISOFormat(start_date),
    ).replace(/\$\(end_date\)/g, dateISOFormat(end_date)),
  );
  let account_data = Connection.query(SQL_ACCOUNT);
  let map_csid_account = {},
    map_cid_account = {};
  for (let i = 0; i < account_data.length; ++i) {
    if (account_data[i][1])
      map_csid_account[account_data[i][1]] = account_data[i];
    map_cid_account[account_data[i][0]] = account_data[i];
  }

  let service_data = Connection.query(
    SQL_SERVICE.replace(/\$\(start_date\)/g, dateISOFormat(start_date)).replace(
      /\$\(end_date\)/g,
      dateISOFormat(end_date),
    ),
  );
  let service_map = {};
  for (let si = 1; si < service_data.length; si++) {
    service_map[service_data[si][0]] = service_data[si][3];
  }

  let listCust = [];
  let old_custs = Connection.query(
    SQL_RESIGN.replace(/\$\(sales_id\)/g, "0202324"),
  );
  for (let r = 0; r < old_custs.length; ++r) {
    listCust.push(old_custs[r][0]);
  }

  let data = [];
  data[0] = COLUMNS;

  var headers = invoice_data[0];
  var period = getPeriod(diff);
  var excSetup = EXC_SETUP[period];
  var listEx = EXC_INV_AI[period];
  var referral = _bonusResellerReport[period];
  var changeToAlat = ALAT_INV_AI[period];
  var changeServiceName = EXCHANGE_SERVICE_NAME[period];
  var exchangeStock = EXCHANGE_INV_STOCK[period];

  var prevData = getPrevMonthData();

  var n = 1;
  for (let i = 1; i < invoice_data.length; ++i) {
    var invAI = invoice_data[i][headers.indexOf("AI Invoice")];
    if (listEx != null && listEx.includes(invAI)) {
      continue;
    }

    if (prevData.length > 0 && prevData.includes(invAI)) {
      continue;
    }

    let account = map_csid_account[invoice_data[i][1]];
    if (!account) account = map_cid_account[invoice_data[i][0]];
    let invoiceDueDate =
      invoice_data[i][headers.indexOf("Tanggal Jatuh Tempo")];
    let invoicePaymentDate =
      invoice_data[i][headers.indexOf("Tanggal Transaksi Pembayaran")];
    var late = "";
    if (
      account &&
      (account[14] != "BL" ||
        ["ST", "Alat"].includes(invoice_data[i][headers.indexOf("SG")]))
    ) {
      late = getLateInMonth(invoiceDueDate, invoicePaymentDate);
    }

    if (
      changeToAlat != null &&
      changeToAlat.includes(invoice_data[i][headers.indexOf("AI Invoice")])
    ) {
      invoice_data[i][headers.indexOf("SG")] = "Alat";
    }

    let isPaid = 0;
    let inputPaymentDate = "";
    let transPaymentDate = "";
    let aiReceipt = "";
    if (invoicePaymentDate != null) {
      let paymentDate = new Date(invoicePaymentDate);
      if (paymentDate <= end_date) {
        isPaid = 1;
        inputPaymentDate =
          invoice_data[i][headers.indexOf("Tanggal Input Pembayaran")];
        transPaymentDate = invoicePaymentDate;
        aiReceipt = invoice_data[i][headers.indexOf("AI Receipt")];
      }
    }

    let resellerName = "";
    if (invoice_data[i][headers.indexOf("Reseller Name")] != "none") {
      resellerName = invoice_data[i][headers.indexOf("Reseller Name")];
    }

    let serviceLabel = "";
    if (service_map[invAI] != undefined) {
      serviceLabel = service_map[invAI];
    }
    if (account && serviceLabel == "") {
      serviceLabel = changeServiceLabel(account[5]);
    }
    let bulan = invoice_data[i][headers.indexOf("Bulan")];
    let periodEnd = invoice_data[i][headers.indexOf("Period End")];
    if (account[15] == "028") {
      bulan = 1;
      periodEnd = invoice_data[i][headers.indexOf("Period Start")];
    }

    data[n] = [
      invoice_data[i][headers.indexOf("CID")],
      invoice_data[i][headers.indexOf("CSID")],
      invoice_data[i][headers.indexOf("AI Invoice")],
      aiReceipt,
      account ? account[2] : "",
      account ? account[3] : "",
      account ? account[4] : "",
      serviceLabel,
      account ? account[6] : "",
      account ? account[7] : "",
      account ? account[8] : "",
      account ? account[9] : "",
      invoice_data[i][headers.indexOf("Line Rental")] /
        invoice_data[i][headers.indexOf("Bulan")],
      invoice_data[i][headers.indexOf("Tanggal Invoice")],
      // invoiceDueDate,
      invoice_data[i][headers.indexOf("Period Start")],
      // invoice_data[i][headers.indexOf("Period End")],
      // invoice_data[i][headers.indexOf("Bulan")],
      periodEnd,
      bulan,
      invoice_data[i][headers.indexOf("DPP")],
      invoice_data[i][headers.indexOf("DPP")] -
        invoice_data[i][headers.indexOf("Line Rental")],
      "", // Alat
      "", // Setup
      "", // Upgrade
      "", // After Upgrade
      "", // Prorate
      isPaid, // invoice_data[i][headers.indexOf("Paid")],
      inputPaymentDate, // invoice_data[i][headers.indexOf("Tanggal Input Pembayaran")],
      transPaymentDate, // invoicePaymentDate,
      late,
      account ? account[11] : "",
      account ? account[12] : "",
      account ? account[13] : "",
      resellerName, // Referral
      "", // Biaya Referral
      "", // Status Pembayaran
      account ? account[14] : "",
    ];

    if (changeServiceName != null) {
      var newServicesName =
        changeServiceName[invoice_data[i][headers.indexOf("AI Invoice")]];
      if (newServicesName != null) {
        data[n][7] = newServicesName;
      }
    }

    if (
      invoice_data[i][headers.indexOf("SG")] == "ST" &&
      (excSetup == null ||
        !excSetup.includes(invoice_data[i][headers.indexOf("AI Invoice")]))
    ) {
      data[n][10] = data[n][11] = data[n][12] = data[n][17] = data[n][18] = "";
      data[n][20] = invoice_data[i][headers.indexOf("New Subscription")];
    }

    if (invoice_data[i][headers.indexOf("SG")] == "Alat") {
      data[n][10] = data[n][11] = data[n][12] = data[n][17] = data[n][18] = ""; // kosongkan bandwidth, vendor, line rental, dan dpp untuk alat
      if (SETUP_CODE.includes(invoice_data[i][headers.indexOf("Code")])) {
        data[n][20] = invoice_data[i][headers.indexOf("DPP")];
        data[n][8] = "ST";
        invoice_data[i][headers.indexOf("SG")] = "ST";
      } else {
        var stockDpp = invoice_data[i][headers.indexOf("DPP")];
        if (
          exchangeStock != null &&
          exchangeStock[invoice_data[i][headers.indexOf("AI Invoice")]] != null
        ) {
          stockDpp =
            exchangeStock[invoice_data[i][headers.indexOf("AI Invoice")]];
        }
        data[n][19] = stockDpp;
        data[n][8] = invoice_data[i][headers.indexOf("SG")]; // ganti category sesuai tagihan <- pakai category service terkini sekarang saja
      }
    }

    if (invoice_data[i][headers.indexOf("Is Upgrade")] > 0) {
      data[n][17] = data[n][18] = "";
      data[n][21] = invoice_data[i][headers.indexOf("New Subscription")];
      data[n][22] =
        invoice_data[i][headers.indexOf("New Subscription")] -
        invoice_data[i][headers.indexOf("Line Rental")];
    }

    if (invoice_data[i][headers.indexOf("Invoice Prorata")] == 1) {
      data[n][17] = data[n][18] = "";
      data[n][23] = invoice_data[i][headers.indexOf("DPP")];
    }

    if (data[n][17] != "") {
      if (referral[data[n][6]]) {
        var refCust = referral[data[n][6]];
        data[n][31] = refCust[1];
        data[n][32] = refCust[0];
        data[n][33] = refCust[2];
      }
    } else {
      data[n][31] = "";
      data[n][32] = "";
      data[n][33] = "";
    }

    data[n][4] =
      '=HYPERLINK("https://isx.nusa.net.id/customer.php?custId=' +
      invoice_data[i][headers.indexOf("CID")] +
      '&pid=profile","' +
      data[n][4] +
      '")';
    if (invoice_data[i][headers.indexOf("CSID")] > 1) {
      data[n][6] =
        '=HYPERLINK("https://isx.nusa.net.id/v2/customer/service/' +
        invoice_data[i][headers.indexOf("CSID")] +
        '/detail","' +
        data[n][6] +
        '")';
    }
    var serviceName = account ? account[5] : "";
    /*if (serviceName == 'Biaya Rental CPE') {
      data[n][17] = data[n][18] = '';
      data[n][19] = invoice_data[i][headers.indexOf("DPP")];
    }*/
    data[n][8] = mapCategory(
      invoice_data[i][headers.indexOf("SG")],
      serviceName,
    );
    n++;
  }

  /**
   * data index after
   * 0 - 0 - CID
   * 1 - 1 - CSID
   * 2 - 23 - AI Invoice
   * 3 - 24 - AI Receipt
   * 4 - 2 - Nama Customer
   * 5 - 3 - Company
   * 6 - 4 - Account
   * 7 - 5 - Nama Service
   * 8 - 6 - Category = ServiceGroup
   * 9 - 7 - Awal Aktif
   * 10 - 8 - Bandwidth (Mbps)
   * 11 - 9 - Vendor
   * 12 - 10 - Line Rental
   * 13 - 15 - Tanggal Invoice
   * 14 - 16 - Period Start
   * 15 - 17 - Period End
   * 16 - 18 - Bulan
   * 17 - 19 - DPP
   * 18 - - Alat
   * 19 - - Prorate Upgrade
   * 20 - 20 - Paid
   * 21 - 21 - Tanggal Input Pembayaran
   * 22 - 22 - Tanggal Transaksi Pembayaran
   * 23 - 11 - Cabang
   * 24 - 12 - Sales
   * 25 - 13 - Manager Sales
   * 26 - - Komisi
   */

  let header = [data[0]];
  let body = data.slice(1);
  let sorter = function (x, y) {
    if (x[20] && y[20]) {
      if (x[20] > y[20]) return 1;
      if (x[20] < y[20]) return -1;
    }
    if (!x[20] && y[20]) return 1;
    if (x[20] && !y[20]) return -1;
    if (x[13] > y[13]) return 1;
    if (x[13] < y[13]) return -1;
    return 0;
  };
  body.sort(sorter);
  // body = markBuangDariKomisiSudahCairSebelumnya(body, diff)
  // body = markKomisi(body, diff)
  // body = filterKomisi1(body)
  // body = filterPostpaidUnpaidCurrentPeriod(body, diff)
  /*
  for (var i = 0; i < body.length; ++i) {
    body[i][4] = "=HYPERLINK(\"https://is.nusa.net.id/customer.php?custId=\"&A" + (i+2) + "&\"&pid=profile\",\"" + body[i][4] + "\")"
    body[i][6] = "=HYPERLINK(\"https://is.nusa.net.id/v2/customer/service/\"&B" + (i+2) + "&\"/detail\",\"" + body[i][6] + "\")"
    body[i][8] = mapCategory(body[i][8], body[i][7])
  }*/

  return header.concat(body);
}

function getIndexFromKey(headers, headerKey) {
  return headers.indexOf(headerKey);
}

function getLateInMonth(dueDate, invoicePaymentDate) {
  let paymentDate = new Date(invoicePaymentDate);
  if (!paymentDate.getTime()) return "";
  let expDate = new Date(dueDate);
  let month = 0;
  month += paymentDate.getFullYear() * 12 + paymentDate.getMonth() + 1;
  month -= expDate.getFullYear() * 12 + expDate.getMonth() + 2;
  month += paymentDate.getDate() > expDate.getDate() ? 1 : 0;
  return Math.max(month, 0) || "";
}

function markBuangDariKomisiSudahCairSebelumnya(rows, diff) {
  diff = (diff || 0) - 1;
  let res = [];
  for (let i = 0; i < rows.length; ++i) {
    let period_start = rows[i][14];
    let tgl_invoice = rows[i][13];
    let tgl_transaksi = rows[i][20];
    let category = mapCategory(rows[i][8], rows[i][7]);
    let date_curr_25 = dateISOFormat(getEndDate(25, diff)); // 25
    let is_bayar_lte_25 = tgl_transaksi <= date_curr_25;
    let is_prepaid =
      toPeriod(new Date(tgl_invoice)) < period_start && rows[i][8] == "FBP";
    let is_content = category == "Lain-lain";
    let no_sales = !rows[i][22];

    switch (true) {
      case is_prepaid && is_bayar_lte_25:
      case is_content && is_bayar_lte_25:
      case no_sales:
        rows[i][24] = 0;
      default:
        res.push(rows[i]);
    }
  }
  return res;
}

function markKomisi(rows, diff) {
  diff = diff || 0;
  /**
   * Rules :
   * if now 202301
   * prepaid,  bulanan, period_start 202302, period_invoice 202301, bayar 26 des - 25 jan -> Jan
   * prepaid,  bulanan, period_start 202301, period_invoice 202212, bayar 26 des - 7 jan -> Jan
   * prepaid,  tahunan, period_start 202302, period_invoice 202301, bayar 26 des - 25 jan -> Jan
   * prepaid,  tahunan, period_start 202301, period_invoice 202212, bayar 26 des - 7 jan -> Jan
   * postpaid, bulanan, period_start 202301, period_invoice 202301, bayar 26 des - 25 jan -> Jan
   * postpaid, bulanan, period_start 202212, period_invoice 202212, bayar 26 - 31 des -> Jan
   * postpaid, tahunan, period_start 202301, period_invoice 202212, bayar <= 25 des -> Jan
   * postpaid, tahunan, period_start 202301, period_invoice 202212, bayar 26 - 31 des -> Jan
   * postpaid, tahunan, period_start 202301, period_invoice 202212, bayar 26 des - 25 jan -> Jan
   * postpaid, tahunan, period_start 202212, period_invoice 202211, bayar 26 - 28 des -> Jan
   * postpaid, tahunan, period_start 202301, period_invoice 202301, bayar 26 des - 25 jan -> Jan
   * postpaid, tahunan, period_start 202212, period_invoice 202212, bayar 26 - 28 des -> Jan
   */
  for (let i = 0; i < rows.length; ++i) {
    let period_start = rows[i][14];
    let period_end = rows[i][15];
    let is_bulanan = period_start == period_end;
    let tgl_invoice = rows[i][13];
    let period_invoice = toPeriod(new Date(tgl_invoice));
    let tgl_transaksi = rows[i][20];
    let category = mapCategory(rows[i][8], rows[i][7]);
    let date_prev_26 = dateISOFormat(getStartDate(26, diff));
    let date_curr_01 = dateISOFormat(getEndDate(1, diff));
    let date_curr_07 = dateISOFormat(getEndDate(7, diff));
    let date_curr_25 = dateISOFormat(getEndDate(25, diff)); // 25
    let is_bayar_26_25 =
      date_prev_26 <= tgl_transaksi && tgl_transaksi <= date_curr_25;
    let is_bayar_26_7 =
      date_prev_26 <= tgl_transaksi && tgl_transaksi <= date_curr_07;
    let is_bayar_26_31 =
      date_prev_26 <= tgl_transaksi && tgl_transaksi < date_curr_01;
    let is_bayar_lte_25 = tgl_transaksi <= date_curr_25;
    let is_prepaid =
      toPeriod(new Date(tgl_invoice)) < period_start && rows[i][8] == "FBP";
    let is_postpaid = !is_prepaid && category != "Lain-lain";
    let is_content = category == "Lain-lain";

    switch (true) {
      case is_prepaid &&
        period_start >= getPeriod(+1 + diff) &&
        period_invoice <= getPeriod(diff) &&
        is_bayar_26_25:
      case is_prepaid &&
        period_start == getPeriod(diff) &&
        period_invoice <= getPeriod(-1 + diff) &&
        is_bayar_26_7:
      case is_postpaid &&
        is_bulanan &&
        period_start == getPeriod(-1 + diff) &&
        period_invoice == getPeriod(-1 + diff) &&
        is_bayar_26_31:
      case is_postpaid &&
        !is_bulanan &&
        period_start == getPeriod(diff) &&
        period_invoice == getPeriod(-1 + diff) &&
        is_bayar_lte_25:
      case is_postpaid &&
        !is_bulanan &&
        period_start == getPeriod(-1 + diff) &&
        period_invoice == getPeriod(-2 + diff) &&
        is_bayar_26_31:
      case is_postpaid &&
        period_start == getPeriod(diff) &&
        period_invoice <= getPeriod(diff) &&
        is_bayar_lte_25:
      case is_postpaid &&
        !is_bulanan &&
        period_start == getPeriod(-1 + diff) &&
        period_invoice == getPeriod(-1 + diff) &&
        is_bayar_26_31:
      case is_content && is_bayar_26_25:
        if (rows[i][24] === "") rows[i][24] = 1;
    }

    if (rows[i][24] === "") rows[i][24] = 0;
  }
  return rows;
}

function filterKomisi1(rows) {
  let res = [];
  for (let i = 0; i < rows.length; ++i) {
    let is_paid = rows[i][18] === 1;
    let is_komisi = rows[i][24] === 1;
    if (is_paid && !is_komisi) continue;
    res.push(rows[i].slice(0, -1));
  }
  return res;
}

function filterPostpaidUnpaidCurrentPeriod(rows, diff) {
  diff = diff || 0;
  let period = getPeriod(diff);
  let res = [];
  for (let i = 0; i < rows.length; ++i) {
    let category = mapCategory(rows[i][8], rows[i][7]);
    let is_paid = rows[i][18] === 1;
    let tgl_invoice = rows[i][13];
    let period_start = rows[i][14];
    let is_prepaid =
      toPeriod(new Date(tgl_invoice)) < period_start && rows[i][8] == "FBP";
    let is_postpaid = !is_prepaid && category != "Lain-lain";
    if (is_postpaid && !is_paid && period != period_start) continue;
    res.push(rows[i]);
  }
  return res;
}

let _bonusResellerReport = {};
function getBonusResellerReport(period) {
  if (_bonusResellerReport[period]) return _bonusResellerReport[period];
  var reseller_spreadsheet = SpreadsheetApp.openById(
    "1pxqvg_nBodXqZKXrcCImTAHhGiNYhYoedVPFvYQUuiY",
  ); // spreadsheet reseller
  const medan_reseller_period = "Medan " + period;
  const bali_reseller_period = "Bali " + period;
  const nusaid_reseller_period = "Nusa.id " + period;
  const tamora_reseller_period = "Tj Morawa " + period;
  var medan_reseller_sheets = reseller_spreadsheet.getSheetByName(
    medan_reseller_period,
  );
  var bali_reseller_sheets =
    reseller_spreadsheet.getSheetByName(bali_reseller_period);
  var nusaid_reseller_sheets = reseller_spreadsheet.getSheetByName(
    nusaid_reseller_period,
  );
  var tamora_reseller_sheets = reseller_spreadsheet.getSheetByName(
    tamora_reseller_period,
  );

  let map_custaccname_reseller = {};
  if (medan_reseller_sheets) {
    var list_reseller_medan = medan_reseller_sheets.getDataRange().getValues();
    for (let i = 0; i < list_reseller_medan.length; i++) {
      map_custaccname_reseller[list_reseller_medan[i][0]?.trim()] = [
        list_reseller_medan[i][1],
        list_reseller_medan[i][2],
        list_reseller_medan[i][3],
      ];
    }
  }
  if (bali_reseller_sheets) {
    var list_reseller_bali = bali_reseller_sheets.getDataRange().getValues();
    for (let i = 0; i < list_reseller_bali.length; i++) {
      map_custaccname_reseller[list_reseller_bali[i][0]?.trim()] = [
        list_reseller_bali[i][1],
        list_reseller_bali[i][2],
        list_reseller_bali[i][3],
      ];
    }
  }
  if (nusaid_reseller_sheets) {
    var list_reseller_nusaid = nusaid_reseller_sheets
      .getDataRange()
      .getValues();
    for (let i = 0; i < list_reseller_nusaid.length; i++) {
      if (!list_reseller_nusaid[i].length) continue;
      if (!list_reseller_nusaid[i][0]?.trim) continue;
      map_custaccname_reseller[list_reseller_nusaid[i][0]?.trim()] = [
        list_reseller_nusaid[i][1],
        list_reseller_nusaid[i][2],
        list_reseller_nusaid[i][3],
      ];
    }
  }
  if (tamora_reseller_sheets) {
    var list_reseller_tamora = tamora_reseller_sheets
      .getDataRange()
      .getValues();
    for (let i = 0; i < list_reseller_tamora.length; i++) {
      map_custaccname_reseller[list_reseller_tamora[i][0]?.trim()] = [
        list_reseller_tamora[i][1],
        list_reseller_tamora[i][2],
        list_reseller_tamora[i][3],
      ];
    }
  }
  _bonusResellerReport[period] = map_custaccname_reseller;
  return map_custaccname_reseller;
}

function changeServiceLabel(serviceName) {
  switch (serviceName) {
    case "Starlink Prepaid Lokal Prioritas 500 GB":
      return "Starlink Prepaid Lokal Prioritas 500 GB";
    case "Starlink Business Flex Lokal Prioritas 1 TB":
      return "Starlink Business Flex Lokal Prioritas 1 TB";
    default:
      return serviceName;
  }
}

function mapCategory(category, serviceName) {
  switch (category) {
    case "IC":
    case "II":
    case "WL":
    case "VB":
      if (serviceName.toLowerCase().includes("bandwidth on demand")) {
        return "BOD";
      }
      return "Wireless";
    case "FD":
      if (serviceName.toLowerCase().includes("bandwidth on demand")) {
        return "BOD";
      }
    case "FB":
      return "FO";
    case "FBP":
      return "FO Prepaid";
    case "ST":
      return "Setup";
    case "Alat":
      return "Alat";
    case "SA":
      if (serviceName.toLowerCase().includes("cicilan")) {
        return "Cicilan";
      } else if (serviceName.toLowerCase() == "biaya rental cpe") {
        return "Rental";
      } else {
        return "Lain-lain";
      }
    case "GS":
    case "SV":
    case "WH":
    case "DO":
    case "CM":
    case "ZH":
    case "CM":
    case "NW":
      return "Digital Business";
    default:
      return "Lain-lain";
  }
}

function getPrevMonthData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = ss.getActiveSheet();
  const currentName = currentSheet.getName();
  let year = parseInt(currentName.substring(0, 4));
  let month = parseInt(currentName.substring(4, 6));

  month--;

  if (month === 0) {
    month = 12;
    year--;
  }

  const prevPeriod = year.toString() + month.toString().padStart(2, "0");

  const prevSheet = ss.getSheetByName(prevPeriod);

  if (!prevSheet) {
    Logger.log("Sheet periode sebelumnya tidak ditemukan");
    return [];
  }

  const data = prevSheet.getDataRange().getValues();
  const headers = data[0];
  var result = [];
  for (let i = 1; i < data.length; i++) {
    var row = data[i];
    var isPaid = row[headers.indexOf("Paid")];
    var isActive = row[headers.indexOf("Status Customer")];
    if (parseInt(isPaid) == 1 && isActive == "AC") {
      var invoiceAI = row[headers.indexOf("AI Invoice")];
      result.push(parseInt(invoiceAI));
    }
  }
  return result;
}
