// const { spawn } = require('child_process');

// // Define the command and arguments
// const command = '/usr/bin/gnome-terminal';
// const args = [];

// // Spawn the process with error handling
// const child = spawn(command, args, {
//     detached: true,
//     stdio: 'ignore',
//     env: {
//         DISPLAY: ':1'
//     }
// });

// // Check for the 'error' event
// child.on('error', (err) => {
//     console.error('Failed to start a new terminal:', err);
// });

// // Log process information
// console.log(`Attempted to start new terminal. PID: ${child.pid}`);
// console.log('A new GNOME Terminal session has been started!');

const { spawn } = require('child_process');

// Define the command to launch the terminal
const command = '/usr/bin/gnome-terminal';

// Define the arguments to be passed to gnome-terminal.
// '--' tells gnome-terminal to execute the following command
const args = [
    '--',
    'tail',
    '-f',
    '/home/kavindu-janith/po/var/log/services/archiveindex1/archiveindex-service.log'
];

// Spawn the process
const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    env: {
        DISPLAY: ':1'
    }
});

// Add error handling to catch any issues with spawning the process
child.on('error', (err) => {
    console.error('Failed to start a new terminal:', err);
});

console.log(`Attempted to start new terminal. PID: ${child.pid}`);
console.log('A new GNOME Terminal session has been started with tail -f.');