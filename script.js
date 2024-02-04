/* DISKaard by Shilo Tobin 2024
 * ============================================
 * DISKaard - Your Personal Disk Space Monitor
 * ============================================
 *
 * Description:
 * ------------
 * DISKaard is a Node.js application that monitors your disk space and sends notifications to a Discord channel. It uses the Discord.js library to interact with Discord and Axios to make HTTP requests. The application fetches disk space information from an API endpoint and filters the data based on the defined drives. If there's a significant change in disk space (1GB or more) or if it's the initial post, it sends a notification to Discord. It also sends a daily report to Discord with the disk space information and the change in the last 24 hours.
 *
 * Setup Instructions:
 * -------------------
 * 1. Install Node.js: Download and install Node.js from the official website (https://nodejs.org). This will also install npm (Node Package Manager) which is used to install Node.js modules.
 *
 * 2. Install Modules: Open a terminal/command prompt, navigate to the directory where you saved this script, and run the following command to install the necessary modules:
 *    - `npm install axios discord.js fs`
 *
 * 3. Create a Discord Bot: Go to the Discord Developer Portal (https://discord.com/developers/applications), create a new application, navigate to the "Bot" tab, and click "Add Bot". You'll find your bot token here which you'll need in the next step. **Important: Write down your bot token and keep it secure to prevent having to reset it.**
 *
 * 4. Invite the Bot to Your Server: In the "OAuth2" tab, under "Scopes", select "bot", and under "Bot Permissions", select "View Channels" and "Send Messages". Then, open the generated URL in a web browser and invite the bot to your server.
 *
 * 5. Configure the Script: Open the script in a text editor and replace the placeholders with your actual values. Here's how to obtain each variable:
 *    - `ARR_API_KEY`: This is your Radarr or Sonarr API key. You can find this in the settings of your Radarr or Sonarr application.
 *    - `ARR_URL`: This is the URL of your Radarr or Sonarr application. It's usually `http://localhost:8989` for Sonarr and `http://localhost:7878` for Radarr.
 *    - `DISCORD_BOT_TOKEN`: This is the bot token you got from step 3.
 *    - `DISCORD_CHANNEL_ID`: This is the ID of the Discord channel where you want to send the notifications. You can find this by right-clicking the channel in Discord and selecting "Copy ID".
 *    - `DRIVES`: This is an array of your drives that you want to monitor. Each drive is an object with a `path` and an `alias`. The `path` is the actual path of the drive and the `alias` is a nickname for the drive.
 *
 * 6. Run the Script: In the terminal/command prompt, run the script with the command `node script.js` (replace "script.js" with the name of your script file).
 *
 * Running as a Service:
 * ---------------------
 * 7. Install NSSM: Download NSSM from the official website (https://nssm.cc/download). Extract the zip file and navigate to the folder that matches your system architecture (either Win32 or Win64).
 *
 * 8. Install the Script as a Service: Open a command prompt as an administrator, navigate to the NSSM folder, and run the following command to install the script as a service:
 *    - `nssm install DiskSpaceMonitor`
 *    Replace "DiskSpaceMonitor" with the name you want to give to the service.
 *
 * 9. Configure the Service: A GUI will open where you can configure the service. Set the "Path" to the location of your Node.js executable (you can find this by running `where node` in the command prompt), set the "Startup directory" to the location of your script, and set the "Arguments" to the name of your script file. Click "Install service" to finish the installation.
 *
 * 10. Start the Service: You can start the service by running the following command in the command prompt:
 *    - `nssm start DiskSpaceMonitor`
 *    Replace "DiskSpaceMonitor" with the name you gave to the service.
 *
 * Your script should now be running as a service and will start automatically when your computer starts. You can check the status of your service by running `nssm status DiskSpaceMonitor`.
 */



const axios = require('axios');
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

//===========NO NEED TO EDIT ANYTHING ABOVE HERE===========

// Define your API keys, URLs, and IDs
const ARR_API_KEY = 'your_sonarr_or_radarr_api_key_goes_here'; 
	// Your Radarr or Sonarr API key (Sonarr is set as the default URL, if you use Radarr, you must change the URL)
