Object.prototype.keys = function (object) {
  if (!object) object = this;
  var keys = [];
  for (var k in object) {
    if (object.propertyIsEnumerable(k)) {
      keys.push(k);
    }
  }
  return keys;
};

function isOnlyOneSheet() {
  let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return (
    spreadsheet.getSheets().filter((sheet) => !sheet.isSheetHidden()).length ==
    1
  );
}

function dateISOFormat(date) {
  return (
    ("0000" + date.getFullYear()).slice(-4) +
    "-" +
    ("00" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("00" + date.getDate()).slice(-2)
  );
}

function getFirstDayMonth(diff) {
  diff = diff || 0;
  let d = new Date();
  d.setDate(1);
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  d.setMonth(d.getMonth() + diff);
  return d;
}

function toPeriod(date) {
  return (
    ("0000" + date.getFullYear()).slice(-4) +
    ("00" + (date.getMonth() + 1)).slice(-2)
  );
}

function getToday(diff) {
  diff = diff || 0;
  let d = new Date();
  d.setDate(d.getDate() + diff);
  return d;
}

function getBeginningOfMonth(date) {
  let d = new Date(date.getTime());
  d.setDate(1);
  return d;
}

function shiftPeriod(period, diff) {
  let d = new Date(period.slice(0, 4) + "-" + period.slice(4) + "-01");
  d.setMonth(d.getMonth() + diff);
  return toPeriod(d);
}

function shiftMonth(date, diff) {
  let ndate = new Date(date.getTime());
  ndate.setMonth(ndate.getMonth() + diff);
  return ndate;
}

function getPeriod(diff) {
  diff = diff || 0;
  let today = getToday();
  let fdm = getBeginningOfMonth(today);
  if (today.getDate() > 25) {
    fdm = shiftMonth(fdm, 1 + diff);
  } else {
    fdm = shiftMonth(fdm, diff);
  }
  let x = today.toISOString().slice(0, 10);
  // if (x >= '2025-01-21' && x <= '2025-01-25' && toPeriod(fdm) == '202501') return '202502'
  return toPeriod(fdm);
}

function getStartDate(day, diff) {
  diff = diff || 0;
  let today = getToday();
  let date = getBeginningOfMonth(today);
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  if (today.getDate() <= 25) {
    date = shiftMonth(date, -1);
  }
  if (diff != 0) {
    date = shiftMonth(date, diff);
  }
  date.setDate(day || 26);
  return date;
}

function getEndDate(day, diff) {
  diff = diff || 0;
  let startDate = getStartDate(26, diff);
  let endDate = shiftMonth(startDate, +1);
  endDate.setDate(day || 25);
  return endDate;
}

function getStartEndDate(diff) {
  // let a = getStartDate(26, diff).toISOString().slice(0, 10)
  // let b = getEndDate(25, diff).toISOString().slice(0, 10)
  // if (a == '2024-12-26' && b == '2025-01-25') {
  //   return [new Date(2024, 12-1, 26), new Date(2025, 1-1, 20)]
  // } else if (a == '2025-01-26' && b == '2025-02-25') {
  //   return [new Date(2025,1-1,21), new Date(2025, 2-1, 25)]
  // }
  return [getStartDate(26, diff), getEndDate(25, diff)];
}

function getIntMonth(month) {
  let result = 0;
  switch (month.toLowerCase()) {
    case "jan":
      result = 1;
      break;
    case "feb":
      result = 2;
      break;
    case "mar":
    case "maret":
      result = 3;
      break;
    case "apr":
    case "april":
      result = 4;
      break;
    case "may":
      result = 5;
      break;
    case "jun":
      result = 6;
      break;
    case "jul":
      result = 7;
      break;
    case "aug":
      result = 8;
      break;
    case "sep":
      result = 9;
      break;
    case "oct":
      result = 10;
      break;
    case "nov":
      result = 11;
      break;
    case "dec":
      result = 12;
      break;
  }

  return Math.ceil(result);
}
