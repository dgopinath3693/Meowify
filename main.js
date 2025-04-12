const { app, BrowserWindow } = require('electron');
const express = require('express');
const querystring = require('querystring');
const axios = require('axios');
const open = require('open').default;
const path = require('path');
require('dotenv').config();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = 'http://127.0.0.1:8888/callback';

let access_token = '';
let refresh_token = '';

const server = express();
const PORT = 8888;

function generateRandomString(length) {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += text.charAt(Math.floor(Math.random() * text.length));
    }
    return result;
}

server.get('/login', function (req, res) {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing';
    const authURL = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        });

    open(authURL);
    res.send('Logging in...');
});

server.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;

    if (state === null) {
        res.send('State mismatch error');
        return;
    }

    try {
        const authOptions = {
            method: 'POST',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
            }
        };

        const response = await axios(authOptions);
        access_token = response.data.access_token;
        refresh_token = response.data.refresh_token;

        res.send(`
            Authentication successful! You can close this window.
            <br>Access token: ${access_token}
            <br>Refresh token: ${refresh_token}
        `);
        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        await getCurrentTrack();
    } catch (err) {
        console.error('Error exchanging the token:', err);
        res.send('Failed to authenticate');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
});

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 400,
        height: 200,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
});

const getCurrentTrack = async () => {
    if (!access_token) {
        console.error('Access token is not set.');
        return;
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        if (response.data && response.data.item) {
            console.log('Current Track:', response.data.item.name);
        } else {
            console.log('Nothing is currently playing.');
        }
    } catch (err) {
        console.error('Error fetching current track:', err.response?.data || err.message);
    }
};
