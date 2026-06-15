/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  if (!e.record.get("username")) {
    e.record.set("username", "staff_" + e.record.id);
  }
  e.next();
}, "staff");

onRecordUpdate((e) => {
  if (!e.record.get("username")) {
    e.record.set("username", "staff_" + e.record.id);
  }
  e.next();
}, "staff");