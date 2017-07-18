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
    var websocket;

    // Define variables for the main page elements
    var page1 = $('#page1');
    var page2 = $('#page2');
    var q = $('#question');
    var endGame = $('#end');
    var success = $('#confirmation');
    var catSelect = $('#cat_select');
    var pg1submit = $('#accept');
    var pg2submit = $('#start');
    var endsubmit = $('#finish');
    var rating = $('#rating');

    // Game specific metrics for user
    var status_display = $('#status_display');
    var score_modifier = $('#score_modifier');
    var score_num = $('#score_num');
    var diff_num = $('#diff_num');
    var streak_num = $('#streak_num');
    var ans_set1 = $('#answerSet .row:first-child');
    var ans_set2 = $('#answerSet .row:last-child');

    // Elements and resets for the countdown timer
    var timer = $('#timer');
    var countdown;
    var timeLimit = 2; //The time limit on the game in minutes
    var mins, sec, endTime, msLeft, time;

    // Holding game data and answer
    var qText = $('#qText');
    var record;
    var game = {};
    var end = false;

    var cat = []; // Hold for list of category names
    
    // Load the socket and connect
    ip.done(function(externalIP) {
        startSockets(externalIP);
    });

    // Get the user data to determine screen display
    user.done(function(data) {
        record = data; // Storing the user for bulk updating later
        if (data.location) {
            page2.fadeIn('slow');
        } else {
            loadFirstScreen(data.username,data.optout);
        }
    });
    
    // Get the categories for comparisons and display on game
    categories.done(function(data) {
        for(var i=0; i<data.length; i++){
            cat.push(data[i].name);

            var element = '<div class="6u 12u$(xsmall)">';
            element = element + '<input type="checkbox" id="'+i+'" name="'+i+'">';
            element = element + '<label for="'+i+'">'+data[i].name+'</label></div>';
            
            catSelect.prepend(element);
        }
    });
        
    // Toggle status of any checkbox when it's checked
    $("input[type='checkbox']").click(function() {
        $(this).is(':checked');
    });

    // Populate the dropdown element with the other option and display first panel 
    function loadFirstScreen(username,optout) {
        $('#optlabel').text('Opt-out of username display on leaderboards: ' + username);
        // Display the first screen to get opt-out and location
        page1.fadeIn('slow');
        
        $('#optout').prop("checked",optout);

        // Add the Option field in the zipcode dropdown
        var initialText = $('.custom').val();
        $('.customOption').val(initialText);

        $('#city').change(function() {
            var selected = $('option:selected', this).attr('class');

            if (selected === "custom") {
                $('.customOption').show();

                $('.customOption').keyup(function() {
                    var editText = $('.customOption').val();
                    $('.custom').val(editText);
                    $('.custom').html(editText);
                });

            } else {
                $('.customOption').hide();
            }
        });

        pg1submit.unbind("click").click(function() {
            var request = {};
            var location = $('#city').val();
            var optout = $('#optout').is(':checked');

            // Only update the user records that have changed
            record.location = location;
            record.optout = optout;
            
            request.user = JSON.stringify(record);
            request._csrf = $("input[name='_csrf']").val();

            $.ajax({
                url: '/api/update_user',
                data: request,
                dataType: 'json',
                error: function() {
                    console.log("Error trying to update the user.");
                },
                success: function(data) {
                    page1.fadeOut('slow', function() {
                        page2.fadeIn('slow');
                    });
                },
                type: 'POST'
            });

        });
    }

    pg2submit.unbind("click").click(function() {
        var request = {};
        var chosenCategories = [];

        // Loop through the category checkboxes to populate the chosenCategories
        for (var i = 0; i < 8; i++) {
            var element = '#' + [i];
            if ($(element).is(':checked') === true) {
                chosenCategories.push(cat[i]);
            }
        }
        
        // If the user didn't select any categories then give them all
        if (chosenCategories.length === 0) {
            chosenCategories = cat;
        }

        // Send the websocket server a game status of start with the categories
        request.status = 'start';
        request.categories = chosenCategories;

        websocket.send(JSON.stringify(request));
    });

  function categoryMultiplier(num_cats) {
    switch (num_cats) {
      case 1:
	return 0.6;

      case 2:
	return 0.8;

      case 3:
	return 1.0;

      case 4:
	return 1.1;

      case 5:
	return 1.2;

      case 6:
	return 1.3;

      case 7:
	return 1.4;

      case 8:
	return 1.5;

      default:
	return 1.0;
    }
  }

    function loadQuestion(msg) {
        var request = {};
        game = msg.game;
        var correctAnswer = msg.correctAns; 
        var answers = shuffle(msg.answers);
        var colors = ['green','yellow','blue','orange'];
        ans_set1.empty();
        ans_set2.empty();

        qText.html('<strong>Question: </strong>' + msg.questionText);

        // Populate the answers to display
        for (var i = 0; i < msg.answers.length; i++) {
            var element = '<div class="6u 12u$(xsmall)">'
                         + '<p class="answer '+colors[i]+'">'
                         + answers[i]+'</p></div>';
            
            if(i===0 || i===1) {
                ans_set1.append(element);
            }
            if(i===2 || i===3) {
                ans_set2.append(element);
            }
        }

        q.fadeIn('slow'); // Displays the new question
        
        // Update the difficulty display.
        diff_num.text(game.details.difficulty);

        $('.answer').unbind("click").click(function() {
            if(msLeft <= 3000) {
                end = true;
            }
            
            var ansText = $(this).text(); // Get the box the user selected
            if (ansText === correctAnswer && end===false) {
              var add_score = Math.ceil(game.details.difficulty * (10 + Math.min(10,game.correct_streak) * categoryMultiplier(game.categories.length)));
                
                game.details.right += 1;
                game.categories[msg.category_index].right += 1;
                game.current_correct += 1;

                game.details.score += add_score;
                game.correct_streak += 1;
                game.longest_streak = Math.max(game.correct_streak, game.longest_streak);

                // Update our score and streak displays.
                score_num.text(game.details.score);
                streak_num.text(game.correct_streak);
                score_modifier.text("+" + add_score);
                score_modifier.addClass("increase").removeClass("decrease");
                score_modifier.fadeIn(100, function() {
                    score_modifier.fadeOut(500);
                });

                // Check for a level up.
                if ((game.current_correct >= 5 || game.questions.length === 0) && game.details.difficulty < 5) {
                    status_display.text("Level up!");
                    status_display.addClass("level").removeClass("increase decrease");

                // We don't update the difficulty display here because we do it when the new question loads in.
                } else {
                    status_display.text("Correct!");
                    status_display.addClass("increase").removeClass("level decrease");
                }

                // Send the websocket server a game status of start with the categories
                request.status = 'question';
                request.game = game;
                
                // Throttling it to one answer per second
                if(game.details.right >= 120) {
                    end=true;
                    loadEndScreen();
                }

                if(end===false){
                    websocket.send(JSON.stringify(request));
                } else {
                    loadEndScreen();
                }
            } else if(ansText !== correctAnswer) {
                game.details.wrong += 1;
                game.categories[msg.category_index].wrong += 1;
                game.correct_streak = 0;
                
                status_display.text("Incorrect!");
	            status_display.addClass("decrease").removeClass("level increase");
                streak_num.text(game.correct_streak);

                endTime -= (1000 * 10); // Shave off ten seconds on their time
                clearTimeout(countdown);
                timer.empty(); // Reset the setTimeout function on updateTimer()
                
                if (msLeft <= 9000) { // They can't lost any more time so kill the game
                    console.log('Game over');
                    q.fadeOut("fast");
                    loadEndScreen();
                } else {
                    updateTimer(); // Restart the timer with new endTime
                    
                    // Show the decrease to the timer.
		            $('#flash').text("-00:10");
                    $('#flash').addClass('decrease');
		            $('#flash').fadeIn(100, function(){$('#flash').fadeOut(500);});

                    // Send the websocket server a game status of start with the categories
                    request.status = 'question';
                    request.game = game;

                    if(end===false) {
                        websocket.send(JSON.stringify(request));
                    } else {
                        loadEndScreen();
                    }
                }
            } else {
                q.hide();
            }
        });
    }

    function loadEndScreen() {
        end = true;
        var totQuestions = game.details.right + game.details.wrong;

        $('#totalQ').text(totQuestions);
        $('#right').text(game.details.right);
        $('#wrong').text(game.details.wrong);
        $('#score').text(game.details.score);
        $('#streak').text(game.longest_streak);
        $('#diff').text(game.details.difficulty);

        q.fadeOut("fast", function() {
            endGame.fadeIn("slow");
        });

        // User must submit scores for them to be saved
        endsubmit.unbind("click").click(function() {
            var request = {};
            var new_game = game.details;
            var allGames = record.totalGames;
            allGames = parseInt(allGames);
            new_game.id = allGames + 1;
            
            // Merging overall categories for Profile display
            var cat0 = record.categories;
            var cat1 = new_game.categories;
            var cat = cat0.concat(cat1);
            cat.sort();

            // Remove duplicates in overall categories and then prep the game for update 
            removeDuplicates(cat, function(err, cleansed) {
                record.categories = cleansed;

                // JQuery will flatten these so must stringify 
                // individual JSON objects to be parsed by endpoint.
                request.newGame = JSON.stringify(new_game);
                request.newUser = JSON.stringify(record);
                request.newCat  = JSON.stringify(game.categories);
                request._csrf = $("input[name='_csrf']").val();

                $.ajax({
                    url: '/api/update_games',
                    data: request,
                    dataType: 'json',
                    error: function() {
                        console.log("Error trying to update the user/city.");
                    },
                    success: function(data) {
                        record = data;
                        endGame.fadeOut("slow", function() {
                            displaySuccess();
                        });
                    },
                    type: 'POST'
                });
            });
        });
    }
    
    function displaySuccess() {
        var request = {};
        rating.empty();
        
        var stars = '<fieldset class="rating align-center">' 
                   +'<input type="radio" id="rating-5" name="rating" value="5" />'
                   +'<label for="rating-5">&nbsp;</label>'
                   +'<input type="radio" id="rating-4" name="rating" value="4" />'
                   +'<label for="rating-4">&nbsp;</label>'
                   +'<input type="radio" id="rating-3" name="rating" value="3" />'
                   +'<label for="rating-3">&nbsp;</label>'
                   +'<input type="radio" id="rating-2" name="rating" value="2" />'
                   +'<label for="rating-2">&nbsp;</label>'
                   +'<input type="radio" id="rating-1" name="rating" value="1" />'
                   +'<label for="rating-1">&nbsp;</label>'
                   +'</fieldset>';
        
        if(record.totalGames===1||record.rating===null) {
            rating.append(stars);
            rating.css("display","inline");
        }
        
        
        success.fadeIn().delay(800);
        
        $("input[type='radio']").click(function() {
            $(this).is(':checked');
            var stars = $(this).val();
                
            record.rating = stars;
                
                request.user = JSON.stringify(record);
                request._csrf = $("input[name='_csrf']").val();
                
                $.ajax({
                url: '/api/update_user',
                data: request,
                dataType: 'json',
                error: function() {
                    console.log("Error trying to update the user.");
                },
                success: function(data) {
                    rating.fadeOut();
                    rating.empty();
                },
                type: 'POST'
            });                                      
        });
    }

    // Randomize the answers
    function shuffle(array) {
        var currentIndex = array.length,
            temporaryValue, randomIndex;

        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }

    // Main logic for the countdown timer. timeLimit holds the start time.
    function updateTimer() {
        function twoDigits(n) {
            return (n <= 9 ? "0" + n : n);
        }

        msLeft = endTime - (+new Date);
        if (msLeft < 1000) {
            q.hide();
            timer.text('00:00');
            loadEndScreen();
        } else {
            time = new Date(msLeft);
            mins = time.getUTCMinutes();
            sec = time.getUTCSeconds();
            timer.text(twoDigits(mins) + ':' + twoDigits(sec));
            timer.append('<span style="visibility:hidden;">.</span><span id="flash" style="font-size: 0.8em;"></span><span style="visibility:hidden;">.</span>');
            countdown = setTimeout(updateTimer, time.getUTCMilliseconds() + 500);

        }
    }

    // For removing duplicate items in an array
    function removeDuplicates(words, callback) {
        var seen = {};
        var cleansed = [];
        var len = words.length;
        var j = 0;
        for (var i = 0; i < len; i++) {
            var item = words[i];
            if (seen[item] !== 1) {
                seen[item] = 1;
                cleansed[j++] = item;
            }
        }
        return callback(null, cleansed);
    }

    // Bulk of the game logic. App Engine Flex does not support wss so use http/ws. 89op'
    function startSockets(externalIp) {
        var webSocketHost = location.protocol === 'https:' ? 'wss://' : 'ws://';
        var webSocketUri = webSocketHost + externalIp + ':65080/game';

        /* Establish the WebSocket connection and register event handlers. */
        websocket = new WebSocket(webSocketUri);

        websocket.onopen = function() {
            console.log('Connected');
        };

        websocket.onclose = function() {
            console.log('Closed');
        };

        websocket.onmessage = function(e) {
            var msg = JSON.parse(e.data);

            // First request for a question kicks off the timer. 
            if (msg.status === 'first') {
                page2.fadeOut('slow', function() {
                    loadQuestion(msg);
                    endTime = (+new Date) + 1000 * (60 * timeLimit) + 500; // Set to 5 minutes
                    updateTimer();
                });
                // All other requests for questions just get a question object. 
            } else if (msg.status === 'question') {
                loadQuestion(msg);
            }
        };

        websocket.onerror = function(e) {
            console.log('Error: ', e);
        };
    }
});
