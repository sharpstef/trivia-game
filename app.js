/*
  Copyright 2017 Google Inc.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
/*jshint esnext: true*/
/*************************************************************************************************
 
  Define global variables for NPM packages 
 
*************************************************************************************************/
'use strict';
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const hb = require('express-handlebars');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const session = require('express-session');
const memcache = require('connect-memcached')(session);
const expressWS = require('express-ws');
const fs = require('fs');
const request = require('request');
const helmet = require('helmet');
const csurf = require('csurf');
// Import auth and datastore operations for user, question, and location
require('./config/passport.js')(passport);
const user = require('./config/user');
const question = require('./config/question');
const location = require('./config/cities');
const sheet = require('./config/export');
/************************************************************************************************* 
  
  Configure Server
   
*************************************************************************************************/
const NODE_ENV = process.env.NODE_ENV || 'development';
const MEMCACHE_URL = process.env.MEMCACHE_URL || 'pub-memcache-19814.us-central1-1-1.gce.garantiadata.com:19814';

const app = express();
app.use(helmet());
const sessionConfig = {
    name: 'SESS_ID',
    resave: false,
    saveUninitialized: false,
    secret: 'supersecretsquirrel',
    cookie: { maxAge : 3600000, httpOnly: true, SameSite: true}
};
sessionConfig.store = new memcache({
    hosts: [MEMCACHE_URL]
});
    
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
 
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
var csrfToken = csurf({ cookie: false }); 
app.use(csrfToken);

app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
//app.use(morgan('dev')); // log every request to the console for testing
app.use(express.static(__dirname + '/public'));

// Enable the app to use web sockets
expressWS(app);
/*************************************************************************************************
  
  Routes for Pages and Login Auth
   
*************************************************************************************************/
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/profile', ensureLoggedIn('/auth/google'), (req, res) => {
    res.render('profile',{ csrfToken: req.csrfToken() });
});
app.get('/game', ensureLoggedIn('/auth/google'), (req, res) => {
    res.render('game',{ csrfToken: req.csrfToken() });
});
app.get('/faq', (req, res) => {
    res.render('faq');
});
app.get('/getIP', (req, res) => {
    getExternalIp(function(externalIp) {
        res.json({
            addr: externalIp
        });
    });
});
app.get('/api/user_data', (req, res) => {
    if (req.user === undefined) {
        res.json({});
    } else {
        var response = {};
        response.username = req.user.username;
        response.optout = req.user.optout;
        response.location = req.user.location;
        response.totalGames = req.user.totalGames;
        response.highScore = req.user.highScore || 0;
        response.categories = req.user.categories || [];
        if(req.user.games[0]) {
            response.contestScore = req.user.games[0].score;
        } else {
            response.contestScore = 0;
        }
        response.games = req.user.games || [];
        response.rating = req.user.rating || null;
        res.json(response);
    }
});
// Get the top three players worldwide regardless of if they are at an I/O location
app.get('/api/world_top', (req, res) => {
    user.getTopPlayers(req, (err, data) => {
        if (err) {
            console.log("Error getting top players: ", err);
            return res.status(err.code || 500).json(err);
        } else {
            //console.log("Grabbed players: ", data);
            return res.json(data);
        }
    });
});
// Get a JSON array of all of the cities for the index page
app.get('/api/city_data', (req, res) => {
    getCities((err, data) => {
        if (err) {
            console.log("Error getting cities: ", err);
            return res.status(err.code || 500).json(err);
        } else {
            var count = 0;

            function cb(array) {
                res.json(array);
            }
            for (var i = 0; i < data.length; i++) {
                var city = data[i];
                var cities = [];
                location.getTopPlayers(city, (players) => {
                    if (players) {
                        cities.push(players);
                    }
                    count++;
                    if (count === data.length) {
                        cb(cities);
                    }
                });
            }
        }
    });
});
// Get a JSON array of all of the categories for the index/game
app.get('/api/cat_data', (req, res) => {
    getCategories((err, data) => {
        if (err) {
            console.log("Error getting categories: ", err);
            return res.status(err.code || 500).json(err);
        } else {
            return res.json(data);
        }
    });
});
app.get('/logout', (req, res) => {
    req.session.destroy(function (err) {
        res.redirect('/'); 
    });
});
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
app.get('/auth/google/callback', passport.authenticate('google', {
    successReturnToOrRedirect: '/',
    failureRedirect: '/auth/google'
}));
/************************************************************************************************* 
  
  Retrieve and Update Entities
   
*************************************************************************************************/
// Fired after the user chooses their location and selects opt-out. They will only see this screen once.
app.post('/api/update_user', (req, res) => {
    var newUser = JSON.parse(req.body.user);
    newUser.google = req.user.google;
    user.updateUser(newUser, (err, data) => {
        if (err) {
            console.log("Error updating the user record: ", err);
            return res.status(err.code || 500).json(err);
        } else {
            return res.json(data);
        }
    });
});
// Fired when the game ends. This will update the user first and then the city if 
// they are in one of the I/O extended cities. Otherwise it skips the city update. 
app.post('/api/update_games', (req, res) => {
    var new_game = JSON.parse(req.body.newGame);
    var new_user = JSON.parse(req.body.newUser);

    if(new_game.score >= 15600 || new_game.right >= 75 || new_game.score < 0) {
        console.error("User "+new_user.username+"is cheating. Drop score.");
        return res.json(JSON.parse(req.body.newUser));
    } else {
    // Prep new game object for games array in User entity  
    var games = req.user.games || [];
    games.push(new_game);
    
    // Prep updates to the User entity
    new_user.games = games;
    new_user.totalGames = games.length;
    if(games.length===1) {
        new_user.contestScore = new_game.score;
    }
    
    new_user.highScore = Math.max(new_user.highScore, new_game.score);

    var updated_user = new_user; //Grab updated user profile to send back to client
    
    new_user.google = req.user.google;
    
    // Send the categories off to be updated
    var newCat = JSON.parse(req.body.newCat);
    updateCategories(newCat);
    
    user.updateUser(new_user, (err, data) => {
        if (err) {
            console.log("Error updating the user record: ", err);
            return res.status(err.code || 500).json(err);
        } else {
            console.log("Updated the user: ", new_user.google.username);
            
            var goog = new_user.google.email.includes("google.com");
            
            // If this is their first submission then add them to Google Sheet for winner tracking
            // Skip anyone with a google.com email
            if(new_user.totalGames === 1 && goog === false) {
                sheet.addRow(new_user, (err, response) => {
                    if(err) {
                        console.log("Error adding the user to the spreadsheet: "+err);
                    } 
                });
            }
            
            var city = req.user.location;
            var cities = [];
            getCities((err, data) => {
                if (err) {
                    console.error("Can't get the city shortnames at this time.");
                } else {
                    for (var i = 0; i < data.length; i++) {
                        cities.push(data[i].short);
                    }
                    // First check to see if user location is one of the I/O cities
                    if (cities.indexOf(city) === -1) {
                        console.log("User outside of I/O locations. No need to update city.");
                        return res.json(updated_user);
                    } else {
                        console.log("Updating the city with new user data.");
                        if (new_user.totalGames === 1) {
                            location.updateLocation(city, (err, results) => {
                                if (err) {
                                    console.log("Error updating the user record: ", err);
                                    return res.status(err.code || 500).json(err);
                                } else {
                                    return res.json(updated_user);
                                }
                            });
                        } else {
                            return res.json(updated_user);
                        }
                    }
                }
            });
        }
    });
    }
});
/************************************************************************************************* 
  
  FUnctions to retrieve and Update Entities
   
*************************************************************************************************/
function getCities(done) {
    location.getAllCities((err, data) => {
        if (err) {
            console.log("Error getting cities: ", err);
            return done(err);
        } else {
            return done(null, data);
        }
    });
}

