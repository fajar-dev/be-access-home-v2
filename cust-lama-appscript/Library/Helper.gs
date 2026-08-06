function getToday() {
  return new Date()
}

function getPeriod(diff) {
  diff = diff || 0
  let today = getToday()
  let todayx = today.toISODate()
  let fdm = today.copy().toBOMonth()
  // if (todayx >= '2025-01-21' && todayx <= '2025-01-25') {
  //   fdm.shiftMonth(1 + diff)
  // } else
  if (today.getDate() > 25) {
    fdm.shiftMonth(1 + diff)
  } else {
    fdm.shiftMonth(diff)
  }
  return fdm.toPeriod()
}

function getStartDate(day, diff) {
  diff = diff || 0
  let today = getToday()
  let date = today.copy().toBOMonth()
  if (today.getDate() <= 25) {
    date.shiftMonth(-1)
  }
  if (diff != 0) {
    date.shiftMonth(diff)
  }
  date.setDate(day || 26)
  if (date.toISODate() == '2025-01-26') date.setDate(21)
  return date
}

function getEndDate(day, diff) {
  diff = diff || 0
  let startDate = getStartDate(26, diff)
  let endDate = startDate.shiftMonth(1)
  endDate.setDate(day || 25)
  if (endDate.toISODate() == '2025-01-25') endDate.setDate(20)
  return endDate
}

function getDate(year, month, day) {
  return new Date(year, month-1, day)
}

function getStartEndDate(diff) {
  let today = getToday().toISODate()
  // if (today >= '2025-01-21' && today <= '2025-01-25') diff++
  let date1 = getStartDate(26, diff)
  let date2 = getEndDate(25, diff)
  if (date1.toISODate() == '2024-12-26') {
    date2.setDate(20)
  } else if (date1.toISODate() == '2025-01-26') {
    date1.setDate(21)
  }
  // switch (date1.toISODate()) {
  //   case '2024-12-26': return [getDate(2024, 12, 26), getDate(2025, 1, 20)]
  //   case '2025-01-26': return [getDate(2025, 1, 21), getDate(2025, 2, 25)]
  // }
  return [date1, date2]
}

function getStartEndDateV1(diff) {
  let today = getToday().toISODate()
  if (today >= '2024-12-26' && today <= '2025-01-20') {
    return [getDate(2024, 12, 26), getDate(2025, 1, 20)]
  } else if (today >= '2025-01-21' && today <= '2025-02-25') {
    return [getDate(2025, 1, 21), getDate(2025, 2, 25)]
  }
  return [getStartDate(26, diff), getEndDate(25, diff)]
}