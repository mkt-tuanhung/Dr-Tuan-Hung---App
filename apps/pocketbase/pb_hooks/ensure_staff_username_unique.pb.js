/// <reference path="../pb_data/types.d.ts" />
onRecordValidate((e) => {
  const username = e.record.get("username");
  
  // If no username provided, generate one
  if (!username || username.trim() === "") {
    e.record.set("username", "staff_" + e.record.id);
  }
  
  e.next();
}, "staff");