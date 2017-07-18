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
    var username = $('#username');
    var location = $('#location');
    var medals = $('#medals');
    var game = $('#game');
    var optout = $('#optout');
    var parent = $('#medal_one');
    var message = $('#message');
    var contest_score = $('#contestScore');
    var highest = $('#highScore');
    
    // Variables for looping through category elements
    var game_categories = [];
    var record;
    
    // Toggle status of checkbox when it's checked
    $("input[type='checkbox']").click(function() {
        $(this).is(':checked');
    });
    
    // Get the categories for the medals
    categories.done(function(data) {
        game_categories = data;
        
        for(var i=0; i<data.length; i++){
            var name = data[i].name;
            var short = data[i].short;
            var icon = data[i].icon;
            var color = data[i].color;
            
            // Split the eight icons in two row class elements
            if(i===4){
                parent = $('#medal_two');
            }

            var element = '<div class="3u 4u$(xxsmall)">';
            element = element + '<div id="'+short+'" class="medal '+color+' inactive">';
            element = element + '<span class="fa fa-'+icon+' cat_icon"></span>';
            element = element + '<span class="tooltiptext">'+name+'</span></div></div>';
            
            parent.append(element);
        }
        
        // Get the user data to determine screen display
        user.done(function(data) {
            record = data;
            populatePage(data);
        });
    });
    
    $('#update_user').unbind("click").click(function() {
        var request = {};
        record.username = username.val();
        record.optout = optout.is(':checked');
        request._csrf = $("input[name='_csrf']").val();

        request.user = JSON.stringify(record);

            $.ajax({
                url: '/api/update_user',
                data: request,
                dataType: 'json',
                error: function() {
                    message.text("Error updating. Please try again.");
                    console.log("Error trying to update the user.");
                },
                success: function(data) {
                    message.text("Update successful");
                },
                type: 'POST'
            });
        
    });
    
    function populatePage(data) {
        var cat = data.categories;
        var games = data.games;
        username.val(data.username);
        location.val(data.location);
        contest_score.text(data.contestScore);
        highest.text(data.highScore);
        
        optout.prop('checked', data.optout);
        
        if(cat.length > 0) {            
            for(var n=0;n<cat.length;n++) {
                var user_category = cat[n];
                
                for(var index=0;index<game_categories.length;index++){
                    if(game_categories[index].name === user_category) {
                        var div = '#'+game_categories[index].short;
                        $(div).removeClass('inactive');
                    }
                }
            }
            
            $('#catLabel').text('Categories: ('+cat.length+'/8)');        
        }
        
        if(games.length > 0) {
            var header = "<thead><tr><th>Date</th><th>Score</th><th>Categories</th></tr></thead>";
            $('#game').append(header);
            var row = "";
            var limit = Math.min(games.length, 5);
            
            for(var i=games.length-1;i>limit-(games.length+1);i--){
                var month = new Date(games[i].date).getMonth();
                var day = new Date(games[i].date).getDate();
                var year = new Date(games[i].date).getFullYear();
                var date = month+'-'+day+'-'+year;

                var categories = games[i].categories;
                categories = categories.join(', ');
                var score = games[i].score;
                row = "<tr><td>"+date+"</td><td>"+score+"</td><td>"+categories+"</td></tr>";
                
                $('#game').append(row);
                
            }
            
            var post; 
            if(games.length>1) {
                post = ' games played)';
            } else {
                post = ' game played)';
            }
            $('#gamesLabel').text('Past Games: ('+games.length+post);
        }
        
    }
    
});