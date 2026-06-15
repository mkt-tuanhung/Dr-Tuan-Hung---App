/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attendance");
  const field = collection.fields.getByName("status");
  field.values = ["present", "absent", "leave", "half_morning", "half_afternoon", "late", "early"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("attendance");
  const field = collection.fields.getByName("status");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["present", "absent", "leave", "late", "early"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})
