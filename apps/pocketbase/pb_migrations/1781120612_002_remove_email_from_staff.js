/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");
  collection.fields.removeByName("email");
  return app.save(collection);
}, (app) => {
  try {

  const collection = app.findCollectionByNameOrId("staff");
  collection.fields.add(new EmailField({
    name: "email",
    required: false
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
