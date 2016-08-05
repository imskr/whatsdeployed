/**
 * $.parseParams - parse query string paramaters into an object.
 * https://gist.github.com/kares/956897
 */
(function($) {
var re = /([^&=]+)=?([^&]*)/g;
var decodeRE = /\+/g;  // Regex for replacing addition symbol with a space
var decode = function (str) {return decodeURIComponent( str.replace(decodeRE, " ") );};
$.parseParams = function(query) {
    var params = {}, e;
    while ( e = re.exec(query) ) {
        var k = decode( e[1] ), v = decode( e[2] );
        if (k.substring(k.length - 2) === '[]') {
            k = k.substring(0, k.length - 2);
            (params[k] || (params[k] = [])).push(v);
        }
        else params[k] = v;
    }
    return params;
};
})(jQuery);


function start(deployments, owner, repo) {

  var shas = {};
  $('#deployments').append($('<th>').text('Master'));
  $.each(deployments, function(i, thing) {
    var $th = ($('<th>').attr('id', thing.name+'-col')
      .append($('<a>').attr('title', 'Show column in Bugzilla').text(thing.name)));
    $('#deployments').append($th);
    shas[thing.name] = thing.sha;
  });
  function commit_url(sha) {
    return 'https://github.com/' + owner + '/' + repo + '/commit/' + sha;
  }
  function bug_url(id) {
    return 'https://bugzilla.mozilla.org/show_bug.cgi?id=' + id;
  }
  function bug_id(commit) {
    var msg = commit.commit.message;
    if (msg.match(/\d{6,7}/g)) return msg.match(/\d{6,7}/g)[0];
    return false;
  }

  function link_cols() {
    $.each(deployments, function(i, thing) {
      if (thing.bugs.length) {
        var bug_query = thing.bugs.join('%2C');
        $('#'+thing.name+'-col a')
          .attr('href', 'https://bugzilla.mozilla.org/buglist.cgi?bug_id='+bug_query+'&bug_id_type=anyexact&bug_status=ALL');
      }
    });
  }

  function makeMessage(commit) {
    var msg = commit.commit.message;
    var msg_split = msg.split(/\n\n+/);
    var msg_first;
    if (msg_split.length === 1) {
      msg_first = msg;
    } else {
      msg_first = msg_split[0];
    }
    var sha = commit.sha;
    var cell = $('<td>');
    if (commit.author && commit.author.avatar_url) {
      cell.append($('<a>')
                  .attr('href', commit.author.html_url)
      .append($('<img>')
               .attr('src', commit.author.avatar_url)
               .attr('width', '36')
         .attr('height', '36')));
    }

    bug_number = bug_id(commit);
    if (bug_number) {
      cell.append($('<a>')
                  .attr('href', bug_url(bug_number))
                  .data('id', bug_number)
                  .addClass('bug-' + bug_number)
                  .addClass('bugzilla')
                  .text(bug_number));
      cell.append($('<span>')
                  .text(' - '));
    }
    cell.append($('<a>')
                .attr('href', commit.html_url)
                .attr('title', msg)
                .text(msg_first));
    return cell;
  }
  //var first_sha = deployments[0].sha;
  $('#cap').hide();
  var commitsURL = 'https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=60';
  $.getJSON(commitsURL,
            //{sha: first_sha},
      function(response) {

    var matched = {};
    var $commits = $('#commits');
    var keep_going = true;
    var cap = true;

    $.each(response, function(i, commit) {
      if (!keep_going && cap) return;
      $.each(shas, function(name, sha) {
        if (sha === commit.sha) {
          matched[name] = true;
        } else if (sha === commit.sha.substring(0, 7)) {
          matched[name] = true;
          commit.sha = commit.sha.substring(0, 7);
        }
      });
      var row = $('<tr>').append(makeMessage(commit));
      var all = true;
      $.each(deployments, function(i, thing) {
        if (matched[thing.name]) {
          row.append($('<td>').append($('<i class="glyphicon glyphicon-ok"></i>')));
          bug_number = bug_id(commit);
          if (bug_number) thing.bugs.push(bug_number);
        } else {
          all = false;
          row.append($('<td>').text(''));
        }
      });
      row.appendTo($commits);
      if (all) {
        link_cols();
        fetchBugzillaMetadata();
        keep_going = false;
        $('#cap').show();
      }
    });

    var req = $.post('/shortenit', {url: location.href});
    req.then(function(r) {
      $('#shorten a').attr('href', r.url).text(
        location.protocol + '//' + location.host + r.url
      );
      $('#shorten').show();
    });
    req.fail(function(jqXHR, textStatus, errorThrown) {
      console.warn('URL shortening service failed', errorThrown);
    });

  })
  .fail(function() {
    console.error.apply(console, arguments);
    showGeneralError(
      'Unable to download commits for "' + commitsURL + '"'
    );
  });
}

