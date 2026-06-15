/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attendance");
  collection.fields.removeByName("approval_status");
  return app.save(collection);
}, (app) => {
  try {

  const collection = app.findCollectionByNameOrId("attendance");
  collection.fields.add(new SelectField({
    name: "approval_status",
    required: false,
    values: ["pending", "approved", "rejected"],
    maxSelect: 0
  }));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
