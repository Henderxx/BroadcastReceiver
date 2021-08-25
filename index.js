const PORT = '9000'
const MCAST_ADDR = '239.255.255.250'
const dgram = require('dgram')
const fs = require('fs')
const sourceFile = '/etc/network/interfaces'
//const sourceFile = __dirname+'/interfaces'
const backupFile = __dirname+'/backup/interfaces.bak'
const { exec }= require('child_process')
const { stderr, stdout } = require('process')
let readyIntFile = {}

const receiver = dgram.createSocket({type: 'udp4', reuseAddr: true})

receiver.bind(PORT, () => {
    receiver.setBroadcast(true)
    //receiver.setMulticastTTL(128)
    receiver.addMembership(MCAST_ADDR)
})
receiver.on('listening',() => {
    const address = receiver.address()
    console.log(`Serwer zaczal nasluchiwac na ${address.address} na porcie ${address.port}`)
})

receiver.on('error', (err) => {
    console.log(`receiver error: \n ${err.stack}`);
    receiver.close()
})
receiver.once('listening', () =>{
    readInterfaces()
    goBackupInterfaces()
})

receiver.on('message',async (msg, rinfo) => {
    const output = `Serwer UDP otrzymal message: ${msg} \n z ${rinfo.address}:${rinfo.port} \n`
        let receivedPacket = msg.toString().slice(0).trim().split(/ +/)
        const command = receivedPacket[0]
    process.stdout.write(output)

    switch (command) {
        case 'halo':
            receiver.send(`otrzymałem wiadomość panie klienterze`, rinfo.port, MCAST_ADDR,(error,bytes)=> {
                if(error) return console.log(error.stack)
            })
            break
        case 'setip':
            const newIp = receivedPacket[1]
            const newNetmask = receivedPacket[3]
            const newGateway = receivedPacket[5]
            await changeIPAddress(newIp,newNetmask,newGateway)
            break
        case 'setdhcp':
            await setToDHCP()
            break
        case 'reboot':
            await goReboot()
            break
        default:
            receiver.send(`Ping pong ping`, rinfo.port, MCAST_ADDR,(error,bytes)=> {
                if(error) return console.log(error.stack)
            })
            break
    }
})

async function changeIPAddress(newIp,newNetmask,newGateway) {
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = readyIntFile.toString()
    let strToWrite = `
iface eth0 inet static
    address ${newIp}
    netmask ${newNetmask}
    gateway ${newGateway}

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)
    let result = file_content.slice(0,idx) + strToWrite + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},raisErr)
    console.log(`Zapisano zmiany w pliku, nowe ip zostanie zmienione po restarcie urzadzenia`)
}
async function setToDHCP(){
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = readyIntFile.toString()
    let strToWriteDhcp = `
iface eth0 inet dhcp

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)// - end_string.length
    let result = file_content.slice(0,idx) + strToWriteDhcp + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},raisErr)
    console.log(`Zapisano zmiany w pliku,IP zostanie zmienione na DHCP po restarcie urzadzenia`)
}
async function goReboot(){
    exec('reboot', (error,stdout,stderr) =>{
        if(error) {
            console.log(`error: ${error.message}`)
            return
        }
        if(stderr) {
            console.log(`stderr: ${stderr}`)
            return
        }
        console.log(`going to reboot. Bye`);
    })
}
function readInterfaces(){
    return fs.readFile(sourceFile,{encoding:'utf-8'}, (err, data) =>{
        if(err) return console.log(err.name);
        readyIntFile = data
    })
}
function goBackupInterfaces(){
    return fs.copyFile(sourceFile, backupFile, fs.constants.COPYFILE_FICLONE, raisErr)
}
function raisErr(err){
    if (err) throw err
}