function getCategories(done) {
    question.getCategories((err, data) => {
        if (err) {
            console.log("Error getting categories: ", err);
            return done(err);
        } else {
            return done(null, data);
        }
    });
}

function updateCategories(arr) {
    for(var i=0; i<arr.length; i++) {
        var name = arr[i].name;
        var right = parseInt(arr[i].right);
        var wrong = parseInt(arr[i].wrong);
    
        question.updateCategory(name,right,wrong, (err, data) => {
            if (err) {
                console.log("Error getting categories: ", err);
            } 
        });
    }
}
//Update this to compare results with questions already answered and select a fresh question
function getQuestions(category, done) {
    question.getQuestionsByFilter(category.name, game.details.difficulty, Math.ceil(16 / game.categories.length), (err, results) => {
        // Set the minimum and maximum of the category in question.
        // The if statement is for sanity checking. It really shouldn't
        // be necesssary, but just in case.
        if (typeof game.categories[game.category_index] !== 'undefined') {
            game.categories[game.category_index].min_index = game.questions.length;
        }
        // If an error happens, we don't have anything meaningful to add.
        if (!err) {
            game.questions = game.questions.concat(results);
        }
        if (typeof game.categories[game.category_index] !== 'undefined') {
            game.categories[game.category_index].max_index = game.questions.length;
        }
        // Skip to the next category.
        game.category_index += 1;
        // If that was the last category, go to the final callback and serve the question.
        if (game.category_index >= game.categories.length) {
            return done(err, results);
        } else {
            // If not, we need to load in the next category.
            getQuestions(game.categories[game.category_index], done);
        }
    });
    //console.log(game);
}
// Change the file and uncomment for question load from json file
/*
const project = process.env.GCLOUD_PROJECT;
const ds = require('@google-cloud/datastore')({
    projectId: project,
    keyFilename: './keyfile.json'
});
const kind = 'Question';
        const file = require('./config/data/languages.json');
        const questions = file['questions'];
        for (var i = 0; i < questions.length; i++) {
            const q = questions[i].text;
            const key = ds.key(kind);
            const data = questions[i];
            console.log(data);
            ds.save({
                key: key,
                data: data
            }, (err, doc) => {
                if (err) {
                    console.log("There was an adding the q: ", q);
                } else {
                    console.log("Question " + q + " added to datastore.");
                }
            });
        }
*/
/************************************************************************************************* 
  
  Game Logic
   
*************************************************************************************************/
// Web socket for game
var game = {};
var game_details = {};
var q = {}; // The newest question.

