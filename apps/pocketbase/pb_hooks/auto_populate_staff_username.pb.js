/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  // Auto-generate username from staff ID if not provided
  if (!e.record.get("username")) {
    e.record.set("username", "staff_" + e.record.id);
  }
  e.next();
}, "staff");

onRecordUpdate((e) => {
  // Ensure username is set on update
  if (!e.record.get("username")) {
    e.record.set("username", "staff_" + e.record.id);
  }
  e.next();
}, "staff");