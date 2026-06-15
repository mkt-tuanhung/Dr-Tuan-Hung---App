/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("expenses");
  const field = collection.fields.getByName("category");
  field.values = ["MKT", "Supplies", "Office", "Other"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("expenses");
  const field = collection.fields.getByName("category");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["MKT", "V\u1eadt t\u01b0", "V\u0103n ph\u00f2ng", "Nh\u00e2n c\u00f4ng", "Kh\u00e1c"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})