app.ws('/game', (ws) => {
    ws.on('message', (message) => {
        var output_message = {};
        message = JSON.parse(message);
        
        // User has entered their categories, create the game object and grab the first question
        if (message.status === 'start') {
            
            // Game details are properties to be stored in the user object at game end. The rest of the game
            // object is for the life of the game only. 
            game_details.date = new Date();
            game_details.right = 0;
            game_details.wrong = 0;
            game_details.categories = message.categories;
            game_details.difficulty = 0;
            game_details.score = 0;
            
            game.correct_streak = 0;
            game.longest_streak = 0;
            game.questions = [];
            game.categories = [];
            game.current_correct = 0;
            
            for (var i = 0; i < message.categories.length; i++) {
                // Each element in this loop should have the category name, the current difficulty level
                // for that category, an array of questions, and the index of the next question.
                const new_category = {};
                new_category.name = message.categories[i];
                new_category.difficulty = 0;
                new_category.questions = {};
                
                /* These two variables keep track of the minimum and maximum indices for questions
	               in the question array that belong to this particular category.
	               Min index is inclusive, max index is not. Or to give it in equation form:
	               bool index_belongs = (min_index <= index) && (index < max_index). */
                new_category.min_index = 0;
                new_category.max_index = 0;
                
                // This just tracks how many right/wrong answers were given for this category over
                // the course of the game.
                new_category.right = 0;
                new_category.wrong = 0;
                game.categories.push(new_category);
            }

            game.details = game_details;
            output_message.status = 'first'; // Alert client that this is the first question
            levelUp(output_message, ws);
            
        } else if (message.status === 'question') {
            game = message.game;
          if (game.questions.length === 0 || (game.current_correct >= 5 && game.details.difficulty < 5)) { 
                levelUp(message, ws);
            } else {
                serveQuestion(message, ws);
            }
        } else {
            console.log("Nothing to do.");
        }
    });
    ws.on('close', () => {
        console.log('WebSocket was closed');
    });
});

function levelUp(message, ws) {
    // First things first,  if we aren't already at max, bump up the difficulty by one.
    if (game.details.difficulty < 5) {
        game.details.difficulty += 1;
        game.current_correct = 0;
    }
    // Wipe out the current questions from the game.
    game.questions = [];
    game.category_index = 0;
    // TODO if no categories then switch to all categories
    if (game.categories.length > 0) {
        getQuestions(game.categories[game.category_index], (err, data) => {
            serveQuestion(message, ws);
        });
    } else {
        console.error("No categories selected.");
    }
    // Placeholder.
    //console.log(game);
}

function serveQuestion(message, ws) {
    // Next we pick a question at random from the ones we've stored in the game.
    var question_index = Math.floor(Math.random() * game.questions.length);
    var category_index = getCategoryIndex(question_index);
    if (typeof game.questions[question_index] === 'undefined') {
        console.error("Invalid question index. Check that the query fetched valid questions.");
        console.log(game);
    } else {
        q = game.questions[question_index];
        // Remove the question we're asking about from the game object.
        game.questions.splice(question_index, 1);
        message.questionText = q.text;
        message.correctAns = q.correctAns;
        message.answers = q.answers;
        message.game = game;
        message.game.details.difficulty = game.details.difficulty;
        message.category_index = category_index;
        //Convert output_message object to string before sending
        message = JSON.stringify(message);
        ws.send(message);
    }
}

function getCategoryIndex(question_index) {
    for (var i = 0; i < game.categories.length; i++) {
        if (game.categories[i].min_index <= question_index && question_index < game.categories[i].max_index) {
            return i;
        }
    }
    console.error("Unable to match question to category.");
}
/************************************************************************************************* 
  
  Start the Server
   
*************************************************************************************************/
const METADATA_NETWORK_INTERFACE_URL = 'http://metadata/computeMetadata/v1/' +
    '/instance/network-interfaces/0/access-configs/0/external-ip';

function getExternalIp(cb) {
    const options = {
        url: METADATA_NETWORK_INTERFACE_URL,
        headers: {
            'Metadata-Flavor': 'Google'
        }
    };
    request(options, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
            console.log('Error while talking to metadata server, assuming localhost');
            cb('localhost');
            return;
        }
        cb(body);
    });
}
// Start the websocket server
const wsServer = app.listen('65080', () => {
    console.log('Websocket server listening on port %s', wsServer.address().port);
});
// Additionally listen for non-websocket connections on the default App Engine
// port 8080. Using http.createServer will skip express-ws's logic to upgrade
// websocket connections.
const PORT = process.env.PORT || 8080;
http.createServer(app).listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});
