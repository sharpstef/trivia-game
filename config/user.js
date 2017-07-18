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
 
  Functions for Getting and Updating User Entities 
 
*************************************************************************************************/
// Initialize Datastore
const project = process.env.GCLOUD_PROJECT;
const ds = require('@google-cloud/datastore')({
    projectId: project,
    keyFilename: './keyfile.json'
});

const kind = 'User';

const user = {

    getUser: (id, done) => {
        const query = ds.createQuery(kind).filter('google.id', id).limit(1);
        ds.runQuery(query, (err, users) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (users.length > 0) {
                const user = users[0];
                return done(null, user);
            }
        });
    },
    getTopPlayers: (city, done) => {
        const query = ds.createQuery(kind).filter('highScore', '>', 0).order('highScore',{descending: true}).limit(4);
        ds.runQuery(query, (err, users) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (users.length > 0) {
                const topWorldPlayers = [];
                for(var i=0;i<users.length;i++) {
                    var player = {};
                    if(users[i].optout === true || users[i].optout === "true") {
                        player.username = "anonymous";
                    } else {
                        player.username = users[i].username;
                    }
                    
                    player.score = users[i].highScore;
                    player.optout = users[i].optout;
                    
                    topWorldPlayers.push(player);
                }     
                return done(null, topWorldPlayers);
            }
        });
    },
    updateUser: (user, done) => {
        const query = ds.createQuery(kind).filter('google.id', user.google.id).limit(1);

        ds.runQuery(query, (err, users) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (users.length > 0) {
                const key = users[0][ds.KEY];
                ds.update({
                    key: key,
                    data: user
                }, err => {
                    if (err) {
                        console.log("There was an updating the user: ", err);
                        return done(err);
                    } else {
                        console.log("User " + user.username + " updated in datastore.");
                        return done(null, user);
                    }
                });
            }
        });
    } 
};

module.exports = user;