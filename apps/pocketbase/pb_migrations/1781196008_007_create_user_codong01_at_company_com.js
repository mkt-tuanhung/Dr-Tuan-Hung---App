/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.set("email", "codong01@company.com");
  record.setPassword("Codong@123456");
  record.set("employeeId", "codong01");
  record.set("fullName", "V\u0169 \u0110\u1ee9c D\u0169ng (C\u1ed5 \u0111\u00f4ng)");
  record.set("role", "C\u1ed5 \u0111\u00f4ng");
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
    const record = app.findFirstRecordByData("users", "email", "codong01@company.com");
    app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})
