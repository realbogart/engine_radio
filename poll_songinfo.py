#!/usr/bin/env python

import argparse
from datetime import datetime
import os
from slackclient import SlackClient
import spotipy
import spotipy.util as util
import sys
import time


def read_songinfo(file_path='testfile'):
    song_info = ''

    # First check for file's existence
    try:
        if os.stat(file_path).st_size > 0:
            with open(file_path, 'r') as f:
                song_info = f.read()
        else:
            print 'File is empty, returning empty string'
    except OSError:
        print 'File does not exist, returning empty string'

    return song_info


def write_songinfo(info_string, file_path='testfile'):
    print "Writing info %s to file %s" % (info_string, file_path)
    with open(file_path, 'w') as f:
        f.write(info_string)


def set_happiness(valence):
    happiness = 'unset'
    if valence < 0.1:
        happiness = ':crying:'
    elif valence < 0.2:
        happiness = ':cry:'
    elif valence < 0.3:
        happiness = ':ohdear:'
    elif valence < 0.4:
        happiness = ':disappointed:'
    elif valence < 0.45:
        happiness = ':slightly_frowning_face:'
    elif valence < 0.55:
        happiness = ':neutral_face:'
    elif valence < 0.6:
        happiness = ':slightly_smiling_face:'
    elif valence < 0.7:
        happiness = ':grinning:'
    elif valence < 0.8:
        happiness = ':haw:'
    elif valence < 0.9:
        happiness = ':joy:'
    else:
        happiness = ':godmode:'

    return happiness


def get_spotify_songdata():

    # We require user to be set in environment variable
    spotify_user = os.environ.get('SPOTIFY_USER')
    token = util.prompt_for_user_token(spotify_user, 'user-read-playback-state')
    spotify = spotipy.Spotify(auth=token)
    spotify.trace = False

    try:
        user_data = spotify.current_user_currently_playing(spotify_user)
        artists = user_data['item']['artists']
        song_name = user_data['item']['name']
        song_id = user_data['item']['id']

        audio_features = spotify.audio_features([song_id])[0]
        bpm = int(audio_features['tempo'])
        valence = audio_features['valence']
        acousticness = audio_features['acousticness']
        danceability = audio_features['danceability']
        energy = audio_features['energy']

        song_data = {
            'song_id': song_id,
            'song_name': song_name,
            'artists': artists,
            'happiness': set_happiness(valence),
            'bpm': bpm,
            'acousticness': acousticness,
            'danceability': danceability,
            'energy': energy
        }

    # This error will sometimes be legit, with expired access token,
    # so pay attention to output if continuous errors occur.
    except spotipy.client.SpotifyException as e:
        print "error fetching data, trying again later: %s" % e
        song_data = {}

    return song_data


def get_local_file_songdata():
    print 'not yet implemented'
    return {}


def make_slackstring(song_data):
    song_string = song_data['song_name']
    artist_string = ''
    for artist in song_data['artists']:
        artist_string += "%s, " % artist['name']

    artist_string = artist_string.rstrip(', ')

    message_string = "Now playing: :notes: %s by %s :notes: BPM: %s, Happiness Level: %s" % (song_string, artist_string, song_data['bpm'], song_data['happiness'])

    if song_data['acousticness'] > 0.5:
        message_string += ':violin:'
    if song_data['energy'] > 0.5:
        message_string += ''
    if song_data['danceability'] > 0.5:
        message_string += ':slick:'

    return message_string


def post_slackmessage(slack_message):
    print "Posting message: %s" % slack_message

    slack_token = os.environ['SLACK_API_TOKEN']
    sc = SlackClient(slack_token)

    # this can time out
    try:
        sc.api_call(
            "chat.postMessage",
            channel="x_sweeptheleg",
            as_user=True,
            text=slack_message
        )
    except:
        print "%s - Error posting to slack in %s" % (datetime.now(), file_path)


def poll_loop(source, get_songdata, file_path, poll_interval=5):
    print "Starting loop with polling interval: %s" % poll_interval

    while True:
        #print "Sleep %s" % poll_interval
        time.sleep(poll_interval)

        song_data = get_songdata()
        if song_data != {}:
            song_id = song_data['song_id']
            song_id_string = "%s:%s" % (source, song_id)
            current_song = read_songinfo(file_path)
            if (song_id_string != current_song):
                write_songinfo(song_id_string, file_path)
                # TODO (per.hasselstrom 2019-09-27) The people thought the bot got too spammy
#                slack_string = make_slackstring(song_data)
#                post_slackmessage(slack_string)

            else:
                print "%s - Current song is the same as saved in %s" % (datetime.now(), file_path)

        else:
            print "%s - song data was empty, ignoring" % datetime.now()


def main(file_path, source, info_string=''):

    songdata_function_dict = {
        'spotify': get_spotify_songdata,
        'local_file': get_local_file_songdata,
    }

    print 'Starting up stuff...'
    print "Music source is %s" % source
    print "Filepath for butt song-info %s" % file_path
    print "Optional info_string is %s" % info_string

    poll_loop(source, songdata_function_dict[source], file_path)



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Polls for song changes and inputs the change to a file')
    parser.add_argument('-f', dest='file_path', action='store')
    parser.add_argument('-s', dest='source', action='store')
    parser.add_argument('-i', dest='info_string', action='store', default='')
    args = parser.parse_args()

    main(args.file_path, args.source, args.info_string)