const ARR_URL = 'http://localhost:8989'; 
	// Your Radarr or Sonarr URL (currently set to Sonarr's default URL, if this is different from your URL, add it here)
const DISCORD_BOT_TOKEN = 'your_discord_bot_token_goes_here'; 
	// Your Discord bot token which can be found on the Discord Devloper portal
const DISCORD_CHANNEL_ID = 'your_discord_channel_id_goes_here'; 
	// The ID of the Discord channel to send messages to

// Define the time for the daily report
const REPORT_HOUR = 20; // The hour of the day to send the report (24-hour format)
const REPORT_MINUTE = 0; // The minute of the hour to send the report
const REPORT_SECOND = 0; // The second of the minute to send the report 

// Define your drives here
const DRIVES = [
    { path: 'D:\\', alias: 'TV' }, // Each drive requires a path and an alias, for linux use mount point "/mnt/TV", "/mnt/Movies"
    { path: 'E:\\', alias: 'Movies' }
	//{ path: '#:\\', alias: '######' }
    // Add more drives as needed
];

//===========NO NEED TO EDIT ANYTHING BELOW HERE===========

const JSON_FILE_30_MIN = './diskSpace30Min.json';
const JSON_FILE_DAILY = './diskSpaceDaily.json';

let diskSpaceInfo30Min = fs.existsSync(JSON_FILE_30_MIN) ? JSON.parse(fs.readFileSync(JSON_FILE_30_MIN)) : { hasSentInitialPost: false, diskSpace: [] };
let diskSpaceInfoDaily = fs.existsSync(JSON_FILE_DAILY) ? JSON.parse(fs.readFileSync(JSON_FILE_DAILY)) : { hasSentInitialDailyReport: false, diskSpace: [] };

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

async function getDiskSpace() {
    try {
        console.log('Fetching disk space...');
        const response = await axios.get(`${ARR_URL}/api/v3/diskspace`, {
            headers: { 'X-Api-Key': ARR_API_KEY }
        });
        console.log('Response from API received');
        const filteredData = response.data.filter(drive => DRIVES.some(d => drive.path.startsWith(d.path)));
        console.log('Filtered data based on defined drives');
        if (filteredData.length > 0) {
            const diskSpace = filteredData.map(drive => {
                const freeSpaceGB = (drive.freeSpace / (1024 ** 3)).toFixed(2);
                const totalSpaceGB = (drive.totalSpace / (1024 ** 3)).toFixed(2);
                const remainingPercent = ((drive.freeSpace / drive.totalSpace) * 100).toFixed(2);
                const label = DRIVES.find(d => drive.path.startsWith(d.path)).alias;
                return { label, freeSpaceGB, totalSpaceGB, remainingPercent };
            });
            console.log('Fetched disk space:', diskSpace);
            return diskSpace;
        }
    } catch (error) {
        console.error('Error fetching Sonarr disk space information:', error);
        return null;
    }
}

async function sendMessageToDiscord(diskSpace, previousDiskSpace) {
    try {
        console.log('Preparing to send message to Discord...');
        const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
        if (!channel) {
            throw new Error('Discord channel not found');
        }
        const messages = diskSpace.map(drive => {
            const previousDrive = previousDiskSpace.find(prevDrive => prevDrive.label === drive.label);
            let change = 0;
            let changeText = 'No change';
            if (previousDrive) {
                change = drive.freeSpaceGB - previousDrive.freeSpaceGB;
                if (change !== 0) {
                    changeText = `${Math.abs(change).toFixed(2)}GB ${change < 0 ? 'added' : 'removed'}`;
                }
            }
            return `${drive.label}: ${drive.freeSpaceGB}GB (${drive.remainingPercent}% Left, ${change !== 0 ? `**${changeText}**` : changeText})`;
        }).join('\n');
        await channel.send(`**Change Report:**\n${messages}`);
        console.log('Message sent to Discord');
    } catch (error) {
        console.error('Error sending message to Discord:', error);
    }
}

