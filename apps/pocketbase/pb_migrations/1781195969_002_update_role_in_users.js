/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const field = collection.fields.getByName("role");
  field.values = ["Admin", "Nh\u00e2n vi\u00ean", "K\u1ebf to\u00e1n", "C\u1ed5 \u0111\u00f4ng"];
  field.required = true;
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("users");
  const field = collection.fields.getByName("role");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["admin", "staff"];
  field.required = false;
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})
