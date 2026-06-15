/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("expenses");
  collection.listRule = "@request.auth.id != \"\" && (created_by = @request.auth.id || @request.auth.role = \"admin\")";
  collection.viewRule = "@request.auth.id != \"\" && (created_by = @request.auth.id || @request.auth.role = \"admin\")";
  collection.createRule = "@request.auth.id != \"\"";
  collection.updateRule = "@request.auth.id != \"\" && (created_by = @request.auth.id || @request.auth.role = \"admin\")";
  collection.deleteRule = "@request.auth.id != \"\" && (created_by = @request.auth.id || @request.auth.role = \"admin\")";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("expenses");
  collection.listRule = "@request.auth.id != ''";
  collection.viewRule = "@request.auth.id != ''";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != ''";
  collection.deleteRule = "@request.auth.id != ''";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
