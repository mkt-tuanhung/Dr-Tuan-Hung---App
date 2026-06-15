/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");

  const record0 = new Record(collection);
    record0.set("username", "admin");
    record0.setPassword("Vudung@123");
    record0.set("name", "Administrator");
    record0.set("position", "Qu\u1ea3n tr\u1ecb vi\u00ean");
    record0.set("specialties", "Qu\u1ea3n l\u00fd h\u1ec7 th\u1ed1ng");
    record0.set("basic_salary", 1);
    record0.set("allowances", 1);
    record0.set("role", "admin");
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
