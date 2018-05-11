// Require mongoose
var mongoose = require("mongoose");
// Create a schema class
var Schema = mongoose.Schema;

// Create the Note schema
var SavedSchema = new Schema({
  // Just a string
 link: {
    type: String
  },
  // Just a string
  headline: {
    type: String
  }
});

// Remember, Mongoose will automatically save the ObjectIds of the notes
// These ids are referred to in the Article model

// Create the Note model with the NoteSchema
var Saved = mongoose.model("Saved", SavedSchema);

// Export the Note model
module.exports = Saved;