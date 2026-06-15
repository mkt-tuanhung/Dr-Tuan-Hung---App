/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");

  const record0 = new Record(collection);
    record0.set("name", "Thuy Tran");
    record0.set("email", "thuy.tran100992@gmail.com");
    record0.set("specialties", ["Ch\u0103m s\u00f3c kh\u00e1ch h\u00e0ng"]);
    record0.setPassword("12345678");
    const record0_user_idLookup = app.findFirstRecordByFilter("users", "email='thuy.tran100992@gmail.com'");
    if (!record0_user_idLookup) { throw new Error("Lookup failed for user_id: no record in 'users' matching \"email='thuy.tran100992@gmail.com'\""); }
    record0.set("user_id", record0_user_idLookup.id);
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
