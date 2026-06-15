/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");

  const record0 = new Record(collection);
    record0.set("username", "Khoidh");
    record0.set("name", "Khoi Dang Hoang");
    record0.setPassword("Khoi@123");
    record0.set("position", "Sales Staff");
    record0.set("active", true);
    record0.set("specialties", ["Telesale", "Sale Offline"]);
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
