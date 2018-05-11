
// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Requiring our Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
var Saved = require("./models/Saved.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
var router = express.Router();

var path = require("path");
// Set mongoose for JavaScript ES6 Promises
mongoose.Promise = Promise;

var port = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));

// Make public a static dir
app.use(express.static("public"));

var port = process.env.PORT || 3000;

// Database configuration with mongoose
var databaseUri = "mongodb://localhost/mongoScraper";

if(process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI);
} else {
  mongoose.connect(databaseUri);
}

var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
    console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function() {
    console.log("Mongoose connection successful.");
});

// Routes
// ======
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post("/saved:id", function(req, res) {
    // Create a new saved and pass the req.body to the entry
    var newSaved = new Saved(req.body);

    // And save the new note the db
    newSaved.save(function(error, doc) {
        // Log any errors
        if (error) {
            console.log(error // Otherwise
            );
        } else {
            // Use the article id to find and update it's note
            Article.findOneAndUpdate({
                    "_id": req.params.id
                }, {"saved": true })
                // Execute the above query
                .exec(function(err, doc) {
                    // Log any errors
                    if (err) {
                        console.log(err);
                    } else {
                        // Or send the document to the browser
                        console.log("saved the article");
                        res.send(doc);
                    }
                });
        }
    });

});


// A GET request to scrape a boxing website
app.get("/scrape", function(req, res) {
    // First, we grab the body of the html with request
    request("http://www.nytimes.com/section/world", function(error, response, html) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(html);
        // Now, we grab every h2 within an article tag, and do the following:
        $("article h2").each(function(i, element) {

            // Save an empty result object
            var result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this).children("a").text();
            result.link = $(this).children("a").attr("href");
            result.saved = true;

            // Using our Article model, create a new entry
            // This effectively passes the result object to the entry (and the title and link)
            var entry = new Article(result);

            // Now, save that entry to the db
            entry.save(function(err, doc) {
                // Log any errors
                if (err) {
                    console.log(err // Or log the doc
                    );
                } else {

                    console.log(doc);

                }
            });

        });

        res.send("test");
    });
});



// This will get the articles we scraped from the mongoDB
app.get("/articles", function(req, res) {
    // Grab every doc in the Articles array
    Article.find({}, function(error, doc) {
        // Log any errors
        if (error) {
            console.log(error // Or send the doc to the browser as a json object
            );
        } else {
            res.json(doc);
        }
    });
});

//Grab all saved articles
app.get("/saved", function(req, res) {
    // Grab every doc in the Articles array
    Article.find({"saved": true}, function(error, doc) {
        // Log any errors
        if (error) {
            console.log(error // Or send the doc to the browser as a json object
            );
        } else {
            res.json(doc);
        }
    });
});

// Grab an article by it's ObjectId
app.get("/savedArticles/:id", function(req, res) {
    console.log("Req.params.id: "+req.params.id);
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    Article.findOne({ "_id": req.params.id })
        // ..and populate all of the notes associated with it
        .populate("note")
        // now, execute our query
        .exec(function(error, doc) {
            // Log any errors
            if (error) {
                console.log(error // Otherwise, send the doc to the browser as a json object
                );
            } else {
                res.json(doc);
            }
        });
});

// Create a new note or replace an existing note
app.post("/savedArticles/:id", function(req, res) {
    // Create a new note and pass the req.body to the entry
    var newNote = new Note(req.body);

    // And save the new note the db
    newNote.save(function(error, doc) {
        // Log any errors
        if (error) {
            console.log(error // Otherwise
            );
        } else {
            // Use the article id to find and update it's note
            Article.findOneAndUpdate({
                    "_id": req.params.id
                }, { "note": doc._id })
                // Execute the above query
                .exec(function(err, doc) {
                    // Log any errors
                    if (err) {
                        console.log(err);
                    } else {
                        // Or send the document to the browser
                        res.send(doc);
                    }
                });
        }
    });
});

app.get("/savedArticles", function(req,res){
    res.sendFile(path.join(__dirname, "./public/savedArticles.html"));
});

// Listen on port 3000
app.listen(port, function() {
    console.log("App running on port 3000 !");
});
// Index Page Render (first visit to the site)
router.get('/', function (req, res){

  // Scrape data
  res.redirect('/scrape');

});


