/**
 * Date object to Beginning of Month
 */
Date.prototype.toBOMonth = function () {
  this.setDate(1);
  this.setHours(0);
  this.setMinutes(0);
  this.setSeconds(0);
  this.setMilliseconds(0);
  return this;
};

/**
 * Date object to End of Month
 */
Date.prototype.toEOMonth = function () {
  this.toBOMonth();
  this.setMonth(this.getMonth() + 1);
  this.setDate(this.getDate() - 1);
  return this;
};

/**
 * Date object to ISO Date Format YYYY-MM-DD
 */
Date.prototype.toISODate = function () {
  return [
    ("0000" + this.getFullYear()).slice(-4),
    ("00" + (this.getMonth() + 1)).slice(-2),
    ("00" + this.getDate()).slice(-2),
  ].join("-");
};

/**
 * Date object to Period Format YYYYMM
 */
Date.prototype.toPeriod = function () {
  return [
    ("0000" + this.getFullYear()).slice(-4),
    ("00" + (this.getMonth() + 1)).slice(-2),
  ].join("");
};

/**
 * Shift date object forward/backward with positive/negative value in month
 */
Date.prototype.shiftMonth = function (diff) {
  this.setMonth(this.getMonth() + diff);
  return this;
};

/**
 * Make a new copy object
 */
Date.prototype.copy = function () {
  return new Date(this);
};
