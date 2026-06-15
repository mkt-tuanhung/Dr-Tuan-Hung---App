/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");

  const record0 = new Record(collection);
    record0.set("username", "Khoidh");
    record0.setPassword("12345678");
    record0.set("name", "\u0110\u1eb7ng H\u1ed3ng Kh\u00f4i");
    record0.set("position", "Tr\u01b0\u1edfng nh\u00f3m");
    record0.set("specialties", "Marketing");
    record0.set("basic_salary", 14000000);
    record0.set("allowances", 1000000);
    record0.set("active", true);
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
