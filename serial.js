const connectButton = document.getElementById('connectButton');
const sendButton = document.getElementById('sendButton');
const btnState = document.getElementById('getstate');
const btnInfo = document.getElementById('getinfo');
const commandInput = document.getElementById('commandInput');
const output = document.getElementById('output');
let port, writer, reader;
const stateAddress = 0x7e00;

connectButton.addEventListener('click', async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 57600 });
        writer = port.writable.getWriter();
        reader = port.readable.getReader();
        document.getElementById('controls').style.display = 'block';
        connectButton.style.display = 'none';
    } catch (err) {
        console.error('Failed to connect to the serial port:', err);
    }
});

btnInfo.addEventListener('click', async () => {
    await sendCommand(['info']);
});
btnState.addEventListener('click', async () => {
    await sendCommand(['getstate']);
});

sendButton.addEventListener('click', async () => {
    const command = commandInput.value.split(' ');
    if (command) {
        await sendCommand(command);
    }
});

async function sendCommand(arrCommand) {
    try {
        const command = arrCommand.shift();
        // Send initial bytes
        await sendInitialBytes();
        const initialResponse = await readBytes(1);

        if (initialResponse[0] !== 0xcc) {
            console.error('No response from device or unexpected response');
            return;
        }

        // Send the actual command
        if (command === 'info') {
            await sendInfoCommand();
            let response = await readBytes(29);
            print(response);
        } else if (command === 'getstate') {
            let state = await readMemory(stateAddress, 16);
            a  = state[0] + (state[1]<<8);
            x  = state[2] + (state[3]<<8);
            y  = state[4] + (state[5]<<8);
            pc = state[6] + (state[7]<<8);
            sp = state[0xa];
            unk = state[0xb];
            procstat = state[0xc];

            document.querySelector('input[name="pc"]').value = toHex(pc);
            document.querySelector('input[name="a"]').value = toHex(a);
            document.querySelector('input[name="x"]').value = toHex(x);
            document.querySelector('input[name="y"]').value = toHex(y);
            document.querySelector('input[name="sp"]').value = toHex(sp);
            document.querySelector('input[name="sr"]').value = formatStatusReg(toBin(procstat));

            // stateAddress
        } else if(command === 'read') {
            let addr = parseInt(arrCommand.shift(), 16);
            
            
            if(isNaN(addr)) {
                addr = 0;
            }
            
            let size = parseInt(arrCommand.shift(), 16);
            if(isNaN(size)) {
                size = 0;
            }
            
            let response = await readMemory(addr, size);
            print(response);
        } else if(command === 'write') {
            let addr = parseInt(arrCommand.shift(), 16);
            if(isNaN(addr)) {
                addr = 0;
            }
            await writeMemory(addr, arrCommand.map((byte) => parseInt(byte, 16)));
        } else if(command === 'exec') {
            // let addr = parseInt(command.shift(), 16);

            // if(isNaN(addr)) {
            //     addr = 0;
            // }

            // let state = [
            //     0x00, 0x00, // A
            //     0x00, 0x00, // X
            //     0x00, 0x00, // Y
            //     addr & 0xff, (addr >> 8) & 0xff, // PC
            //     0,              // 8
            //     0,              // 9
            //     0xff,           // A stack pointer
            //     1,              // B
            //     0,              // C processor status bits
            //     1,              // D CPU mode (0=65816, 1=6502)
            //     0,              // E
            //     0];              // F
            // writeMemory(stateAddress, state);
            await sendDebugCommand();
        }
    } catch (err) {
        console.error('Failed to send command:', err);
    }
}

function formatStatusReg(str) {
    if (str.length < 2) {
      return [str, ''];
    }

    const firstPart = str.substring(0, 2);
    const secondPart = str.substring(3);
  
    return [firstPart, secondPart].join('-');
  }
  

function print(bytes) {
    const p = document.createElement('p');
    p.textContent = `${Array.from(bytes).map(byte => toHex(byte)).join(' ')}`
    output.appendChild(p);
    
    output.scrollTop = output.scrollHeight;
}

function toHex(byte) {
    return `${byte.toString(16).padStart(2, '0')}`;
}

function toBin(byte) {
    return `${byte.toString(2).padStart(8, '0')}`;
}

async function readMemory(addr, dataLen) {
    try {
        const CMD_READ_MEM = 0x3;
        await writer.write(new Uint8Array([CMD_READ_MEM]));
        await writer.write(new Uint8Array([addr & 0xff, (addr >> 8) & 0xff, 0x00]));
        await writer.write(new Uint8Array([dataLen & 0xff, (dataLen >> 8) & 0xff]));

        return await readBytes(dataLen);
    } catch (err) {
        console.error('Failed to read memory:', err);
        return null;
    }
}

async function sendInitialBytes() {
    await writer.write(new Uint8Array([0x55, 0xaa]));
}

async function writeMemory(addr, data) {
    await writeMemoryCommand();
    await writer.write(new Uint8Array([addr & 0xff, (addr>>8) & 0xff, 0, data.length & 0xff, (data.length >> 8) & 0xff]));
    await writer.write(new Uint8Array(data));
}

async function writeMemoryCommand() {
    await writer.write(new Uint8Array([0x2]));
}

async function sendInfoCommand() {
    await writer.write(new Uint8Array([0x04]));
}

async function sendDebugCommand() {
    await writer.write(new Uint8Array([0x05]));
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