// Articles Page Render
router.get('/articles', function (req, res){

  // Query MongoDB for all article entries (sort newest to top, assuming Ids increment)
  Article.find().sort({_id: -1})

    // But also populate all of the comments associated with the articles.
    .populate('comments')

    // Then, send them to the handlebars template to be rendered
    .exec(function(err, doc){
      // log any errors
      if (err){
        console.log(err);
      } 
      // or send the doc to the browser as a json object
      else {
        var hbsObject = {articles: doc}
        res.render('index', hbsObject);
        // res.json(hbsObject)
      }
    });

});


// Web Scrape Route
router.get('/scrape', function(req, res) {

  // First, grab the body of the html with request
  request('http://www.nytimes.com/section/world', function(error, response, html) {

    // Then, load html into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);

    // This is an error handler for the Onion website only, they have duplicate articles for some reason...
    var titlesArray = [];

    // Now, grab every everything with a class of "inner" with each "article" tag
    $('article .inner').each(function(i, element) {

        // Create an empty result object
        var result = {};

        // Collect the Article Title (contained in the "h2" of the "header" of "this")
        result.title = $(this).children('header').children('h2').text().trim() + ""; //convert to string for error handling later

        // Collect the Article Link (contained within the "a" tag of the "h2" in the "header" of "this")
        result.link = 'www.nytimes.com/section/world' + $(this).children('header').children('h2').children('a').attr('href').trim();

        // Collect the Article Summary (contained in the next "div" inside of "this")
        result.summary = $(this).children('div').text().trim() + ""; //convert to string for error handling later
      

        // Error handling to ensure there are no empty scrapes
        if(result.title !== "" &&  result.summary !== ""){

          // BUT we must also check within each scrape since the Onion has duplicate articles...
          // Due to async, moongoose will not save the articles fast enough for the duplicates within a scrape to be caught
          if(titlesArray.indexOf(result.title) == -1){

            // Push the saved item to our titlesArray to prevent duplicates thanks the the pesky Onion...
            titlesArray.push(result.title);

            // Only add the entry to the database if is not already there
            Article.count({ title: result.title}, function (err, test){

              // If the count is 0, then the entry is unique and should be saved
              if(test == 0){

                // Using the Article model, create a new entry (note that the "result" object has the exact same key-value pairs of the model)
                var entry = new Article (result);

                // Save the entry to MongoDB
                entry.save(function(err, doc) {
                  // log any errors
                  if (err) {
                    console.log(err);
                  } 
                  // or log the doc that was saved to the DB
                  else {
                    console.log(doc);
                  }
                });

              }
              // Log that scrape is working, just the content was already in the Database
              else{
                console.log('Not saved to DB, This Data Was Already Saved.')
              }

            });
        }
        // If scraper is working but the data is missing parts
        else{
          console.log('Parts Not Saved to DB.')
        }

      }
      // Log that scrape is working but all the data is missing
      else{
        console.log('Database Working But NO Content.')
      }

    });

    // Working on articale page redirect. This is the should be done after the request and data is logged to the database for scoping concerns
    res.redirect("/articles");

  });

});


// Comment Route - My API
router.post('/add/comment/:id', function (req, res){

  // Article id
  var articleId = req.params.id;
  
  // Author Name
  var commentAuthor = req.body.name;

  // Comment Content
  var commentContent = req.body.comment;

  // "result" object key-value pairs matches Comment model
  var result = {
    author: commentAuthor,
    content: commentContent
  };

  // Create a new comment entry
  var entry = new Comment (result);

  // Save the entry to the database
  entry.save(function(err, doc) {
    // log any errors
    if (err) {
      console.log(err);
    } 
 
    else {
      // Push the comment to the comment list 
      Article.findOneAndUpdate({'_id': articleId}, {$push: {'comments':doc._id}}, {new: true})
      // execute the above query
      .exec(function(err, doc){
        // log any errors
        if (err){
          console.log(err);
        } else {
          // If successful
          res.sendStatus(200);
        }
      });
    }
  });

});




// Delete a Comment Route
router.post('/remove/comment/:id', function (req, res){

  // Collect comment id
  var commentId = req.params.id;

  // Find and Delete the Comment using the Id
  Comment.findByIdAndRemove(commentId, function (err, todo) {  
    
    if (err) {
      console.log(err);
    } 
    else {
      // Send Success Header
      res.sendStatus(200);
    }

  });

});


// Export Router to Server.js
module.exports = router;