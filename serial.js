const connectButton = document.getElementById('connectButton');
const sendButton = document.getElementById('sendButton');
const commandInput = document.getElementById('commandInput');
const output = document.getElementById('output');
let port, writer, reader;

connectButton.addEventListener('click', async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 57600 });
        writer = port.writable.getWriter();
        reader = port.readable.getReader();
        document.getElementById('controls').style.display = 'block';
    } catch (err) {
        console.error('Failed to connect to the serial port:', err);
    }
});

sendButton.addEventListener('click', async () => {
    const command = commandInput.value.split(' ');
    if (command) {
        await sendCommand(command);
    }
});

async function sendCommand(command) {
    try {
        // Send initial bytes
        await sendInitialBytes();
        const initialResponse = await readBytes(1);

        if (initialResponse[0] !== 0xcc) {
            console.error('No response from device or unexpected response');
            return;
        }

        // Send the actual command
        if (command[0] === 'info') {
            await sendInfoCommand();
            let response = await readBytes(29);
            output.textContent += `Received: ${Array.from(response).map(byte => byte.toString(16).padStart(2, '0')).join(' ')}\n`;
        } else if(command[0] === 'read') {
            let addr = parseInt(command[1], 16);
            let size = parseInt(command[2], 16);
            
            if(isNaN(addr)) {
                addr = 0;
            }

            if(isNaN(size)) {
                size = 0;
            }
            
            let response = await readMemory(addr, size);
            output.textContent += `Received: ${Array.from(response).map(byte => byte.toString(16).padStart(2, '0')).join(' ')}\n`;
        }
    } catch (err) {
        console.error('Failed to send command:', err);
    }
}

async function readMemory(addr, dataLen) {
    try {
        // await sendInitialBytes();
        // const initialResponse = await readBytes(1);
        // if (initialResponse[0] !== 0xcc) {
        //     console.error('No response from device or unexpected response');
        //     return null;
        // }

        const CMD_READ_MEM = 0x3; // Vervang dit door het juiste commando
        await writer.write(new Uint8Array([CMD_READ_MEM]));
        await writer.write(new Uint8Array([addr & 0xff, (addr >> 8) & 0xff, 0x00]));
        await writer.write(new Uint8Array([dataLen & 0xff, (dataLen >> 8) & 0xff]));

        // return await readBytes(dataLen);
        return await readBytes(dataLen);
    } catch (err) {
        console.error('Failed to read memory:', err);
        return null;
    }
}

async function sendInitialBytes() {
    await writer.write(new Uint8Array([0x55, 0xaa]));
}

async function sendInfoCommand() {
    await writer.write(new Uint8Array([0x04]));
}

async function readBytes(length) {
    let receivedBytes = new Uint8Array(length);
    let receivedLength = 0;

    while (receivedLength < length) {
        const { value, done } = await reader.read();
        if (done) {
            console.error('Stream closed before receiving all expected data');
            break;
        }

        receivedBytes.set(value, receivedLength);
        receivedLength += value.length;
    }

    return receivedBytes;
}
