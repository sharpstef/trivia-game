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
'use strict';
/*************************************************************************************************
 
  Functions for Getting and Updating Location Entities
 
*************************************************************************************************/
// Initialize Datastore
const project = process.env.GCLOUD_PROJECT;
const ds = require('@google-cloud/datastore')({
    projectId: project,
    keyFilename: './keyfile.json'
});

const kind = 'Location';

const city = {

    getLocation: (id, done) => {
        const query = ds.createQuery(kind).filter('name', id).limit(1);
        ds.runQuery(query, (err, cities) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (cities.length > 0) {
                const city = cities[0];
                return done(null, city);
            }
        });
    },

    updateLocation: (city, done) => {
        const query = ds.createQuery(kind).filter('short', city).limit(1);

        ds.runQuery(query, (err, cities) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (cities.length > 0) {
                const location = cities[0];
                const key = location[ds.KEY];

                location.totalPlayers++;

                ds.update({
                    key: key,
                    data: location
                }, err => {
                    if (err) {
                        console.log("There was an updating the city: ", err);
                        return done(err);
                    } else {
                        console.log("City " + city + " updated in datastore.");
                        return done(null, city);
                    }
                });

            }
        });
    },
    getAllCities: (done) => {
        const query = ds.createQuery(kind).order('name', {
            descending: true
        });
        ds.runQuery(query, (err, cities) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (cities.length > 0) {
                return done(null, cities);
            }
        });
    },
    getTopPlayers: (city, done) => {
        var topPlayers = [];
        var short = city.short;
        var new_city = city;

        const query = ds.createQuery('User').filter('location', short).filter('highScore','>',0).order('highScore', {
            descending: true
        }).limit(4);

        ds.runQuery(query, (err, users) => {
            if (err) {
                console.log("There was an error checking ds:", err);
            }

            if (users) {
                for (var n = 0; n < users.length; n++) {
                    var player = {};
                    if (users[n].optout === true || users[n].optout === "true") {
                        player.username = "anonymous";
                    } else {
                        player.username = users[n].username;
                    }

                    player.score = users[n].highScore;
                    player.optout = users[n].optout;

                    topPlayers.push(player);
                }
                new_city.topPlayers = topPlayers;
                return done(new_city);
            } else {
                new_city.topPlayers = [];
                return done(new_city);
            }
        });
    }
};

module.exports = city;