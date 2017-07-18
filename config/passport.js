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
 
  Passport Authentication for Google Strategy 
 
*************************************************************************************************/
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Initialize Datastore
const project = process.env.GCLOUD_PROJECT;
const ds = require('@google-cloud/datastore')({
  projectId: project,
  keyFilename: './keyfile.json'
});

// Load clientID, callback, and secret from auth file
const configAuth = require('./auth');

module.exports = function(passport) {
    
    const kind = 'User';

    // used to serialize the user for the session
    passport.serializeUser((user, done) => {
        done(null, user.google.id);
    });

    // used to deserialize the user
    passport.deserializeUser((id, done) => {
       const query = ds.createQuery(kind).filter('google.id',id).limit(1);
            
            ds.runQuery(query, (err, users) => {
                if (err) {
                    console.log("There was an error checking datastore: ",err);
                    return done(err);
                }
                if (users.length>0) {
                    //console.log("User found in datastore. Confirming login.");
                    const user = users[0];
                    return done(null, user);
                }
           });
    });

    /************************************************************************************************* 
  
      Google Strategy
    *************************************************************************************************/
    const callback = process.env.GOOGLE_CALLBACK || configAuth.googleAuth.callbackURL;
    
    passport.use(new GoogleStrategy({

        clientID        : configAuth.googleAuth.clientID,
        clientSecret    : configAuth.googleAuth.clientSecret,
        callbackURL     : callback,

    },
    (token, refreshToken, profile, done) => {

        process.nextTick(() => {

            // try to find the user based on their google id
            const query = ds.createQuery(kind).filter('google.id',profile.id).limit(1);
            
            ds.runQuery(query, (err, users) => {
                
                if (err) {
                    console.log("There was an error checking ds: ",err);
                    return done(err);
                }
                if (users.length>0) {
                    const user = users[0];
                        return done(null, user);
                } else {
                    const key = ds.key(kind);                    
                    const data = {
                        highScore: 0,
                        contestScore: 0,
                        totalGames: 0, 
                        games: [],
                        rating: null,
                        categories: [],
                        optout: null,
                        location: null};
                    const google = {};
                    
                    // set all of the relevant information
                    google.id    = profile.id;
                    google.token = token;
                    google.name  = profile.displayName;
                    google.email = profile.emails[0].value; 
                    
                    data.google     = google;
                    data.username   = profile.emails[0].value.split("@")[0].trim();

                    console.log("User entity: ",data);

                    // save the user
                    ds.insert({
                        key: key, 
                        data: data
                    }, err => {
                        if (err) {
                            console.log("There was an error registering the user: ${err}");
                            return done(err);
                        } else {
                            console.log("User "+data.google.name+" added to datastore.");
                            return done(null, data);
                        }
                    });
                }
            });
        });

    }));

};
