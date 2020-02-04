const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';

module.exports = {
  loadSchedules : function(onSchedulesLoaded) {
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      authorize(JSON.parse(content), loadSheets, onSchedulesLoaded);
    });
  }
}

function authorize(credentials, callback, onSchedulesLoaded) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, onSchedulesLoaded);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function parseFormulaValue(formulaValue)
{
  var valueStart = formulaValue.substring( formulaValue.search( "\"" ) + 1 );
  var valueStop = valueStart.search( "\"" );
  var value = valueStart.substring( 0, valueStop );

  return value;
}

function getStringValue(value)
{
  if( value.hasOwnProperty('numberValue') )
    return value.numberValue.toString();
  else if( value.hasOwnProperty('stringValue') )
    return value.stringValue.trim();
  else if( value.hasOwnProperty('formulaValue') )
    return parseFormulaValue(value.formulaValue);

  return value;
}

function getTime(time)
{
  time = getStringValue(time);

  if( time.length == 1 )
    time = "0" + time;

  time = time + ":00";
  return time;
}

function validShow(show)
{
  if( !show.name || !show.time || show.time.length > 5 )
  {
    return false;
  }

  return true;
}

function parseSheets(targetSheet)
{
  var schedulesOut = [];
  for(var sheet in targetSheet.data.sheets){
    var currentSheet = targetSheet.data.sheets[sheet];
    var schedule = { title: currentSheet.properties.title, shows: [] };

    for(var data in currentSheet.data){
      var currentData = currentSheet.data[data];

      for(var rowData in currentData.rowData){
        var currentRowData = currentData.rowData[rowData];

        var show = {};
        for(var value in currentRowData.values){
          var currentValue = currentRowData.values[value].userEnteredValue;

          if( currentValue == null )
          {
            continue;
          }

          if( value == 0 )
            show.time = getTime(currentValue);
          else if( value == 1 )
            show.dj = getStringValue(currentValue);
          else if( value == 2 )
            show.name = getStringValue(currentValue);
          else if( value == 4 )
            show.playlistLink = getStringValue(currentValue);
          else if( value == 5 )
            show.imageLink = getStringValue(currentValue);
        }

        if( validShow(show) )
        {
          schedule.shows.push(show);
        }
      }
    }
    schedulesOut.push(schedule);
  }

  return schedulesOut;
}

function loadSheets(auth, onSchedulesLoaded) {
  const sheets = google.sheets({version: 'v4', auth});
  sheets.spreadsheets.get({
    spreadsheetId: '1lBzctjGqE86mxsCATYq8jp1jXXLYIN8Bd7kYMvxWvFE',
    fields: 'sheets(properties(title),data(rowData(values(textFormatRuns,userEnteredValue,note))))'
  }, (err, res) => {
    if (err) {
      console.error(err);
      return;
    }

    onSchedulesLoaded( parseSheets(res) );
  });
}
