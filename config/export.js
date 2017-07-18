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
 
  Exporting Winners to Google Sheet 
 
*************************************************************************************************/
'use strict';
var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');

// Set up the spreadsheet to export to and connect
const doc = new GoogleSpreadsheet('SPREADSHEET_ID');
var sheet;
var creds = require('../keyfile.json');


    doc.useServiceAccountAuth(creds, (err) => {
        doc.getInfo((err, info) => {
            if(err) {
                return;
            }
            
            console.log('Loaded doc: ' + info.title);

            // Check to see if the datatores export sheet exists at position 0
            if (info.worksheets[0].title === 'Export from Datastore [DO NOT DELETE]') {
                sheet = info.worksheets[0];
            } else {
                doc.addWorksheet({
                    title: 'Export from Datastore [DO NOT DELETE]'
                }, (err, sheet) => {
                    sheet.setHeaderRow(['Name', 'Email', 'Score', 'Location']);
                });
            }

            sheet = info.worksheets[0];
        });
    });

const export_data = {
    addRow: (entity, done) => {

        doc.addRow(1, {
            name: entity.google.name,
            email: entity.google.email,
            score: entity.contestScore,
            location: entity.location
        }, (err) => {
            if (err) {
                console.log("Error updating the winners spreadsheet with user: ", entity.username);
                return done(err);
            } else {
                return (null, entity);
            }
        });
    }
};

module.exports = export_data;