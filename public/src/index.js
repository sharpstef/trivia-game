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
$(document).ready(function() {

    var topPlayers = $('#topPlayers');
    var topCity = $('#cities');
    var topCat = $('#categories');

    var topWorld = $.Deferred();
    var cityData = $.Deferred();

    var locations = [];
    var map;
    var events = [];

    // Retrieve the top three players in the world regardless of locale
    $.getJSON("api/world_top", function(data) {
        if (data.length > 0) {
            topWorld.resolve(data);
        }
    });

    // City data for each of the cities to populate top players by city and world map
    $.getJSON("api/city_data", function(data) {
        if (data.length > 0) {
            cityData.resolve(data);
        }
    });

    cityData.done(function(cities) {

        for (var i = 0; i < cities.length; i++) {
            var cityObject = {
                name: null,
                radius: 0,
                players: 0,
                country: null,
                fillKey: null,
                latitude: 0,
                longitude: 0
            };
            var city = cities[i];
            var players = city.topPlayers;

            cityObject.name = city.name;
            cityObject.players = city.totalPlayers;
            cityObject.country = city.country;
            cityObject.fillKey = city.country;
            cityObject.latitude = parseFloat(city.latitude);
            cityObject.longitude = parseFloat(city.longitude);

            var radius = Math.max(city.totalPlayers * 1.2, 5); // Max the radius out at 100
            cityObject.radius = Math.min(radius, 25); // Default radius of 5 for all cities

            events.push(cityObject);

            // Now populate the table with top players for each city
            var cityDiv = '<li id='+city.short+'><div class="table-wrapper stats"><table class="alt">';
            cityDiv = cityDiv + '<tfoot><tr><td colspan="2">' + city.name + '</td></tfoot>';

            if (players && players.length > 0) {
                for (var p = 0; p < players.length; p++) {
                    var username, score;
                    username = players[p].username;
                    score = players[p].score;

                    cityDiv = cityDiv + '<tbody><tr><td>' + username + '</td>';
                    cityDiv = cityDiv + '<td>' + score + '</td></tr>';
                }
                cityDiv = cityDiv + '</tbody></table></table></div></li>';
                topCity.append(cityDiv);
            }
        }

        renderMap();

        $('#cities').bxSlider({
            pager: false,
            adaptiveHeight: true,
            nextText: '>',
            prevText: '<'

        });

    });

    topWorld.done(function(players) {
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var playerDiv = '<tr><td>' + player.username + '</td>';
            playerDiv = playerDiv + '<td>' + player.score + '</td></tr>';

            topPlayers.append(playerDiv);
        }
    });
    
    // Get the categories for toughest categories
    categories.done(function(data) {
        for(var i=0; i<data.length/2; i++) {
            topCat.append('<tr><td>'+data[i].name+'</td></tr>');
        }
    });

    /*************************************************************************************************
      
      Variables for Map Options
       
    *************************************************************************************************/
    /* geoConfig is for the overall map functions. We have highlight on hover off for the countries */
    var geoConfig = {
        hideAntarctica: true,
        hideHawaiiAndAlaska: true,
        borderWidth: 1,
        borderOpacity: 1,
        borderColor: '#FDFDFD',
        popupOnHover: true, // True to show the popup while hovering
        highlightOnHover: false
    };
    /* bubbleConfig is for the player size in each location with attributes. */
    var bubbleConfig = {
        borderWidth: 2,
        borderOpacity: 1,
        borderColor: '#EAEAEA',
        popupOnHover: true, // True to show the popup while hovering
        radius: null,
        popupTemplate: function(geography, data) { // This function should just return a string
            return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.85,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: 'rgb(255, 152, 76)',
        highlightBorderColor: 'rgba(255, 213, 0, 0.2)',
        highlightBorderWidth: 2,
        highlightBorderOpacity: 1,
        highlightFillOpacity: 0.90,
        exitDelay: 100, // Milliseconds
        key: JSON.stringify
    };


    /*************************************************************************************************
      
      Create the Map
       
    *************************************************************************************************/
    function renderMap() {
        map = new Datamap({
            scope: 'world',
            element: document.getElementById('map'),
            responsive: true,
            height: 500,
            fills: {
                'USA': 'rgb(39, 228, 253)',
                'Switzerland': 'rgb(253, 211, 47)',
                'Canada': 'rgb(64, 231, 184)',
                defaultFill: '#3d5afe'
            },
            data: {
                'USA': {
                    fillKey: 'USA'
                },
                'CHE': {
                    fillKey: 'Switzerland'
                },
                'CAN': {
                    fillKey: 'Canada'
                }
            },
            bubblesConfig: bubbleConfig,
            geographyConfig: geoConfig,
            setProjection: function(element) {
                var projection = d3.geo.equirectangular()
                    .rotate([20, 0])
                    .scale(300)
                    .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
                var path = d3.geo.path()
                    .projection(projection);
                return {
                    path: path,
                    projection: projection,
                };
            },
            done: function(datamap) {
                datamap.svg.call(d3.behavior.zoom().scaleExtent([1, 3]).on("zoom", redraw));

                function redraw() {
                    datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                }
            }
        });

        window.addEventListener('resize', function() {
            map.resize();
        });

        map.bubbles(events, {
            popupTemplate: function(geo, data) {
                return ['<div class="hoverinfo">' + data.name,
                    '<br/>Players: ' + data.players + '',
                    '<br/>Country: ' + data.country + '',
                    '</div>'
                ].join('');
            }
        });
    }

});