async function checkDiskSpaceAndNotify() {
    try {
        console.log('Checking disk space...');
        const diskSpace = await getDiskSpace();
        if (diskSpace !== null) {
            let previousDiskSpace = diskSpaceInfo30Min.diskSpace;
            const hasSignificantChange = diskSpace.some((drive, index) => {
                const change = Math.abs(drive.freeSpaceGB - previousDiskSpace[index]?.freeSpaceGB);
                console.log(`Change in ${drive.label} drive: ${change}GB`);
                return change >= 1;
            });
            if (hasSignificantChange || !diskSpaceInfo30Min.hasSentInitialPost) {
                console.log('Significant change detected or initial post. Sending message to Discord...');
                sendMessageToDiscord(diskSpace, previousDiskSpace);
                diskSpaceInfo30Min.hasSentInitialPost = true;
            } else {
                console.log('No significant change detected.');
            }
            diskSpaceInfo30Min.diskSpace = diskSpace;
            fs.writeFileSync(JSON_FILE_30_MIN, JSON.stringify(diskSpaceInfo30Min));
            console.log('Updated 30 min disk space info');
        }
        console.log('\nDISKaard is running, do not close this window...\n'); // Message after each check
    } catch (error) {
        console.error('Error checking disk space and notifying:', error);
    }
}

async function sendDailyReport() {
    try {
        console.log('Sending daily report...');
        const currentDiskSpace = await getDiskSpace();
        if (currentDiskSpace !== null && (diskSpaceInfoDaily.diskSpace !== null || !diskSpaceInfoDaily.hasSentInitialDailyReport)) {
            const messages = currentDiskSpace.map((drive, index) => {
                const previousDrive = diskSpaceInfoDaily.diskSpace[index];
                let change = 0;
                let changeText = 'No change in the last 24 hours';
                if (previousDrive) {
                    change = drive.freeSpaceGB - previousDrive.freeSpaceGB;
                    if (change !== 0) {
                        changeText = `${Math.abs(change).toFixed(2)}GB ${change < 0 ? 'added' : 'removed'} in the last 24 hours`;
                    }
                }
                return `${drive.label}: ${drive.freeSpaceGB}GB (${drive.remainingPercent}% Left, ${change !== 0 ? `**${changeText}**` : changeText})`;
            }).join('\n');
            await sendDailyReportToDiscord(`**Daily Report:**\n${messages}`);
            diskSpaceInfoDaily.hasSentInitialDailyReport = true;
            console.log('Daily report sent to Discord');
        } else {
            console.log('No daily report sent');
        }
        diskSpaceInfoDaily.diskSpace = currentDiskSpace;
        fs.writeFileSync(JSON_FILE_DAILY, JSON.stringify(diskSpaceInfoDaily));
    } catch (error) {
        console.error('Error sending daily report:', error);
    }
}

async function sendDailyReportToDiscord(message) {
    try {
        console.log('Preparing to send daily report to Discord...');
        const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
        if (!channel) {
            throw new Error('Discord channel not found');
        }
        await channel.send(message);
        console.log('Daily report sent to Discord');
    } catch (error) {
        console.error('Error sending daily report to Discord:', error);
    }
}

client.login(DISCORD_BOT_TOKEN).then(async () => {
    try {
        console.log('Logged in to Discord');
        await checkDiskSpaceAndNotify();
        console.log('Initial disk space check complete');

        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();
        const timeToNextHalfHour = ((30 - (minutes % 30)) * 60 * 1000) - (seconds * 1000) - milliseconds;

        setTimeout(async () => {
            await checkDiskSpaceAndNotify(); 
            setInterval(checkDiskSpaceAndNotify, 30 * 60 * 1000); // Then check every 30 minutes
            console.log('Scheduled 30 min disk space checks');
        }, timeToNextHalfHour);

        const nextReportTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), REPORT_HOUR, REPORT_MINUTE, REPORT_SECOND);
        if (now > nextReportTime) {
            nextReportTime.setDate(nextReportTime.getDate() + 1);
        }
        const tillNextReport = nextReportTime - now;
        setTimeout(() => {
            sendDailyReport();
            setInterval(sendDailyReport, 24 * 60 * 60 * 1000); // Every 24 hours
            console.log('Scheduled daily reports');
        }, tillNextReport);
        console.log('\nDISKaard is running, do not close this window...\n');
    } catch (error) {
        console.error('Error logging in to Discord and checking disk space:', error);
    }
});
// DISKaard by Shilo Tobin 2024
