/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("kpi");
  collection.listRule = "@request.auth.role = \"admin\" || staff_id = @request.auth.id";
  collection.viewRule = "@request.auth.role = \"admin\" || staff_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("kpi");
  collection.listRule = "@request.auth.role = \"admin\"";
  collection.viewRule = "@request.auth.role = \"admin\"";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