function showGeneralError(html) {
  $('#error p').text(html);
  $('#table').hide();
  $('#error').show();
}

function init(owner, repo, deployments, callback) {
  document.title = "What's deployed on " + owner + "/" + repo + "?";
  var req = $.ajax({
    url: '/shas',
    type: 'POST',
    data: JSON.stringify(deployments),
    contentType: 'application/json'
  });
  req.then(function(response) {
    if (response.error) {
      showGeneralError(response.error);
    } else {
      start(response.deployments, owner, repo);
    }
    if (callback) callback();
  });
  req.fail(function(jqxhr, status, error) {
    console.warn("Unable to convert deployments to sha", error);
  });
  var repo_url = 'https://github.com/' + owner + '/' + repo;
  $('.repo').append($('<a>').attr('href', repo_url).text(repo_url));
  $.each(deployments, function(i, each) {
    $('<dd>').append($('<a>').attr('href', each.url).text(each.name))
      .insertAfter('.urls');
  });
}


function paramsToDeployment(qs, callback) {
  var params = $.parseParams(qs.split('?')[1]);
  var owner, repo;
  if (params.owner) {
    owner = params.owner;
    $('#owner').val(owner);
  }
  if (params.repo) {
    repo = params.repo;
    $('#repo').val(repo);
  }
  var names = params.name;
  if (!names) {
    throw "No parameter called 'names'";
  }
  var urls = params.url;
  if (!urls) {
    throw "No parameter called 'urls'";
  }
  var deployments = [];
  $.each(names, function(i, name) {
    if (i >= $('input[name="name[]"]').length) {
      $('a.more').click();
    }
    $('input[name="name[]"]').eq(-1).val(name);
    var url = urls[i];
    $('input[name="url[]"]').eq(-1).val(url);
    deployments.push({name: name, url: url});
  });
  if (owner && repo && deployments.length > 0) {
    init(owner, repo, deployments, callback);
    $('form').hide();
  } else if (callback) {
    callback();
  }
}

function fetchBugzillaMetadata() {
  var ids = [];
  $('a.bugzilla').each(function() {
    ids.push($(this).data('id'));
  });
  if (!ids.length) return;
  var data = {id: ids.join(','), include_fields: 'status,id,resolution'};
  var URL = 'https://api-dev.bugzilla.mozilla.org/1.3';
  var req = $.ajax({
    url: 'https://api-dev.bugzilla.mozilla.org/1.3/bug',
    data: data,
    contentType: 'application/json',
    accepts: 'application/json'
  });
  req.done(function(response) {
      if (response.bugs) {
        $.each(response.bugs, function(i, bug) {
          var $links = $('a.bug-' + bug.id);
          $links.attr('title', bug.status + ' ' + bug.resolution);
          if (bug.status === 'RESOLVED' || bug.status === 'VERIFIED') {
            $links.addClass('resolved');
          }
        });
      }
  });
}

$(function() {

  $('a.more').click(function() {
    $('.revisions')
      .append($('<input type="text" name="name[]" class="form-control" placeholder="Name">'))
      .append($('<input type="text" name="url[]" class="form-control" placeholder="URL to revision data">'));
    return false;
  });

  var dotter = setInterval(function() {
      var c = $('#cloak .dots');
      c.text(c.text() + '.');
      if (c.text().match(/\./g).length > 10) {
        clearInterval(dotter);
        $('#cloak p').text(" F' it! I give up! This is taking too long.");
      }
  }, 1000);

  if (location.search) {
    paramsToDeployment(location.search, function() {
      $('#cloak').hide();
      $('#table').fadeIn(500);
      clearInterval(dotter);
    });
  } else {
    $('form').fadeIn(500);
    $('#cloak').hide();
    clearInterval(dotter);
  }

});
