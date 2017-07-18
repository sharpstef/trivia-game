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
'use strict';

var user = $.Deferred();
var ip = $.Deferred();
var cities = $.Deferred();
var categories = $.Deferred();
var nav = $('#navLinks');

// Get the user login state to determine which navigation links to display
getUserData(function(err,data) {
    if(data) {
        var links = '<li><a href="/profile" id="profile" class="btn btn-danger">Profile</a></li><li><a href="/logout" id="logout" class="btn btn-danger">Logout</a></li>';
        nav.append(links);
        addNavPanel();
        
        user.resolve(data);
    } else {
        var links = '<li><a href="/auth/google" id="login" class="btn btn-danger"></span>Login</a></li>';
        
        nav.append(links);
        addNavPanel();
    }
}); 

getCategories();

// Append the navigation panel for mobile to the page as invisible until scaled down
function addNavPanel(){
    nav = $('#navLinks').html();
    $('<div id="navPanel">' +
        '<nav><ul>' +
        nav +
        '</ul></nav>' +
        '<a href="#navPanel" class="close"></a>' +
        '</div>'
    )
    .appendTo($('body'))
    .panel({
        delay: 500,
        hideOnClick: true,
        hideOnSwipe: true,
        resetScroll: true,
        resetForms: true,
        side: 'left'
    });
}

// Get the IP address from the server to start the web socket
$.getJSON("/getIP", function(data) {
    if (data.hasOwnProperty('addr')) {
        ip.resolve(data.addr);
    } else {
        console.log("Error: Unable to get the IP from server.");
    }
});

function getUserData(callback) {
    $.getJSON("api/user_data", function(data) {
        if (data.hasOwnProperty('username')) {
            return callback(null, data);
        } else {
            return callback(null,null);
        }
    });
}

function getCities(callback) {
    $.getJSON("api/city_data", function(data) {
        if (data[0].hasOwnProperty('short')) {
            cities.resolve(data);
        } else {
            console.log("Error retrieving cities");
        }
    });
}

function getCategories(callback) {
    $.getJSON("api/cat_data", function(data) {
        if (data[0].hasOwnProperty('short')) {
            categories.resolve(data);
        } else {
            console.log("Error retrieving categories.");
        }
    });
}