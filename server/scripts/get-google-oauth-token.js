/**
 * Google OAuth 2.0 Refresh Token Helper
 * Run this script to generate a Refresh Token for your personal Google Drive (15GB storage)
 * Usage: node server/scripts/get-google-oauth-token.js <CLIENT_ID> <CLIENT_SECRET>
 */
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const clientId = process.argv[2] || process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GOOGLE_CLIENT_SECRET;
const PORT = 3005;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!clientId || !clientSecret) {
    console.log('\n❌ Usage: node server/scripts/get-google-oauth-token.js <CLIENT_ID> <CLIENT_SECRET>\n');
    console.log('1. Go to Google Cloud Console -> APIs & Services -> Credentials');
    console.log('2. Click "Create Credentials" -> "OAuth client ID"');
    console.log('3. Application Type: "Web application"');
    console.log(`4. Add Authorized redirect URI: ${REDIRECT_URI}`);
    console.log('5. Copy Client ID and Client Secret, then run this command.\n');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
});

console.log('\n======================================================');
console.log('  GOOGLE OAUTH2 REFRESH TOKEN GENERATOR (15GB DRIVE)  ');
console.log('======================================================\n');
console.log('👉 Please open this URL in your browser and authorize with your Google account:');
console.log('\n' + authUrl + '\n');
console.log(`Waiting for authorization callback on http://localhost:${PORT}/oauth2callback ...\n`);

const server = http.createServer(async (req, res) => {
    try {
        if (req.url.startsWith('/oauth2callback')) {
            const qs = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
            const code = qs.get('code');
            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<h1>Authorization Successful!</h1><p>You can close this tab and return to your terminal.</p>');

                const { tokens } = await oauth2Client.getToken(code);
                console.log('\n🎉 SUCCESS! Here are your environment variables to add to Render and server/.env:\n');
                console.log(`GOOGLE_CLIENT_ID=${clientId}`);
                console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
                console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
                console.log('\n======================================================\n');

                server.close();
                process.exit(0);
            }
        }
    } catch (err) {
        console.error('Error getting tokens:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error retrieving token: ' + err.message);
    }
}).listen(PORT);
