#!/usr/bin/env python

import argparse
import os
import soundcloud # lib called "six" is a dependency to this
import spotipy
import spotipy.util as util
import sys
import time


def read_songinfo(file_path='testfile'):
    print "Checking file %s for content" % file_path
    # First check for file's existence
    try:
        if os.stat(file_path).st_size > 0:
            print 'File exists, reading content'
        else:
            print 'File is empty, returning empty string'
            return ''
    except OSError:
        print 'File does not exist, returning empty string'
        return ''

    song_info = ''
    with open(file_path, 'r') as f:
        song_info = f.read()

    return song_info


def write_songinfo(info_string, file_path='testfile'):
    print "Writing info %s to file %s" % (info_string, file_path)
    with open(file_path, 'w') as f:
        f.write(info_string)


def get_spotify_songid():
    print "Getting spotify song id"
    token = util.prompt_for_user_token('perolus', 'user-read-playback-state')
    spotify = spotipy.Spotify(auth=token)
    spotify.trace = False

    user_data = spotify.current_user_currently_playing('perolus')
    artists = user_data['item']['artists']
    song_name = user_data['item']['name']
    song_id = user_data['item']['id']

#    print "got id %s for song %s artist %s" % (song_id, song_name, artists)
    return song_id


def get_soundcloud_songid():

    # waiting for application for app connection (yes really)
#    client = soundcloud.Client(client_id=YOUR_CLIENT_ID)

    song_id = 'not yet'
    return song_id


def poll_loop(source, get_songid, file_path, poll_interval=5):
    print "Starting loop with polling interval: %s" % poll_interval

    while True:
        print "Sleep %s" % poll_interval
        time.sleep(poll_interval)

        song_id = "%s:%s" % (source, get_songid())
        current_song = read_songinfo(file_path)
        if (song_id != current_song):
            write_songinfo(song_id, file_path)
        else:
            print "Current song is the same as saved in %s" % file_path


def main(file_path, source, info_string=''):

    songid_function_dict = {
        'spotify': get_spotify_songid,
        'soundcloud': get_soundcloud_songid,
    }

    print 'Starting up stuff...'
    print "Music source is %s" % source
    print "Filepath for butt song-info %s" % file_path
    print "Optional info_string is %s" % info_string

    poll_loop(source, songid_function_dict[source], file_path)



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Polls for song changes and inputs the change to a file')
    parser.add_argument('-f', dest='file_path', action='store')
    parser.add_argument('-s', dest='source', action='store')
    parser.add_argument('-i', dest='info_string', action='store', default='')
    args = parser.parse_args()

    main(args.file_path, args.source, args.info_string)
