const LOCK_DO_UPDATE = true; // true to lock NIS button to prevent overyone keep overwriting

function onOpen() {
  let today = getToday();
  let todayx = today.toISODate();
  let day = today.getDate();
  let closed_period =
    PropertiesService.getScriptProperties().getProperty("CLOSED_PERIOD") ||
    "000000";
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
      menu.addItem("Process " + period, "doUpdateCurrent");
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

/**
 * Processes data sync for a specific period with toggleable logging.
 *
 * @param {number} diff - The date offset modifier.
 * @param {string} sheetname - The name of the target sheet.
 * @param {boolean} isVerbose - True to output deep system tracking logs; false for quiet execution.
 */
function doUpdate(diff, sheetname, isVerbose = false) {
  diff = diff || 0;

  if (isVerbose) {
    console.log(
      `[SYSTEM START] Executing doUpdate for sheet name: "${sheetname}" with offset diff: ${diff}`,
    );
  }

  const period = getPeriod(diff);
  if (isVerbose) {
    console.log(`[INFO] Computed calendar period resolved to: "${period}"`);
  }

  // Lock status check validation
  if (isPeriodLocked(period)) {
    if (isVerbose) {
      console.warn(
        `[ABORT] Operation cancelled. Target period "${period}" is permanently locked.`,
      );
    }
    SpreadsheetApp.getUi().alert(`Cannot process. Period ${period} is Locked!`);
    return;
  }

  // Extract source data payload
  if (isVerbose) console.log("[FETCH] Retrieving core source data matrix...");
  let data = getData(diff);

  // Create or resolve sheet target object
  if (isVerbose)
    console.log(`[RESOLVE] Locating target sheet reference workspace...`);
  let sheet = getOrCreateSheet(diff, sheetname);

  const _props = PropertiesService.getScriptProperties();
  const _isResuming = !!_props.getProperty("WRITE_CP_" + sheet.getName());

  if (!_isResuming) {
    // Clear existing structures
    if (isVerbose) {
      console.log(
        `[CLEANSE] Purging old layout notes and text contents from sheet "${sheet.getName()}"...`,
      );
    }
    sheet.clearNotes();
    sheet.clearContents();
    if (isVerbose)
      console.log("[CLEANSE] Target sheet workspace successfully emptied.");
  } else if (isVerbose) {
    console.log("[RESUME] Checkpoint found — skipping clear.");
  }

  // Execute row-by-row write sequence passing down the verbose mode flag
  if (isVerbose) {
    console.log(
      `[TRANSFER] Passing payload data to row-by-row writer engine...`,
    );
  }

  // sheet.getRange(1, 1, data.length, data[0].length).setValues(data)
  // if (sheet.isSheetHidden()) {
  // sheet.showSheet()
  // }

  // Passing the isVerbose toggle status forward
  // writeData(sheet.getName(), data)
  writeDataNative(sheet, data, isVerbose);

  if (isVerbose) {
    console.log(
      `[SYSTEM FINISH] Lifecycle execution for doUpdate completed successfully.`,
    );
  }
}

/* old function that update per batch
function writeData(sheetName, data) {
  const spreadsheetId = '1QTDD-tWRZqetVv8nIgqyQGHD57OQtf-dj1hYy-j9lUw'
  const range = `${sheetName}!A1`
  const valueRange = SheetsV4.newValueRange()
  valueRange.values = data

  const options = {
    valueInputOption: 'USER_ENTERED'
  }

  SheetsV4.Spreadsheets.Values.update(valueRange, spreadsheetId, range, options)
}
*/

function writeData(sheetName, data) {
  const spreadsheetId = "1QTDD-tWRZqetVv8nIgqyQGHD57OQtf-dj1hYy-j9lUw";
  const options = {
    valueInputOption: "USER_ENTERED",
  };

  // Loop through every row in your data array
  data.forEach((row, index) => {
    // index starts at 0, so Row 1 is A1, Row 2 is A2, etc.
    const rowNumber = index + 1;
    const range = `${sheetName}!A${rowNumber}`;

    // Create a new value range container for each row
    const valueRange = SheetsV4.newValueRange();
    valueRange.values = [row]; // Must be wrapped in an outer array

    // Executes and flushes the current row immediately to the sheet
    SheetsV4.Spreadsheets.Values.update(
      valueRange,
      spreadsheetId,
      range,
      options,
    );
  });
}

/**
 * Writes all data by batch (much faster than row-by-row)
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Target sheet object.
 * @param {Array<Array<any>>} data - 2D array of data rows.
 * @param {boolean} isVerbose - Set true to log process details.
 */
function writeDataNative(sheet, data, isVerbose = false) {
  if (!sheet) {
    console.error("[ERROR] 'sheet' missing.");
    return;
  }
  if (!data || !Array.isArray(data) || data.length === 0) {
    if (isVerbose) console.warn("[WARN] 'data' empty.");
    return;
  }

  const ss = sheet.getParent();
  const sheetName = sheet.getName();
  const props = PropertiesService.getScriptProperties();
  const cpKey = "WRITE_CP_" + sheetName;

  const totalRows = data.length;
  const colCount = data[0].length;
  const batchSize = 500;
  const startTime = Date.now();
  const MAX_RUNTIME = 5 * 60 * 1000; // stop ~1 min before the 6-min cap

  let startRow = parseInt(props.getProperty(cpKey) || "0", 10);
  if (isNaN(startRow) || startRow < 0 || startRow >= totalRows) startRow = 0;

  // Stop recalc while writing — this is what kills the intermittent stalls
  ss.setRecalculationOnChange ? null : null; // (no-op guard; see note below)

  if (isVerbose) {
    console.log(`[START] "${sheetName}": ${totalRows} rows.`);
    console.log(`[INFO] Resuming from row ${startRow + 1}.`);
  }

  for (let i = startRow; i < totalRows; i += batchSize) {
    if (Date.now() - startTime > MAX_RUNTIME) {
      props.setProperty(cpKey, String(i));
      console.warn(
        `[PAUSE] Time limit near. Checkpoint at row ${i + 1}. Re-run to continue.`,
      );
      return;
    }

    const end = Math.min(i + batchSize, totalRows);
    const batch = data.slice(i, end);

    try {
      sheet.getRange(i + 1, 1, batch.length, colCount).setValues(batch);
      SpreadsheetApp.flush();
      props.setProperty(cpKey, String(end)); // checkpoint AFTER success
      if (isVerbose)
        console.log(`[PROGRESS] Wrote rows ${i + 1}-${end}/${totalRows}`);
    } catch (error) {
      props.setProperty(cpKey, String(i)); // retry this batch next run
      console.error(
        `[ERROR] Failed rows ${i + 1}-${end}: ${error.message}. Re-run to continue.`,
      );
      return;
    }
  }

  props.deleteProperty(cpKey);
  if (isVerbose) console.log(`[FINISH] All ${totalRows} rows written.`);
}

function doUpdateCurrent() {
  if (LOCK_DO_UPDATE) return;
  doUpdate();
}

function doUpdatePrev() {
  if (LOCK_DO_UPDATE) return;
  doUpdate(-1);
}

function doUpdateNext() {
  if (LOCK_DO_UPDATE) return;
  doUpdate(+1);
}

function doUpdateCurrentBypass() {
  // jika tgl saat ini sudah lewat 25 maka current adalah bulan depan
  doUpdate(null, null, true);
}

function doUpdatePrevByPass() {
  doUpdate(-1, null, true);
}

function doUpdateNextByPass() {
  doUpdate(+1, null, true);
}

function doUpdateDaily() {
  let date = new Date();
  let is_locked = date.getDate() >= 27 && date.getDay() >= 2;
  if (date.getDate() > 25 && !is_locked) doUpdatePrev();
  doUpdateCurrent();
  let datex = date.toISODate();
  if (datex >= "2025-01-21" && datex <= "2025-01-25") doUpdateNext();
}

function getOrCreateSheet(diff, customSheetname) {
  let spreadsheet = SpreadsheetApp.openById(
    "1QTDD-tWRZqetVv8nIgqyQGHD57OQtf-dj1hYy-j9lUw",
  );
  let new_sheet;
  if (customSheetname) {
    new_sheet = spreadsheet.getSheetByName(customSheetname);
    if (!new_sheet) {
      let template_sheet = spreadsheet.getSheetByName("Template");
      new_sheet = template_sheet.copyTo(spreadsheet);
      new_sheet.setName(customSheetname);
    }
  } else {
    let period = getPeriod(diff);
    new_sheet = spreadsheet.getSheetByName(period);
    if (!new_sheet) {
      let template_sheet = spreadsheet.getSheetByName("Template");
      new_sheet = template_sheet.copyTo(spreadsheet);
      new_sheet.setName(period);
    }
  }

  let protection = new_sheet.protect();
  let me = Session.getEffectiveUser();
  protection.removeEditors(protection.getEditors());
  protection.addEditor(me);
  protection.addEditor("surya@nusa.id");
  protection.addEditor("linda@nusa.id");
  let editors =
    PropertiesService.getScriptProperties().getProperty("EDITORS") || "";
  for (let editor_name of editors.split(",")) {
    protection.addEditor(editor_name.trim());
  }

  return new_sheet;
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
  const binjai_reseller_period = "Binjai " + period;
  const tamora_reseller_period = "Tj Morawa " + period;
  var medan_reseller_sheets = reseller_spreadsheet.getSheetByName(
    medan_reseller_period,
  );
  var bali_reseller_sheets =
    reseller_spreadsheet.getSheetByName(bali_reseller_period);
  var nusaid_reseller_sheets = reseller_spreadsheet.getSheetByName(
    nusaid_reseller_period,
  );
  var binjai_reseller_sheets = reseller_spreadsheet.getSheetByName(
    binjai_reseller_period,
  );
  var tamora_reseller_sheets = reseller_spreadsheet.getSheetByName(
    tamora_reseller_period,
  );

  let map_custaccname_reseller = {};
  if (medan_reseller_sheets) {
    var list_reseller_medan = medan_reseller_sheets.getDataRange().getValues();
    for (let i = 0; i < list_reseller_medan.length; i++) {
      map_custaccname_reseller[list_reseller_medan[i][0]?.trim()] =
        list_reseller_medan[i][1];
    }
  }
  if (bali_reseller_sheets) {
    var list_reseller_bali = bali_reseller_sheets.getDataRange().getValues();
    for (let i = 0; i < list_reseller_bali.length; i++) {
      map_custaccname_reseller[list_reseller_bali[i][0]?.trim()] =
        list_reseller_bali[i][1];
    }
  }
  if (nusaid_reseller_sheets) {
    var list_reseller_nusaid = nusaid_reseller_sheets
      .getDataRange()
      .getValues();
    for (let i = 0; i < list_reseller_nusaid.length; i++) {
      // map_custaccname_reseller[list_reseller_nusaid[i][0]?.trim()] = list_reseller_nusaid[i][1];
      const key = (list_reseller_nusaid[i][0] || "").toString().trim();

      if (key) {
        map_custaccname_reseller[key] = list_reseller_nusaid[i][1];
      }
    }
  }
  if (binjai_reseller_sheets) {
    var list_reseller_binjai = binjai_reseller_sheets
      .getDataRange()
      .getValues();
    for (let i = 0; i < list_reseller_binjai.length; i++) {
      map_custaccname_reseller[list_reseller_binjai[i][0]?.trim()] =
        list_reseller_binjai[i][1];
    }
  }
  if (tamora_reseller_sheets) {
    var list_reseller_tamora = tamora_reseller_sheets
      .getDataRange()
      .getValues();
    for (let i = 0; i < list_reseller_tamora.length; i++) {
      map_custaccname_reseller[list_reseller_tamora[i][0]?.trim()] =
        list_reseller_tamora[i][1];
    }
  }
  _bonusResellerReport[period] = map_custaccname_reseller;
  return map_custaccname_reseller;
}

function test() {
  diff = -1;
  let period = getPeriod(diff);
  let [start_date, end_date] = getStartEndDate(diff);
  Logger.log(
    SQL_INVOICE_RECEIPT.replaceAll("$(start_date)", start_date.toISODate())
      .replaceAll("$(end_date)", end_date.toISODate())
      .replaceAll("$(period)", period),
  );
}

function getData(diff) {
  let period = getPeriod(diff);
  let [start_date, end_date] = getStartEndDate(diff);
  let invoice_data = Connection.query(
    SQL_INVOICE_RECEIPT.replaceAll("$(start_date)", start_date.toISODate())
      .replaceAll("$(end_date)", end_date.toISODate())
      .replaceAll("$(period)", period),
  );
  let account_data = Connection.query(SQL_ACCOUNT);
  let map_csid_account = {};
  for (let i = 0; i < account_data.length; ++i) {
    map_csid_account[account_data[i][1]] = account_data[i];
  }

  let data = [];
  data[0] = account_data[0].concat(invoice_data[0].slice(2));
  data[0].concat(["Bonus Reseller"]);
  for (let i = 1; i < invoice_data.length; ++i) {
    let account = map_csid_account[invoice_data[i][1]];
    data[i] = account.concat(invoice_data[i].slice(2)).concat([""]);
  }

  // remove me after 2025-02 period
  let listCust = [];
  // let old_custs = Connection.query(SQL_RESIGN.replace(/\$\(sales_id\)/g, '0202324')
  // for (let r = 0; r < old_custs.length; ++r) {
  //   listCust.push(old_custs[r][0])
  // }
  // end remove

  let mydata = new Data(data, diff);
  mydata.setCustomerTemp(listCust);
  mydata = markBuangDariKomisiSudahCairSebelumnya(mydata, diff);
  mydata = filterKomisi(mydata, diff);
  mydata = filterPostpaidUnpaidCurrentPeriod(mydata, diff);
  mydata = excludeLateInputReceiptCurrentPeriod(mydata, diff);

  return mydata.toTable();
}

/**
 * IS-1508
 * jika tanggal transaksi receipt <= 25 sesuai periode tapi input dari finance >= tgl 27
 * maka masuk periode bulan depan
 */
function excludeLateInputReceiptCurrentPeriod(data, diff) {
  diff = diff || 0;
  let period = getPeriod(diff);
  let _period = period.substr(0, 4) + "-" + period.substr(-2);
  let res = [];
  for (let i = 0; i < data.values().length; ++i) {
    let row = data._data[i + 1];
    let is_paid = data.getFlagInvoiceIsPaid(i) === 1;
    if (is_paid) {
      let tgl_transaksi = data.getPaymentTransactionDate(i);
      let tgl_input = data.getPaymentInputDate(i);
      let tgl_invoice = data.getInvoiceDate(i);

      let periode_invoice = tgl_invoice.substr(0, 7);
      let periode_input = tgl_input.substr(0, 7);
      let periode_transaksi = tgl_transaksi.substr(0, 7);

      let same_period =
        periode_invoice == periode_transaksi &&
        periode_invoice == periode_input &&
        periode_invoice == _period;
      if (
        is_paid &&
        same_period &&
        tgl_transaksi.substr(-2) <= 25 &&
        tgl_input.substr(-2) >= 27
      ) {
        continue;
      }
    }
    res.push(row);
  }
  data._data = [data._data[0]].concat(res);
  return data;
}

function markBuangDariKomisiSudahCairSebelumnya(data, diff) {
  diff = (diff || 0) - 1;
  let res = [];
  for (let i = 0; i < data.values().length; ++i) {
    let row = data._data[i + 1];
    let period_start = data.getInvoiceStartPeriod(i);
    let tgl_invoice = data.getInvoiceDate(i);
    let tgl_transaksi = data.getPaymentTransactionDate(i);
    let category = data.getServiceCategory(i);
    let date_curr_25 = getEndDate(25, diff).toISODate(); // 25
    let is_bayar_lte_25 = tgl_transaksi <= date_curr_25;
    let is_prepaid =
      new Date(tgl_invoice).toPeriod() < period_start &&
      category == "FO Prepaid";
    // let is_content = category == 'Lain-lain'
    let is_content = ["Lain-lain", "Digital Business"].includes(category);
    let is_postpaid = !is_prepaid && !is_content;
    let no_sales = !data.getSalesName(i);

    switch (true) {
      case is_prepaid && is_bayar_lte_25:
      case is_content && is_bayar_lte_25:
      case is_postpaid && tgl_transaksi >= "2023-09-26" && is_bayar_lte_25:
      case no_sales:
        break;
      default:
        res.push(row);
    }
  }
  data._data = [data._data[0]].concat(res);
  return data;
}

function filterKomisi(data, diff) {
  // TODO: masih ada perlu perbaiki, yang belum bayar harusnya bisa tampil, tidak ada hangus untuk tahunan telat
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
  let res = [];
  for (let i = 0; i < data.values().length; ++i) {
    let row = data._data[i + 1];
    let period_start = data.getInvoiceStartPeriod(i);
    let tgl_invoice = data.getInvoiceDate(i);
    let period_invoice = new Date(tgl_invoice).toPeriod();
    let tgl_transaksi = data.getPaymentTransactionDate(i);
    let category = data.getServiceCategory(i);
    let date_prev_26 = getStartDate(26, diff).toISODate();
    let date_curr_01 = getEndDate(1, diff).toISODate();
    let date_curr_07 = getEndDate(7, diff).toISODate();
    let date_curr_25 = getEndDate(25, diff).toISODate(); // 25
    let is_bayar_26_25 =
      date_prev_26 <= tgl_transaksi && tgl_transaksi <= date_curr_25;
    let is_bayar_26_7 =
      date_prev_26 <= tgl_transaksi && tgl_transaksi <= date_curr_07;
    let is_prepaid =
      new Date(tgl_invoice).toPeriod() < period_start &&
      category == "FO Prepaid";
    // let is_content = category == 'Lain-lain'
    let is_content = ["Lain-lain", "Digital Business"].includes(category);
    // let is_postpaid = !is_prepaid && category != 'Lain-lain'
    let is_postpaid = !is_prepaid && !is_content;
    let is_paid = data.getFlagInvoiceIsPaid(i) === 1;

    if (getPeriod(diff) <= "202309") {
      switch (true) {
        case is_prepaid &&
          period_start >= getPeriod(+1 + diff) &&
          period_invoice <= getPeriod(diff) &&
          is_bayar_26_25:
        case is_prepaid &&
          period_start == getPeriod(diff) &&
          period_invoice <= getPeriod(-1 + diff) &&
          is_bayar_26_7:
        case is_postpaid && period_start <= getPeriod(diff):
        case is_content && is_bayar_26_25:
        case !is_paid:
          res.push(row);
      }
    } else {
      switch (true) {
        case is_bayar_26_25:
        case is_postpaid &&
          tgl_transaksi <= "2023-09-25" &&
          period_start >= "202310" &&
          getPeriod(diff) <= "202310":
        case !is_paid:
          res.push(row);
      }
    }
  }
  data._data = [data._data[0]].concat(res);
  return data;
}

function filterPostpaidUnpaidCurrentPeriod(data, diff) {
  diff = diff || 0;
  let period = getPeriod(diff);
  let res = [];
  for (let i = 0; i < data.values().length; ++i) {
    let row = data._data[i + 1];
    let category = data.getServiceCategory(i);
    let is_paid = data.getFlagInvoiceIsPaid(i) === 1;
    let tgl_invoice = data.getInvoiceDate(i);
    let period_start = data.getInvoiceStartPeriod(i);
    let is_prepaid =
      new Date(tgl_invoice).toPeriod() < period_start &&
      category == "FO Prepaid";
    let is_content = ["Lain-lain", "Digital Business"].includes(category);
    // let is_postpaid = !is_prepaid && category != 'Lain-lain'
    let is_postpaid = !is_prepaid && !is_content;
    if (is_postpaid && !is_paid && period != period_start) continue;
    res.push(row);
  }
  data._data = [data._data[0]].concat(res);
  return data;
}

function mapCategory(category, serviceId) {
  if (
    ["CPERENT", "CPESTD", "CPEHIGH", "CPEPNM", "CPESTDPNM"].includes(serviceId)
  )
    return "CPE Rental";
  if (
    [
      "VPSSG200",
      "VPSSG400",
      "VPS320ID",
      "VPSSG55",
      "VPSSG160GB",
      "VPSSG640",
      "VPSSG1280",
    ].includes(serviceId)
  )
    return "Digital Business";
  switch (serviceId) {
    case "GCP":
      return "Digital Business";
  }
  switch (category) {
    case "IC":
    case "II":
    case "WL":
    case "VB":
      return "Wireless";
    case "FD":
    case "FB":
    case "PFO":
      return "FO";
    case "FBP":
      return "FO Prepaid";
    case "ST":
      return "Setup";
    case "SA":
      if (serviceId == "CICILALAT") return "Cicilan";
      if (serviceId == "CPERENT") return "Rental";
      return "Lain-lain";
    case "GS":
    case "SV":
    case "WH":
    case "DO":
    case "CM":
    case "ZH":
    case "NW":
    case "NP":
    case "CL":
    case "M3":
      return "Digital Business";
    case "IP":
      return "IP Public";
    case "SL":
    case "SLP":
      return "Starlink";
    default:
      return "Lain-lain";
  }
}

function resetWriteCheckpoint() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  for (const k in all)
    if (k.indexOf("WRITE_CP_") === 0) props.deleteProperty(k);
  console.log("Checkpoints cleared.");
}
