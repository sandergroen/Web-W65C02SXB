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
    const command = commandInput.value;
    if (command) {
        await sendCommand(command);
    }
});

async function sendCommand(command) {
    try {
        // Send initial bytes
        await writer.write(new Uint8Array([0x55, 0xaa]));
        let initialResponse = new Uint8Array(1);
        ({ value: initialResponse } = await reader.read());
        if (initialResponse[0] !== 0xcc) {
            console.error('No response from device or unexpected response');
            return;
        }

        // Send the actual command
        if (command === 'info') {
            await writer.write(new Uint8Array([0x04]));
            // Read multiple bytes (for example, 29 bytes as in your Python code)
            const expectedLength = 29;
            let response = new Uint8Array(expectedLength);
            let receivedLength = 0;

            while (receivedLength < expectedLength) {
                const { value, done } = await reader.read();
                if (done) {
                    console.error('Stream closed before receiving all expected data');
                    break;
                }
                response.set(value, receivedLength);
                receivedLength += value.length;
            }

            output.textContent += `Received: ${Array.from(response).map(byte => byte.toString(16).padStart(2, '0')).join(' ')}\n`;
        }
    } catch (err) {
        console.error('Failed to send command:', err);
    }
}