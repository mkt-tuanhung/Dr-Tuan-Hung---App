/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.set("email", "tele01@company.com");
  record.setPassword("Tele@123456");
  record.set("employeeId", "tele01");
  record.set("fullName", "Nguy\u1ec5n V\u0103n A (Telesale)");
  record.set("role", "Nh\u00e2n vi\u00ean");
  record.set("departmentPosition", "TELESALE");
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
    const record = app.findFirstRecordByData("users", "email", "tele01@company.com");
    app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})
