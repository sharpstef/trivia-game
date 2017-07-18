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
 
  Functions for Getting and Updating Question Entitities
 
*************************************************************************************************/
// Initialize Datastore
const project = process.env.GCLOUD_PROJECT;
const ds = require('@google-cloud/datastore')({
    projectId: project,
    keyFilename: './keyfile.json'
});

const kind = 'Question';

const user = {

    getQuestionsByFilter: (cat, diff, limit, done) => {
        const query = ds.createQuery(kind).filter('category', cat).filter('difficulty', diff).limit(25);
        ds.runQuery(query, (err, questions) => {
            if (err) {
                console.log("There was an error checking datastore: ", err);
                return done(err);
            } else if (questions.length > 0) {
                function getRandomSubarray(arr, size) {
                    if (arr.length <= size) {
                        return arr;
                    }
                    var shuffled = arr.slice(0),
                        i = arr.length,
                        temp, index;
                    while (i--) {
                        index = Math.floor((i + 1) * Math.random());
                        temp = shuffled[index];
                        shuffled[index] = shuffled[i];
                        shuffled[i] = temp;
                    }
                    return shuffled.slice(0, size);
                }
                var question_subset = getRandomSubarray(questions, limit);
                return done(null, question_subset);
            } else {
                return done("No questions found that match your criteria.");
            }
        });
    },
    updateCategory: (category, right, wrong, done) => {
        const query = ds.createQuery('Category').filter('name', category).limit(1);

        ds.runQuery(query, (err, cat) => {
            var chosen_cat;

            if (err) {
                console.log("There was an error checking ds: ", err);
                return done(err);
            }
            if (cat.length > 0) {
                chosen_cat = cat[0];
                var correct = chosen_cat.correct;
                var incorrect = chosen_cat.incorrect;
                var tot = incorrect + correct;
                
                chosen_cat.correct += right;
                chosen_cat.incorrect += wrong;
                
                if(tot > 0) {
                    chosen_cat.difficulty = (incorrect/tot) * 100;
                } else {
                    chosen_cat.difficulty = 0;
                }
               
                ds.update({
                    key: chosen_cat[ds.KEY],
                    data: chosen_cat
                }, err => {
                    if (err) {
                        console.log("There was an updating the category: ", err);
                        return done(err);
                    } else {
                        console.log("Category " + chosen_cat.name + " updated in datastore.");
                        return done(null, user);
                    }
                });
            } else {
                console.log("No categories found matching that name.");
                return ("No result");
            }
        });
    },
    getCategories: (done) => {
        const query = ds.createQuery('Category').order('difficulty',{descending: true});
        ds.runQuery(query, (err, cat) => {
            if (err) {
                console.log("There was an error checking ds:", err);
                return done(err);
            }
            if (cat.length > 0) {
                return done(null, cat);
            }
        });
    }
};

module.exports = user;