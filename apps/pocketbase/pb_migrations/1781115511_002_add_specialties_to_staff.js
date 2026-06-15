/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("staff");

  const existing = collection.fields.getByName("specialties");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("specialties"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "specialties",
    required: true,
    values: ["Telesale", "Ch\u0103m s\u00f3c kh\u00e1ch h\u00e0ng", "Tr\u1ef1c page", "Sale Offline", "\u0110i\u1ec1u d\u01b0\u1ee1ng", "B\u00e1c s\u0129", "Content", "Media", "Editor Ousource", "Designer"],
    maxSelect: 10
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("staff");
    collection.fields.removeByName("specialties");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
