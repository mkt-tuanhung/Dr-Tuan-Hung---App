/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attendance");
  collection.listRule = "staff_id = @request.auth.id || @request.auth.role = 'admin'";
  collection.viewRule = "staff_id = @request.auth.id || @request.auth.role = 'admin'";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "staff_id = @request.auth.id || @request.auth.role = 'admin'";
  collection.deleteRule = "@request.auth.role = 'admin'";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("attendance");
  collection.listRule = "staff_id = @request.auth.id || @request.auth.role = \"admin\"";
  collection.viewRule = "staff_id = @request.auth.id || @request.auth.role = \"admin\"";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "staff_id = @request.auth.id || @request.auth.role = \"admin\"";
  collection.deleteRule = "@request.auth.role = \"admin\"";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
