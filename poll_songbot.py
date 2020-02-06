#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
from datetime import datetime
import os
import requests
import slack
import spotipy
import spotipy.util as util
import sys
import time


def read_statefile(file_path='testfile'):
    state_content = ''
    # First check for file's existence
    try:
        if os.stat(file_path).st_size > 0:
            with open(file_path, 'r') as f:
                state_content = f.read()
        else:
            print ('File {} is empty, returning empty string'.format(file_path))
    except OSError:
        print ('File {} does not exist, returning empty string'.format(file_path))

    return state_content


def write_stateinfo(info_string, file_path='testfile'):
    print ('Writing info {} to file {}'.format(info_string, file_path))
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


def get_songdata():

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
        print ('error fetching data, trying again later: {}'.format(e))
        song_data = {}

    # Assumption on this error to happen when non-spotify-stuff is playing
    except TypeError as e:
        print ('error fetching data, trying again later: {}'.format(e))
        song_data = {}

    return song_data


def make_songstring(song_data):
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


def post_slackmessage(slack_message, channel, thread_timestamp=''):
    print ('Posting message: {}'.format(slack_message))

    slack_token = os.environ['SLACK_API_TOKEN']
    sc = slack.WebClient(slack_token)

    # this can time out
    try:
        response = sc.chat_postMessage(
            channel=channel,
            as_user=True,
            text=slack_message,
            thread_ts=thread_timestamp
        )

    except:
        print ('{} - Error posting to slack'.format(datetime.now()))
        response = 'error'

    return response


def get_showlist():
    schedule_response = requests.get(f"http://sweeptheleg.club/getSchedule")
    return schedule_response.json()['shows']


def get_current_showindex(showlist, current_date):

    current_index = -1
    current_time = datetime.now()

    # Need to exit out at the last showlist-entry, so skip it in iterating
    for show in showlist:
        next_showtime_string = '{}T{}'.format(current_date, showlist[current_index+1]['time'])
        next_showtime = datetime.strptime(next_showtime_string, '%Y-%m-%dT%H:%M')

        if (current_time > next_showtime):
            current_index += 1

        print (showlist[current_index]['name'])
        print (current_index)

    return current_index


def poll_loop(songfile_path, threadid_file, poll_interval=5):
    print (f"Starting loop with polling interval: {poll_interval}")

    #slack_channel = 'U18MMQ15L' # per's user
    slack_channel = 'theband'
    #slack_channel = 'x_sweeptheleg'
    print (f"Posting to slack channel: {slack_channel}")

    current_date = datetime.now().date()
    thread_timestamp = read_statefile(threadid_file)
    showlist = get_showlist()
    current_showindex = get_current_showindex(showlist, current_date)
    print (f"Current showindex: {current_showindex}")

    while True:
        time.sleep(poll_interval)
        current_time = datetime.now()

        # Yes we do fetch showlist in the pollling - in case it has changed during the day
        showlist = get_showlist()

        if (current_showindex+1 < len(showlist)):
            next_showtime_string = '{}T{}'.format(current_date, showlist[current_showindex+1]['time'])
            next_showtime = datetime.strptime(next_showtime_string, '%Y-%m-%dT%H:%M')

            if (current_time > next_showtime):
                if (current_showindex > -1 and 'playlistLink' in showlist[current_showindex]):
                    playlist_message = 'Playlist link: {}'.format(showlist[current_showindex]['playlistLink'])
                    response = post_slackmessage(playlist_message, slack_channel, thread_timestamp)

                current_showindex += 1
                show_message = ':ablobhype::black_square_for_stop: *Time for a new show!* {} presents: {} :ablobhype::arrow_forward:'.format(showlist[current_showindex]['dj'], showlist[current_showindex]['name'])

                response = post_slackmessage(show_message, slack_channel)
                thread_timestamp = response['ts']
                write_stateinfo(thread_timestamp, threadid_file)

                showswitch_response = requests.get(f"http://sweeptheleg.club/set?activeShow={current_showindex}")
                print (f"Show switch response: {showswitch_response}")

        if ('playlistLink' in showlist[current_showindex] and 'spotify' in showlist[current_showindex]['playlistLink']):
            song_data = get_songdata()
        else:
            song_data = {}
            current_songinfo = read_statefile(songfile_path)
            if (current_songinfo != 'nonspotify'):
                write_stateinfo('nonspotify', songfile_path)
                response = post_slackmessage('No spotify information available in this show', slack_channel, thread_timestamp)

        if song_data != {}:
            song_id = song_data['song_id']
            song_id_string = "%s:%s" % ('spotify', song_id)
            current_song = read_statefile(songfile_path)
            if (song_id_string != current_song):
                write_stateinfo(song_id_string, songfile_path)
                song_string = make_songstring(song_data)
                response = post_slackmessage(song_string, slack_channel, thread_timestamp)

            else:
                print ("{} - Current song is the same as saved in {}".format(datetime.now(), songfile_path))

        else:
            print ("{} - song data was empty, ignoring".format(datetime.now()))


def main(songfile_path, threadid_file, info_string=''):

    print ('Starting up stuff...')
    print ("Filepath for butt song-info {}".format(songfile_path))
    print ("Optional info_string is {}".format(info_string))
    print ("Threadid_file: {}".format(threadid_file))

    poll_loop(songfile_path, threadid_file)



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Polls for song & schedule changes, notifies slack')
    parser.add_argument('-f', dest='songfile_path', action='store')
    parser.add_argument('-t', dest='threadid_file', action='store')
    parser.add_argument('-i', dest='info_string', action='store', default='')
    args = parser.parse_args()

    main(args.songfile_path, args.threadid_file, args.info_string)
