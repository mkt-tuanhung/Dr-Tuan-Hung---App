/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.set("email", "page01@company.com");
  record.setPassword("Page@123456");
  record.set("employeeId", "page01");
  record.set("fullName", "L\u00ea V\u0103n C (Tr\u1ef1c page)");
  record.set("role", "Nh\u00e2n vi\u00ean");
  record.set("departmentPosition", "Tr\u1ef1c page");
  record.set("status", "active");
  try {
    return app.save(record);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const record = app.findFirstRecordByData("users", "email", "page01@company.com");
    app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})
