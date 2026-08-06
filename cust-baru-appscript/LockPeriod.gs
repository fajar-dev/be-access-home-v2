function getLockedPeriods() {
  const propertyService = PropertiesService.getScriptProperties();
  try {
    return JSON.parse(propertyService.getProperty("LOCK_PERIOD"));
  } catch (e) {
    return [];
  }
}

function isPeriodLocked(period) {
  const lockedPeriods = getLockedPeriods();
  return lockedPeriods.includes(period);
}

function lockPeriod(period) {
  if (isPeriodLocked(period)) return;
  const propertyService = PropertiesService.getScriptProperties();
  let lockedPeriods = getLockedPeriods();
  lockedPeriods.push(period);
  propertyService.setProperty("LOCK_PERIOD", JSON.stringify(lockedPeriods));
}

function unlockPeriod(period) {
  if (!isPeriodLocked(period)) return;
  const propertyService = PropertiesService.getScriptProperties();
  let lockedPeriods = getLockedPeriods();
  while ((index = lockedPeriods.indexOf(period)) >= 0) {
    lockedPeriods.splice(index, 1);
  }
  propertyService.setProperty("LOCK_PERIOD", JSON.stringify(lockedPeriods));
}

function doLockCurrentPeriod() {
  const period = getPeriod();
  if (!isPeriodLocked(period)) lockPeriod(period);
  onOpen();
}

function doUnlockCurrentPeriod() {
  const period = getPeriod();
  if (isPeriodLocked(period)) unlockPeriod(period);
  onOpen();
}

function doLockPrevPeriod() {
  const period = getPeriod(-1);
  if (!isPeriodLocked(period)) lockPeriod(period);
  onOpen();
}

function doUnlockPrevPeriod() {
  const period = getPeriod(-1);
  if (isPeriodLocked(period)) unlockPeriod(period);
  onOpen();
}

function addLockMenu(menu) {
  const today = getToday();
  const day = today.getDate();
  let allLocked = true;
  if (day >= 26) {
    const prevPeriod = getPeriod(-1);
    if (isPeriodLocked(prevPeriod)) {
      menu.addItem("Unlock " + prevPeriod, "doUnlockPrevPeriod");
    } else {
      menu.addItem("Lock " + prevPeriod, "doLockPrevPeriod");
      allLocked = false;
    }
  }
  const period = getPeriod();
  if (isPeriodLocked(period)) {
    menu.addItem("Unlock " + period, "doUnlockCurrentPeriod");
  } else {
    menu.addItem("Lock " + period, "doLockCurrentPeriod");
    allLocked = false;
  }
  return allLocked;
}
